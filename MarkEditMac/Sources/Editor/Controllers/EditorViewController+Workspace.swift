//
//  EditorViewController+Workspace.swift
//  MarkEditMac
//
//  Created by ksamint on 7/27/26.
//

import AppKit
import SharedUI
import WebKit

extension EditorViewController {
  var workspaceContentInset: Double {
    guard workspaceSidebarVisible, view.bounds.width >= 760 else {
      return 0
    }

    let preferredWidth: Double = {
      switch workspaceSidebarMode {
      case .files:
        return workspaceSidebarWidth
      case .search:
        return workspaceSearchWidth
      case .tags:
        return workspaceTagsWidth
      case .preview:
        return workspacePreviewWidth > 0 ? workspacePreviewWidth : view.bounds.width * 0.4
      }
    }()

    return min(max(preferredWidth, 200), max(200, view.bounds.width - 420))
  }

  var isRenderedPreviewActive: Bool {
    workspaceSidebarVisible
      && workspaceSidebarMode == .preview
      && workspaceContentInset > 0
      && workspacePreviewView != nil
  }

  func prepareWorkspaceSession() {
    if workspaceSession == nil {
      workspaceSession = WorkspaceSessionRegistry.consume(for: document?.fileURL)
    }

    if workspaceSession == nil {
      workspaceSession = view.window?.tabbedWindows?
        .compactMap { ($0.contentViewController as? EditorViewController)?.workspaceSession }
        .first
    }

    if workspaceSession == nil,
       let fileURL = document?.fileURL,
       let bookmark = AppPreferences.General.workspaceFolderBookmarks[fileURL.standardizedFileURL.path],
       let restoredSession = try? WorkspaceSession.restore(from: bookmark),
       restoredSession.contains(fileURL) {
      workspaceSession = restoredSession
    }

    if workspaceSession == nil,
       let bookmark = AppPreferences.General.workspaceFolderBookmark,
       let restoredSession = try? WorkspaceSession.restore(from: bookmark),
       document?.fileURL.map({ restoredSession.contains($0) }) != false {
      workspaceSession = restoredSession
    }

    if let workspaceSession, let fileURL = document?.fileURL {
      workspaceSession.persist(for: [fileURL])
    }

    if workspaceSidebarVisible {
      ensureWorkspaceSidebar()
    }
  }

  func toggleWorkspaceSidebar(_ mode: WorkspaceSidebarMode) {
    if workspaceSidebarVisible && workspaceSidebarMode == mode {
      workspaceSidebarVisible = false
    } else {
      workspaceSidebarMode = mode
      workspaceSidebarVisible = true
      ensureWorkspaceSidebar()
      workspaceSidebarView?.mode = mode
    }

    AppPreferences.Window.workspaceSidebarVisible = workspaceSidebarVisible
    AppPreferences.Window.workspaceSidebarMode = workspaceSidebarMode.rawValue
    view.needsLayout = true

    if workspaceSidebarVisible && mode == .search {
      workspaceSidebarView?.focusSearch()
    } else if workspaceSidebarVisible && mode == .preview {
      showRenderedPreview()
    } else if !workspaceSidebarVisible {
      startTextEditing()
    }
  }

  func layoutWorkspaceSidebar() {
    guard let workspaceSidebarView else {
      return
    }

    let width = workspaceContentInset
    workspaceSidebarView.isHidden = width == 0
    workspaceSidebarView.frame = CGRect(
      x: 0,
      y: 0,
      width: width,
      height: view.bounds.height - view.safeAreaInsets.top
    )
  }

