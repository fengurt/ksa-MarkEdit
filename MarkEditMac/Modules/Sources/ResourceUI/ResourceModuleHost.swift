//
//  ResourceModuleHost.swift
//
//  Created by ksamint on 8/1/26.
//

import AppKit
import ResourceCore

@MainActor
public final class ResourceModuleHost {
  public typealias ConfirmInstallation = @MainActor (ResourceModuleCatalogEntryV1) async -> Bool

  private let installer: ResourceModuleInstaller
  private let trustStore: ResourceModuleTrustStore
  private let messages: ResourceUIMessages
  private let catalogURL: URL?
  private let bundledModuleURLs: [URL]
  private let appVersion: String
  private let confirmInstallation: ConfirmInstallation
  private let openInEditor: @MainActor (URL) -> Void
  private let openExternally: @MainActor (URL) -> Void
  private var windows = [UUID: ResourceViewerWindowController]()

  public init(
    installationRoot: URL,
    trustStore: ResourceModuleTrustStore,
    messages: ResourceUIMessages,
    catalogURL: URL? = nil,
    bundledModuleURLs: [URL] = [],
    appVersion: String = "0",
    confirmInstallation: @escaping ConfirmInstallation = { _ in false },
    openInEditor: @escaping @MainActor (URL) -> Void = { _ in },
    openExternally: @escaping @MainActor (URL) -> Void = { _ in }
  ) {
    self.installer = ResourceModuleInstaller(
      installationRoot: installationRoot,
      trustStore: trustStore
    )
    self.trustStore = trustStore
    self.messages = messages
    self.catalogURL = catalogURL
    self.bundledModuleURLs = bundledModuleURLs
    self.appVersion = appVersion
    self.confirmInstallation = confirmInstallation
    self.openInEditor = openInEditor
    self.openExternally = openExternally
  }

  @discardableResult
  public func open(
    _ url: URL,
    tabbingWindow: NSWindow? = nil
  ) async throws -> ResourceViewerWindowController {
    let session = try ResourceSession(url: url)
    let selected: InstalledModule?
    let catalogUnavailable: Bool
    if let installed = try await selectInstalledModule(for: url, session: session) {
      selected = installed
      catalogUnavailable = false
    } else {
      let result = await downloadModuleIfApproved(for: url, session: session)
      selected = result.module
      catalogUnavailable = result.catalogUnavailable
    }
    let controller = ResourceViewerWindowController(
      session: session,
      title: url.lastPathComponent,
      moduleURL: selected?.url,
      manifest: selected?.manifest,
      catalogUnavailable: selected == nil && catalogUnavailable,
      messages: messages,
      openInEditor: openInEditor,
      openExternally: openExternally
    )
    await LiveResourceRegistry.shared.register(session)
    controller.onClose = { [weak self] identifier in
      self?.windows[identifier] = nil
      Task {
        await LiveResourceRegistry.shared.unregister(session.id)
      }
    }
    windows[controller.identifier] = controller
    controller.showWindow(nil)
    if let tabbingWindow, let resourceWindow = controller.window,
       tabbingWindow !== resourceWindow {
      tabbingWindow.addTabbedWindow(resourceWindow, ordered: .above)
    }
    return controller
  }

  public func install(
    from manifestURL: URL,
    expectedSHA256: String
  ) async throws -> URL {
    try await installer.install(from: manifestURL, expectedSHA256: expectedSHA256)
  }
}

private extension ResourceModuleHost {
  struct InstalledModule {
    let url: URL
    let manifest: ResourceModuleManifestV1
    let confidence: Int
    let bundled: Bool
  }

  struct DownloadResult {
    let module: InstalledModule?
    let catalogUnavailable: Bool
  }

  func selectInstalledModule(for url: URL, session: ResourceSession) async throws -> InstalledModule? {
    let installed = await installer.installedModules()
    let descriptor = try await session.broker.descriptor()
    let fileExtension = url.pathExtension.lowercased()

    var candidates = [InstalledModule]()
    for (moduleURL, bundled) in installed.map({ ($0, false) }) + bundledModuleURLs.map({ ($0, true) }) {
      let manifest = if bundled {
        try? await installer.validateBundledModule(at: moduleURL)
      } else {
        try? await installer.validateInstalledModule(at: moduleURL)
      }
      guard let manifest else {
        continue
      }
      let confidence = await confidence(
        for: manifest.probes,
        descriptor: descriptor,
        fileExtension: fileExtension,
        session: session
      )
      if confidence > 0 {
        candidates.append(InstalledModule(
          url: moduleURL,
          manifest: manifest,
          confidence: confidence,
          bundled: bundled
        ))
      }
    }
    return candidates.max { lhs, rhs in
      if lhs.confidence != rhs.confidence {
        return lhs.confidence < rhs.confidence
      }
      let versionOrder = lhs.manifest.version.compare(rhs.manifest.version, options: .numeric)
      if versionOrder != .orderedSame {
        return versionOrder == .orderedAscending
      }
      return !lhs.bundled && rhs.bundled
    }
  }

