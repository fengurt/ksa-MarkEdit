//
//  ResourceModuleHost.swift
//
//  Created by ksamint on 8/1/26.
//

import AppKit
import ResourceCore

@MainActor
public final class ResourceModuleHost {
  private let installer: ResourceModuleInstaller
  private let messages: ResourceUIMessages
  private var windows = [UUID: ResourceViewerWindowController]()

  public init(
    installationRoot: URL,
    trustStore: ResourceModuleTrustStore,
    messages: ResourceUIMessages
  ) {
    self.installer = ResourceModuleInstaller(
      installationRoot: installationRoot,
      trustStore: trustStore
    )
    self.messages = messages
  }

  @discardableResult
  public func open(_ url: URL) async throws -> ResourceViewerWindowController {
    let session = try ResourceSession(url: url)
    let selected = try await selectModule(for: url, session: session)
    let controller = ResourceViewerWindowController(
      session: session,
      title: url.lastPathComponent,
      moduleURL: selected?.url,
      manifest: selected?.manifest,
      messages: messages
    )
    controller.onClose = { [weak self] identifier in
      self?.windows[identifier] = nil
    }
    windows[controller.identifier] = controller
    controller.showWindow(nil)
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

  func selectModule(for url: URL, session: ResourceSession) async throws -> InstalledModule? {
    let installed = await installer.installedModules()
    let descriptor = try await session.broker.descriptor()
    let fileExtension = url.pathExtension.lowercased()

    var candidates = [InstalledModule]()
    for moduleURL in installed {
      guard let manifest = try? await installer.validateInstalledModule(at: moduleURL) else {
        continue
      }
      var confidence = 0
      for rule in manifest.probes {
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
    messages: ResourceUIMessages
  ) {
    let content = ResourceModuleViewController(
      session: session,
      moduleURL: moduleURL,
      manifest: manifest,
      messages: messages
    )
    let window = NSWindow(contentViewController: content)
    window.title = title
    window.setContentSize(NSSize(width: 980, height: 680))
    window.minSize = NSSize(width: 640, height: 420)
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