  func ensureWorkspaceSidebar() {
    guard workspaceSidebarView == nil else {
      workspaceSidebarView?.session = workspaceSession
      return
    }

    let sidebar = WorkspaceSidebarView(frame: .zero)
    sidebar.mode = workspaceSidebarMode
    sidebar.session = workspaceSession
    sidebar.onModeSelected = { [weak self] mode in
      self?.toggleWorkspaceSidebar(mode)
    }
    sidebar.onChooseWorkspace = { [weak self] in
      self?.chooseWorkspaceFolder()
    }
    sidebar.onOpenResult = { [weak self] url, lineNumber in
      self?.openWorkspaceFile(url, lineNumber: lineNumber)
    }
    sidebar.onCreateFile = { [weak self] directory in
      self?.createWorkspaceItem(in: directory, isDirectory: false)
    }
    sidebar.onCreateFolder = { [weak self] directory in
      self?.createWorkspaceItem(in: directory, isDirectory: true)
    }
    sidebar.onRename = { [weak self] url in
      self?.renameWorkspaceItem(url)
    }
    sidebar.onMoveToTrash = { [weak self] url in
      self?.moveWorkspaceItemToTrash(url)
    }
    sidebar.onMove = { [weak self] sourceURL, destinationDirectory in
      self?.moveWorkspaceItem(sourceURL, to: destinationDirectory) ?? false
    }
    sidebar.onTaxonomyAction = { [weak self] action, item in
      self?.performTaxonomyAction(action, item: item)
    }
    sidebar.onResize = { [weak self] delta in
      self?.resizeWorkspaceSidebar(by: delta)
    }
    sidebar.onPreviewSyncChanged = { enabled in
      AppPreferences.Window.workspacePreviewSync = enabled
    }
    sidebar.onVisualEditingChanged = { [weak self] enabled in
      self?.changeVisualEditingPreference(enabled)
    }

    view.addSubview(sidebar, positioned: .above, relativeTo: webView)
    workspaceSidebarView = sidebar
    layoutWorkspaceSidebar()
  }
}

// MARK: - Workspace Selection

private extension EditorViewController {
  func chooseWorkspaceFolder() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.allowsMultipleSelection = false
    panel.canCreateDirectories = true
    panel.prompt = Localized.General.grantAccess
    panel.message = Localized.Workspace.chooseFolderDescription
    panel.directoryURL = workspaceSession?.rootURL ?? document?.folderURL

    Task { @MainActor [weak self] in
      guard let self, await presentSheetModal(panel) == .OK, let rootURL = panel.url else {
        return
      }

      do {
        let session = try WorkspaceSession.create(for: rootURL)
        bindWorkspaceSession(session)
      } catch {
        _ = await showAlert(
          title: Localized.Workspace.authorizationFailed,
          message: error.localizedDescription,
          buttons: [Localized.General.done]
        )
      }
    }
  }

  func bindWorkspaceSession(_ session: WorkspaceSession) {
    let tabbedEditors = view.window?.tabbedWindows?
      .compactMap { $0.contentViewController as? EditorViewController } ?? []
    let editors = tabbedEditors.isEmpty ? [self] : tabbedEditors

    for editor in editors {
      editor.workspaceSession = session
      editor.workspaceSidebarView?.session = session
    }
    session.persist(for: editors.compactMap { $0.document?.fileURL })
  }

  func resizeWorkspaceSidebar(by delta: Double) {
    let maximumWidth = max(200, view.bounds.width - 420)
    switch workspaceSidebarMode {
    case .files:
      workspaceSidebarWidth = min(max(workspaceSidebarWidth + delta, 200), maximumWidth)
      AppPreferences.Window.workspaceFilesWidth = workspaceSidebarWidth
    case .search:
      workspaceSearchWidth = min(max(workspaceSearchWidth + delta, 200), maximumWidth)
      AppPreferences.Window.workspaceSearchWidth = workspaceSearchWidth
    case .tags:
      workspaceTagsWidth = min(max(workspaceTagsWidth + delta, 200), maximumWidth)
      AppPreferences.Window.workspaceTagsWidth = workspaceTagsWidth
    case .preview:
      let currentWidth = workspacePreviewWidth > 0 ? workspacePreviewWidth : view.bounds.width * 0.4
      workspacePreviewWidth = min(max(currentWidth + delta, 200), maximumWidth)
      AppPreferences.Window.workspacePreviewWidth = workspacePreviewWidth
    }
    view.needsLayout = true
  }
}

// MARK: - Rendered Preview