  func downloadModuleIfApproved(for url: URL, session: ResourceSession) async -> DownloadResult {
    guard let catalogURL,
          let descriptor = try? await session.broker.descriptor() else {
      return DownloadResult(module: nil, catalogUnavailable: false)
    }
    let catalog: [ResourceModuleCatalogEntryV1]
    do {
      catalog = try await ResourceModuleCatalogClient.fetchModules(
        from: catalogURL,
        trustStore: trustStore
      )
    } catch {
      return DownloadResult(module: nil, catalogUnavailable: true)
    }
    let fileExtension = url.pathExtension.lowercased()
    var candidates = [(entry: ResourceModuleCatalogEntryV1, confidence: Int)]()
    for entry in catalog where isCompatible(entry) {
      let score = await confidence(
        for: entry.probes,
        descriptor: descriptor,
        fileExtension: fileExtension,
        session: session
      )
      if score > 0 {
        candidates.append((entry, score))
      }
    }
    guard let selected = candidates.max(by: { $0.confidence < $1.confidence }),
          await confirmInstallation(selected.entry),
          let manifestURL = URL(string: selected.entry.manifestURL),
          let moduleURL = try? await installer.install(
            from: manifestURL,
            expectedSHA256: selected.entry.manifestSHA256
          ),
          let manifest = try? await installer.validateInstalledModule(at: moduleURL),
          manifest.id == selected.entry.id,
          manifest.version == selected.entry.version else {
      return DownloadResult(module: nil, catalogUnavailable: false)
    }
    return DownloadResult(
      module: InstalledModule(
        url: moduleURL,
        manifest: manifest,
        confidence: selected.confidence,
        bundled: false
      ),
      catalogUnavailable: false
    )
  }

  func confidence(
    for probes: [ResourceProbeRuleV1],
    descriptor: ResourceDescriptorV1,
    fileExtension: String,
    session: ResourceSession
  ) async -> Int {
    var confidence = 0
    for rule in probes {
      if let group = rule.group {
        var conditionMatches = [Bool]()
        for condition in group.conditions {
          conditionMatches.append(await matches(
            condition,
            descriptor: descriptor,
            fileExtension: fileExtension,
            session: session
          ))
        }
        let matched = switch group.mode {
        case .all:
          !conditionMatches.isEmpty && conditionMatches.allSatisfy { $0 }
        case .any:
          conditionMatches.contains(true)
        }
        if matched || group.fallback {
          confidence = max(confidence, group.score)
        }
        continue
      }
      let extensionMatches = rule.fileExtensions.contains {
        $0.caseInsensitiveCompare(fileExtension) == .orderedSame
      }
      let mediaTypeMatches = if let mediaType = descriptor.mediaType {
        rule.mediaTypes.contains { $0.caseInsensitiveCompare(mediaType) == .orderedSame }
      } else {
        false
      }
      let directoryMarkersMatch = if rule.directoryMarkers.isEmpty {
        false
      } else {
        await containsAll(rule.directoryMarkers, in: session)
      }
      let frontMatterMatches = if let frontMatter = rule.frontMatter {
        (try? await session.broker.matchesFrontMatter(frontMatter)) == true
      } else {
        false
      }
      if let score = ResourceProbeMatcher.score(
        rule: rule,
        extensionMatches: extensionMatches,
        mediaTypeMatches: mediaTypeMatches,
        directoryMarkersMatch: directoryMarkersMatch,
        frontMatterMatches: frontMatterMatches
      ) {
        confidence = max(confidence, score)
      }
    }
    return confidence
  }

  func matches(
    _ condition: ResourceProbeConditionV2,
    descriptor: ResourceDescriptorV1,
    fileExtension: String,
    session: ResourceSession
  ) async -> Bool {
    var declared = false
    if !condition.fileExtensions.isEmpty {
      declared = true
      guard condition.fileExtensions.contains(where: {
        $0.caseInsensitiveCompare(fileExtension) == .orderedSame
      }) else {
        return false
      }
    }
    if !condition.mediaTypes.isEmpty {
      declared = true
      guard let mediaType = descriptor.mediaType,
            condition.mediaTypes.contains(where: {
              $0.caseInsensitiveCompare(mediaType) == .orderedSame
            }) else {
        return false
      }
    }
    if !condition.directoryMarkers.isEmpty {
      declared = true
      guard await containsAll(condition.directoryMarkers, in: session) else {
        return false
      }
    }
    if let frontMatter = condition.frontMatter {
      declared = true
      guard (try? await session.broker.matchesFrontMatter(frontMatter)) == true else {
        return false
      }
    }
    return declared
  }

  func isCompatible(_ entry: ResourceModuleCatalogEntryV1) -> Bool {
    guard let minimum = entry.minAppVersion, !minimum.isEmpty else {
      return true
    }
    return minimum.compare(appVersion, options: .numeric) != .orderedDescending
  }

  func containsAll(_ markers: [String], in session: ResourceSession) async -> Bool {
    for marker in markers {
      guard ResourcePathPolicy.isSafeRelativePath(marker),
            (try? await session.broker.entry(id: marker)) != nil else {
        return false
      }
    }
    return true
  }
}

@MainActor
public final class ResourceViewerWindowController: NSWindowController, NSWindowDelegate {
  public let identifier = UUID()
  public var onClose: ((UUID) -> Void)?

  init(
    session: ResourceSession,
    title: String,
    moduleURL: URL?,
    manifest: ResourceModuleManifestV1?,
    catalogUnavailable: Bool,
    messages: ResourceUIMessages,
    openInEditor: @escaping @MainActor (URL) -> Void,
    openExternally: @escaping @MainActor (URL) -> Void
  ) {
    let content = ResourceModuleViewController(
      session: session,
      moduleURL: moduleURL,
      manifest: manifest,
      catalogUnavailable: catalogUnavailable,
      messages: messages,
      openInEditor: openInEditor,
      openExternally: openExternally
    )
    let window = NSWindow(contentViewController: content)
    window.title = title
    window.setContentSize(NSSize(width: 980, height: 680))
    window.minSize = NSSize(width: 640, height: 420)
    window.tabbingMode = .preferred
    window.styleMask.insert([.resizable, .titled, .closable, .miniaturizable])
    super.init(window: window)
    window.delegate = self
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  public func windowWillClose(_ notification: Notification) {
    onClose?(identifier)
  }
}
