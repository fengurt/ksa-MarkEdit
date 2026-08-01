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
  private let messages: ResourceUIMessages
  private let catalogURL: URL?
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
    appVersion: String = "0",
    confirmInstallation: @escaping ConfirmInstallation = { _ in false },
    openInEditor: @escaping @MainActor (URL) -> Void = { _ in },
    openExternally: @escaping @MainActor (URL) -> Void = { _ in }
  ) {
    self.installer = ResourceModuleInstaller(
      installationRoot: installationRoot,
      trustStore: trustStore
    )
    self.messages = messages
    self.catalogURL = catalogURL
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
    if let installed = try await selectInstalledModule(for: url, session: session) {
      selected = installed
    } else {
      selected = await downloadModuleIfApproved(for: url, session: session)
    }
    let controller = ResourceViewerWindowController(
      session: session,
      title: url.lastPathComponent,
      moduleURL: selected?.url,
      manifest: selected?.manifest,
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
  }

  func selectInstalledModule(for url: URL, session: ResourceSession) async throws -> InstalledModule? {
    let installed = await installer.installedModules()
    let descriptor = try await session.broker.descriptor()
    let fileExtension = url.pathExtension.lowercased()

    var candidates = [InstalledModule]()
    for moduleURL in installed {
      guard let manifest = try? await installer.validateInstalledModule(at: moduleURL) else {
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
          confidence: confidence
        ))
      }
    }
    return candidates.max { lhs, rhs in
      lhs.confidence < rhs.confidence
    }
  }

  func downloadModuleIfApproved(for url: URL, session: ResourceSession) async -> InstalledModule? {
    guard let catalogURL,
          let catalog = try? await ResourceModuleCatalogClient.fetch(from: catalogURL),
          let descriptor = try? await session.broker.descriptor() else {
      return nil
    }
    let fileExtension = url.pathExtension.lowercased()
    var candidates = [(entry: ResourceModuleCatalogEntryV1, confidence: Int)]()
    for entry in catalog.modules where isCompatible(entry) {
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
      return nil
    }
    return InstalledModule(
      url: moduleURL,
      manifest: manifest,
      confidence: selected.confidence
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
      var score = rule.priority
      if rule.fileExtensions.contains(where: { $0.caseInsensitiveCompare(fileExtension) == .orderedSame }) {
        score += 100
      }
      if let mediaType = descriptor.mediaType,
         rule.mediaTypes.contains(where: { $0.caseInsensitiveCompare(mediaType) == .orderedSame }) {
        score += 100
      }
      if !rule.directoryMarkers.isEmpty,
         await containsAll(rule.directoryMarkers, in: session) {
        score += 200
      }
      confidence = max(confidence, score)
    }
    return confidence
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
    messages: ResourceUIMessages,
    openInEditor: @escaping @MainActor (URL) -> Void,
    openExternally: @escaping @MainActor (URL) -> Void
  ) {
    let content = ResourceModuleViewController(
      session: session,
      moduleURL: moduleURL,
      manifest: manifest,
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