extension EditorViewController {
  func showRenderedPreview() {
    ensureWorkspaceSidebar()

    if workspacePreviewView == nil {
      let previewView = WorkspacePreviewView(frame: .zero)
      previewView.baseURL = document?.baseURL
      previewView.onLocateSource = { [weak self] position in
        self?.startTextEditing()
        self?.bridge.selection.gotoPosition(position: position)
      }
      previewView.onOpenLink = { [weak self] link in
        self?.openRenderedPreviewLink(link)
      }
      previewView.onRevisionMismatch = { [weak self] in
        self?.resetRenderedPreview()
      }
      workspacePreviewView = previewView
      workspaceSidebarView?.setPreviewView(previewView)
    }

    workspacePreviewView?.baseURL = document?.baseURL
    workspaceSidebarView?.setPreviewSyncEnabled(AppPreferences.Window.workspacePreviewSync)
    workspaceSidebarView?.setVisualEditingEnabled(AppPreferences.Editor.visualEditingMode)
    resetRenderedPreview()
  }

  func changeVisualEditingPreference(_ enabled: Bool) {
    AppPreferences.Editor.visualEditingMode = enabled
    startTextEditing()
  }

  func toggleVisualEditing() {
    changeVisualEditingPreference(!AppPreferences.Editor.visualEditingMode)
  }

  func resetRenderedPreview() {
    guard isRenderedPreviewActive else {
      return
    }

    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      await waitUntilEditorReset()
      guard isRenderedPreviewActive, let text = await editorText else {
        return
      }
      workspacePreviewView?.reset(text: text, revision: editorTextRevision)
    }
  }

  func showWorkspaceHub() {
    if let window = workspaceHubWindowController?.window {
      window.makeKeyAndOrderFront(nil)
      return
    }

    Task { @MainActor [weak self] in
      guard let self, let session = workspaceSession else {
        toggleWorkspaceSidebar(.files)
        return
      }

      let snapshot = await session.hubSnapshot()
      let contentViewController = WorkspaceHubViewController(
        snapshot: snapshot,
        onOpen: { [weak self] path in
          guard let self, let session = workspaceSession else {
            return
          }
          let url = session.rootURL.appending(path: path).standardizedFileURL
          guard session.contains(url) else {
            showWorkspaceError(Localized.Workspace.outsideWorkspace)
            return
          }
          openWorkspaceFile(url, lineNumber: nil)
        }
      )
      let window = NSWindow(contentViewController: contentViewController)
      window.title = Localized.Workspace.hub
      window.setContentSize(NSSize(width: 1_040, height: 720))
      window.minSize = NSSize(width: 760, height: 520)
      window.styleMask.insert([.resizable, .miniaturizable, .closable, .titled])
      window.center()

      let controller = NSWindowController(window: window)
      workspaceHubWindowController = controller
      controller.showWindow(nil)
    }
  }
}

private extension EditorViewController {
  func openRenderedPreviewLink(_ link: String) {
    if let url = URL(string: link), let scheme = url.scheme?.lowercased() {
      guard ["http", "https", "mailto"].contains(scheme) else {
        NSSound.beep()
        return
      }
      NSWorkspace.shared.open(url)
      return
    }

    guard let baseURL = document?.baseURL else {
      NSSound.beep()
      return
    }

    let url = baseURL.appending(path: link.removingPercentEncoding ?? link).standardizedFileURL
    if let session = workspaceSession, session.contains(url) {
      openWorkspaceFile(url, lineNumber: nil)
    } else if FileManager.default.fileExists(atPath: url.path) {
      NSWorkspace.shared.open(url)
    } else {
      NSSound.beep()
    }
  }
}

@MainActor
private final class WorkspaceHubViewController: NSViewController {
  private let webView: WKWebView
  private let messageHandler: WorkspaceHubMessageHandler

  init(snapshot: WorkspaceHubSnapshot, onOpen: @escaping (String) -> Void) {
    let contentController = WKUserContentController()
    self.messageHandler = WorkspaceHubMessageHandler(onOpen: onOpen)
    contentController.add(messageHandler, name: "ksamintHub")

    if let data = try? JSONEncoder().encode(snapshot) {
      let base64 = data.base64EncodedString()
      let source = """
      (() => {
        const bytes = Uint8Array.from(atob('\(base64)'), value => value.charCodeAt(0));
        window.__KSAMINT_MAC_HUB__ = JSON.parse(new TextDecoder().decode(bytes));
      })();
      """
      contentController.addUserScript(
        WKUserScript(
          source: source,
          injectionTime: .atDocumentStart,
          forMainFrameOnly: true
        )
      )
    }

    let configuration = WKWebViewConfiguration()
    configuration.userContentController = contentController
    configuration.websiteDataStore = .nonPersistent()
    self.webView = WKWebView(frame: .zero, configuration: configuration)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func loadView() {
    view = webView
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    guard let indexURL = Bundle.main.url(
      forResource: "index",
      withExtension: "html",
      subdirectory: "KnowledgeHub"
    ) else {
      return
    }
    webView.loadFileURL(
      indexURL,
      allowingReadAccessTo: indexURL.deletingLastPathComponent()
    )
  }

  deinit {
    webView.configuration.userContentController.removeScriptMessageHandler(
      forName: "ksamintHub"
    )
  }
}

@MainActor
private final class WorkspaceHubMessageHandler: NSObject, WKScriptMessageHandler {
  private let onOpen: (String) -> Void

  init(onOpen: @escaping (String) -> Void) {
    self.onOpen = onOpen
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard message.name == "ksamintHub",
          let payload = message.body as? [String: Any],
          payload["action"] as? String == "open",
          let path = payload["path"] as? String else {
      return
    }
    onOpen(path)
  }
}

// MARK: - File Operations

private extension EditorViewController {
  func openWorkspaceFile(_ url: URL, lineNumber: Int?) {
    guard let session = workspaceSession, session.contains(url) else {
      showWorkspaceError(Localized.Workspace.outsideWorkspace)
      return
    }

    WorkspaceSessionRegistry.register(session, for: url)
    session.persist(for: [url])
    let targetWindow = view.window

    NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { [weak self] document, _, error in
      if let error {
        self?.showWorkspaceError(error.localizedDescription)
        return
      }

      guard let editorDocument = document as? EditorDocument else {
        return
      }

      Task { @MainActor in
        guard let contentViewController = editorDocument.windowControllers.first?.contentViewController
                as? EditorViewController else {
          return
        }

        contentViewController.workspaceSession = session
        if let newWindow = contentViewController.view.window,
           let targetWindow,
           newWindow !== targetWindow,
           newWindow.tabGroup !== targetWindow.tabGroup {
          targetWindow.addTabbedWindow(newWindow, ordered: .above)
        }

        contentViewController.view.window?.makeKeyAndOrderFront(nil)
        guard let lineNumber else {
          return
        }

        await contentViewController.waitUntilLoaded()
        contentViewController.startTextEditing()
        contentViewController.bridge.selection.gotoLine(lineNumber: lineNumber)
      }
    }
  }

  func createWorkspaceItem(in directory: URL, isDirectory: Bool) {
    guard validateWorkspaceURL(directory) else {
      return
    }

    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      let title = isDirectory ? Localized.Workspace.newFolder : Localized.Workspace.newFile
      let defaultValue = isDirectory
        ? Localized.Workspace.untitledFolder
        : "\(Localized.Workspace.untitledFile).\(AppPreferences.General.newFilenameExtension.rawValue)"
      guard let name = await showTextBox(
        title: title,
        placeholder: Localized.Workspace.name,
        defaultValue: defaultValue
      ), let destination = validatedDestination(name: name, in: directory) else {
        return
      }

      do {
        if isDirectory {
          try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false)
        } else {
          try Data().write(to: destination, options: .withoutOverwriting)
          openWorkspaceFile(destination, lineNumber: nil)
        }
        workspaceSidebarView?.reloadTree()
        try? await workspaceSession?.index.refresh(url: destination)
      } catch {
        showWorkspaceError(error.localizedDescription)
      }
    }
  }

  func renameWorkspaceItem(_ sourceURL: URL) {
    guard validateWorkspaceURL(sourceURL), canMoveWorkspaceItem(sourceURL) else {
      return
    }

    Task { @MainActor [weak self] in
      guard let self,
            let name = await showTextBox(
              title: Localized.Workspace.rename,
              placeholder: Localized.Workspace.name,
              defaultValue: sourceURL.lastPathComponent
            ),
            let destinationURL = validatedDestination(
              name: name,
              in: sourceURL.deletingLastPathComponent()
            ) else {
        return
      }

      performMove(sourceURL, to: destinationURL)
    }
  }

  func moveWorkspaceItem(_ sourceURL: URL, to destinationDirectory: URL) -> Bool {
    guard validateWorkspaceURL(sourceURL),
          validateWorkspaceURL(destinationDirectory),
          canMoveWorkspaceItem(sourceURL),
          let destinationURL = validatedDestination(
            name: sourceURL.lastPathComponent,
            in: destinationDirectory
          ),
          sourceURL.standardizedFileURL != destinationURL.standardizedFileURL else {
      return false
    }

    return performMove(sourceURL, to: destinationURL)
  }

  @discardableResult
  func performMove(_ sourceURL: URL, to destinationURL: URL) -> Bool {
    do {
      try FileManager.default.moveItem(at: sourceURL, to: destinationURL)
      if let openDocument = NSDocumentController.shared.document(for: sourceURL) {
        openDocument.fileURL = destinationURL
      }
      workspaceSidebarView?.reloadTree()
      workspaceSession?.rebuildIndex()
      return true
    } catch {
      showWorkspaceError(error.localizedDescription)
      return false
    }
  }

  func moveWorkspaceItemToTrash(_ url: URL) {
    guard validateWorkspaceURL(url), canMoveWorkspaceItem(url) else {
      return
    }

    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      let response = await showAlert(
        title: Localized.Workspace.moveToTrash,
        message: String(format: Localized.Workspace.trashConfirmationFormat, url.lastPathComponent),
        buttons: [Localized.Workspace.moveToTrash, Localized.General.cancel]
      )
      guard response == .alertFirstButtonReturn else {
        return
      }

      NSWorkspace.shared.recycle([url]) { _, error in
        Task { @MainActor [weak self] in
          if let error {
            self?.showWorkspaceError(error.localizedDescription)
          } else {
            self?.workspaceSidebarView?.reloadTree()
            self?.workspaceSession?.rebuildIndex()
          }
        }
      }
    }
  }

  func validateWorkspaceURL(_ url: URL) -> Bool {
    guard let session = workspaceSession, session.contains(url) else {
      showWorkspaceError(Localized.Workspace.outsideWorkspace)
      return false
    }
    return true
  }

  func validatedDestination(name rawName: String, in directory: URL) -> URL? {
    let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty,
          name != ".",
          name != "..",
          !name.contains("/"),
          !name.contains(":") else {
      showWorkspaceError(Localized.Workspace.invalidName)
      return nil
    }

    let destination = directory.appending(path: name)
    guard validateWorkspaceURL(destination) else {
      return nil
    }
    guard !FileManager.default.fileExists(atPath: destination.path) else {
      showWorkspaceError(Localized.Workspace.itemExists)
      return nil
    }
    return destination
  }

  func canMoveWorkspaceItem(_ url: URL) -> Bool {
    guard url.standardizedFileURL != workspaceSession?.rootURL.standardizedFileURL else {
      showWorkspaceError(Localized.Workspace.cannotMoveRoot)
      return false
    }

    if let document = NSDocumentController.shared.document(for: url), document.isDocumentEdited {
      showWorkspaceError(Localized.Workspace.unsavedMoveBlocked)
      return false
    }
    return true
  }

  func showWorkspaceError(_ message: String) {
    Task { @MainActor [weak self] in
      guard let self else {
        return
      }
      _ = await showAlert(
        title: Localized.Workspace.operationFailed,
        message: message,
        buttons: [Localized.General.done]
      )
    }
  }
}

// MARK: - Tags and Categories

private extension EditorViewController {
  func performTaxonomyAction(
    _ action: WorkspaceTaxonomyAction,
    item: WorkspaceTaxonomyItem
  ) {
    workspaceMetadataTask?.cancel()
    workspaceMetadataTask = Task { @MainActor [weak self] in
      guard let self, let session = workspaceSession else {
        return
      }

      let urls = await session.files(for: item)
      guard !urls.isEmpty, !Task.isCancelled else {
        NSSound.beep()
        return
      }

      let destination: String?
      switch action {
      case .rename:
        destination = await showTextBox(
          title: Localized.Workspace.renameMetadata,
          placeholder: Localized.Workspace.metadataName,
          defaultValue: item.displayName
        )
      case .merge:
        destination = await showTextBox(
          title: Localized.Workspace.mergeTag,
          placeholder: Localized.Workspace.targetTag,
          defaultValue: nil
        )
      case .delete:
        destination = nil
      }

      if action != .delete {
        guard let destination = destination?.trimmingCharacters(
          in: .whitespacesAndNewlines
        ), !destination.isEmpty, destination != item.displayName else {
          return
        }
      }

      let actionTitle: String = {
        switch action {
        case .rename:
          return Localized.Workspace.renameMetadata
        case .merge:
          return Localized.Workspace.mergeTag
        case .delete:
          return Localized.Workspace.deleteMetadata
        }
      }()
      let response = await showAlert(
        title: actionTitle,
        message: String(
          format: Localized.Workspace.metadataImpactFormat,
          item.displayName,
          urls.count
        ),
        buttons: [actionTitle, Localized.General.cancel]
      )
      guard response == .alertFirstButtonReturn, !Task.isCancelled else {
        return
      }

      do {
        var snapshots = [URL: WorkspaceDocumentMetadata]()
        for url in urls {
          guard !Task.isCancelled else {
            throw CancellationError()
          }

          let original = try await currentMetadata(at: url)
          snapshots[url] = original
          let updated = transformedMetadata(
            original,
            item: item,
            action: action,
            destination: destination
          )
          try await applyMetadata(updated, at: url)
        }

        registerMetadataUndo(snapshots)
        session.rebuildIndex()
        workspaceSidebarView?.reloadTaxonomy()
      } catch is CancellationError {
        return
      } catch {
        showWorkspaceError(error.localizedDescription)
      }
    }
  }

  func transformedMetadata(
    _ metadata: WorkspaceDocumentMetadata,
    item: WorkspaceTaxonomyItem,
    action: WorkspaceTaxonomyAction,
    destination: String?
  ) -> WorkspaceDocumentMetadata {
    var metadata = metadata

    switch item {
    case let .tag(tag):
      let sourceIdentity = tag.identity
      var tags = metadata.tags.filter {
        WorkspaceDocumentMetadata.canonicalTagIdentity($0) != sourceIdentity
      }
      if action != .delete, let destination {
        tags.append(destination)
      }
      metadata.tags = WorkspaceDocumentMetadata(tags: tags).tags

    case let .category(category):
      guard let currentCategory = metadata.category else {
        return metadata
      }
      let source = category.path
      guard currentCategory == source || currentCategory.hasPrefix("\(source)/") else {
        return metadata
      }

      if action == .delete {
        metadata.category = nil
      } else if let destination {
        metadata.category = destination + String(currentCategory.dropFirst(source.count))
      }
    }
    return metadata
  }

  func currentMetadata(at url: URL) async throws -> WorkspaceDocumentMetadata {
    if let document = NSDocumentController.shared.document(for: url) as? EditorDocument,
       let metadata = await document.currentWorkspaceMetadata() {
      return metadata
    }
    return try WorkspaceMetadataFile.read(at: url)
  }

  func applyMetadata(_ metadata: WorkspaceDocumentMetadata, at url: URL) async throws {
    if let document = NSDocumentController.shared.document(for: url) as? EditorDocument {
      try await document.applyWorkspaceMetadata { _ in metadata }
      return
    }

    var coordinationError: NSError?
    var operationError: Error?
    let coordinator = NSFileCoordinator()
    coordinator.coordinate(
      writingItemAt: url,
      options: .forMerging,
      error: &coordinationError
    ) { coordinatedURL in
      do {
        try WorkspaceMetadataFile.update(at: coordinatedURL) { _ in metadata }
      } catch {
        operationError = error
      }
    }

    if let coordinationError {
      throw coordinationError
    }
    if let operationError {
      throw operationError
    }
  }

  func registerMetadataUndo(_ snapshots: [URL: WorkspaceDocumentMetadata]) {
    undoManager?.registerUndo(withTarget: self) { target in
      target.workspaceMetadataTask?.cancel()
      target.workspaceMetadataTask = Task { @MainActor [weak target] in
        guard let target else {
          return
        }
        do {
          for (url, metadata) in snapshots {
            try await target.applyMetadata(metadata, at: url)
          }
          target.workspaceSession?.rebuildIndex()
          target.workspaceSidebarView?.reloadTaxonomy()
        } catch {
          target.showWorkspaceError(error.localizedDescription)
        }
      }
    }
    undoManager?.setActionName(Localized.Workspace.editMetadata)
  }
}
