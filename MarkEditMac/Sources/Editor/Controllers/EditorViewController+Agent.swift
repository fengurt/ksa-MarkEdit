//
//  EditorViewController+Agent.swift
//
//  Created by ksamint on 8/1/26.
//

import AppKit
import SharedUI
import UniformTypeIdentifiers

extension EditorViewController {
  var agentPanelInset: Double {
    guard agentPanelVisible else {
      return 0
    }
    let maximum = max(300, view.bounds.width - workspaceContentInset - 420)
    return min(max(agentPanelWidth, 300), maximum)
  }

  func toggleAgentPanel() {
    if agentPanelVisible {
      closeAgentPanel()
      return
    }
    agentPanelVisible = true
    ensureAgentPanel()
    agentPanelView?.isHidden = false
    layoutAgentPanel()
    layoutWebView()
    layoutStatusView()
    detectAndStartAgent()
  }

  func layoutAgentPanel() {
    guard let agentPanelView else {
      return
    }
    let width = agentPanelInset
    agentPanelView.isHidden = width == 0
    agentPanelView.frame = CGRect(
      x: view.bounds.width - width,
      y: 0,
      width: width,
      height: view.bounds.height - view.safeAreaInsets.top
    )
  }
}

private extension EditorViewController {
  func ensureAgentPanel() {
    guard agentPanelView == nil else {
      return
    }
    let panel = AgentPanelView(frame: .zero)
    panel.selectedProvider = agentProvider
    panel.setStatus(Localized.Agent.detecting)
    panel.onClose = { [weak self] in self?.closeAgentPanel() }
    panel.onProviderChanged = { [weak self] provider in
      self?.agentProvider = provider
      AppPreferences.Window.agentProvider = provider.rawValue
      self?.startAgent(provider: provider)
    }
    panel.onSubmit = { [weak self] prompt in self?.submitAgentPrompt(prompt) }
    panel.onCancel = { [weak self] in
      guard let bridge = self?.agentBridge else { return }
      Task { await bridge.cancel() }
    }
    panel.onApproval = { [weak self] identifier, approved in
      guard let bridge = self?.agentBridge else { return }
      Task { try? await bridge.respond(to: identifier, approved: approved) }
    }
    panel.onInsert = { [weak self] in self?.insertAgentDraft() }
    panel.onSaveMarkdown = { [weak self] in self?.saveAgentDraft(reference: false) }
    panel.onSaveReference = { [weak self] in self?.saveAgentDraft(reference: true) }
    panel.onResize = { [weak self] delta in self?.resizeAgentPanel(by: delta) }
    view.addSubview(panel, positioned: .above, relativeTo: webView)
    agentPanelView = panel
  }

  func closeAgentPanel() {
    agentPanelVisible = false
    agentPanelView?.isHidden = true
    agentStartupTask?.cancel()
    agentStartupTask = nil
    agentEventTask?.cancel()
    agentEventTask = nil
    agentMCPServer?.stop()
    agentMCPServer = nil
    if let bridge = agentBridge {
      Task { await bridge.stop() }
    }
    agentBridge = nil
    view.needsLayout = true
    startTextEditing()
  }

  func resizeAgentPanel(by delta: Double) {
    let maximum = max(300, view.bounds.width - workspaceContentInset - 420)
    agentPanelWidth = min(max(agentPanelWidth + delta, 300), maximum)
    AppPreferences.Window.agentPanelWidth = agentPanelWidth
    view.needsLayout = true
  }

  func detectAndStartAgent() {
    agentStartupTask?.cancel()
    agentPanelView?.setStatus(Localized.Agent.detecting)
    agentStartupTask = Task { @MainActor [weak self] in
      guard let self else { return }
      let statuses = await LocalAgentBridge.detectProviders()
      guard !Task.isCancelled, agentPanelVisible else { return }
      agentProviderStatuses = statuses
      agentPanelView?.setProviders(statuses)
      guard statuses.contains(where: \.isInstalled) else {
        agentPanelView?.setStatus(Localized.Agent.noneInstalled)
        return
      }
      if statuses.first(where: { $0.provider == agentProvider })?.isInstalled != true,
         let fallback = statuses.first(where: \.isInstalled)?.provider {
        agentProvider = fallback
        agentPanelView?.selectedProvider = fallback
      }
      startAgent(provider: agentProvider)
    }
  }

  func startAgent(provider: LocalAgentProviderID) {
    agentStartupTask?.cancel()
    agentEventTask?.cancel()
    if let bridge = agentBridge {
      Task { await bridge.stop() }
    }
    agentBridge = nil
    agentPanelView?.setBusy(false)
    guard let executableURL = agentProviderStatuses.first(where: { $0.provider == provider })?.executableURL else {
      agentPanelView?.setStatus(Localized.Agent.noneInstalled)
      return
    }
    guard let workspaceSession, workspaceSession.isAuthorized,
          let helperExecutableURL = Bundle.main.executableURL else {
      agentPanelView?.setStatus(Localized.Workspace.chooseFolderDescription)
      return
    }
    let workspaceURL = workspaceSession.rootURL

    agentStartupTask = Task { @MainActor [weak self] in
      guard let self else { return }
      do {
        let server: LocalMCPUnixServer
        if let existing = agentMCPServer {
          server = existing
        } else {
          server = try await LocalMCPUnixServer.start(workspaceURL: workspaceURL)
          guard !Task.isCancelled else {
            server.stop()
            return
          }
          agentMCPServer = server
        }
        let bridge = LocalAgentBridge()
        agentBridge = bridge
        agentEventTask = Task { @MainActor [weak self] in
          for await event in bridge.events {
            guard let self, agentPanelVisible else { return }
            handleAgentEvent(event)
          }
        }
        let configuration = LocalAgentMCPConfiguration(
          helperExecutableURL: helperExecutableURL,
          connection: server.connectionInfo,
          configurationDirectory: server.connectionInfo.capabilityFileURL.deletingLastPathComponent()
        )
        try await bridge.start(
          provider: provider,
          executableURL: executableURL,
          workspaceURL: workspaceURL,
          mcp: configuration,
          applicationVersion: Bundle.main.object(
            forInfoDictionaryKey: "CFBundleShortVersionString"
          ) as? String ?? "development"
        )
      } catch {
        agentPanelView?.setBusy(false)
        agentPanelView?.setStatus(loginGuidance(for: provider, error: error))
      }
    }
  }

  func submitAgentPrompt(_ prompt: String) {
    guard let bridge = agentBridge else {
      startAgent(provider: agentProvider)
      return
    }
    agentPanelView?.beginRequest(prompt)
    agentPanelView?.setBusy(true)
    Task { @MainActor [weak self] in
      do {
        try await bridge.send(prompt)
      } catch {
        self?.agentPanelView?.setBusy(false)
        self?.agentPanelView?.setStatus(error.localizedDescription)
      }
    }
  }

  func handleAgentEvent(_ event: LocalAgentEvent) {
    switch event {
    case let .status(value):
      agentPanelView?.setStatus(value)
    case let .output(value):
      agentPanelView?.appendOutput(value)
    case let .approval(approval):
      agentPanelView?.showApproval(approval)
    case .completed:
      agentPanelView?.setBusy(false)
      agentPanelView?.setStatus(agentProvider.displayName)
    case let .error(value):
      agentPanelView?.setBusy(false)
      agentPanelView?.setStatus(value)
    }
  }

  func insertAgentDraft() {
    guard let text = agentDraftText else { return }
    let action = AgentDraftActionV1(
      kind: .insertCurrentDocument,
      provider: agentProvider,
      text: text
    )
    Task { @MainActor [weak self] in
      guard let self else { return }
      let current = (try? await bridge.selection.getText()) ?? ""
      guard await reviewAgentDraft(action, current: current) else { return }
      bridge.core.replaceText(text: action.text, granularity: .selection)
      recordAgentDraft(action)
    }
  }

  func saveAgentDraft(reference: Bool) {
    guard let text = agentDraftText else { return }
    let generatedText: String
    let kind: AgentDraftActionV1.Kind
    if reference {
      generatedText = """
      ---
      type: Reference
      sources:
        - provider: \(agentProvider.rawValue)
          transport: local-cli
      generated: \(Date().ISO8601Format())
      ---

      \(text)
      """
      kind = .saveReferenceSnapshot
    } else {
      generatedText = text
      kind = .createMarkdown
    }
    let action = AgentDraftActionV1(kind: kind, provider: agentProvider, text: generatedText)
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.markdown]
    panel.nameFieldStringValue = reference ? "Agent Reference.md" : "Agent Draft.md"
    let workspaceURL = workspaceSession?.isAuthorized == true ? workspaceSession?.rootURL : nil
    panel.directoryURL = workspaceURL
    Task { @MainActor [weak self] in
      guard let self, await presentSheetModal(panel) == .OK, let url = panel.url else { return }
      guard let workspaceURL, isAgentDraftURL(url, inside: workspaceURL) else {
        showAgentError(Localized.Agent.workspaceOnly)
        return
      }
      guard await reviewAgentDraft(action, current: "") else { return }
      do {
        try action.text.write(to: url, atomically: true, encoding: .utf8)
        recordAgentDraft(action)
        NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { _, _, _ in }
      } catch {
        showAgentError(error.localizedDescription)
      }
    }
  }

  var agentDraftText: String? {
    guard let value = agentPanelView?.outputText.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty else {
      return nil
    }
    return value
  }

  func reviewAgentDraft(_ action: AgentDraftActionV1, current: String) async -> Bool {
    let alert = NSAlert()
    alert.alertStyle = .informational
    alert.messageText = Localized.Agent.review
    alert.informativeText = "\(action.provider.displayName) · \(action.createdAt.formatted())"
    alert.addButton(withTitle: Localized.Agent.apply)
    alert.addButton(withTitle: Localized.General.cancel)

    let scroll = NSScrollView(frame: CGRect(x: 0, y: 0, width: 620, height: 300))
    scroll.hasVerticalScroller = true
    scroll.hasHorizontalScroller = true
    scroll.borderType = .bezelBorder
    let diff = NSTextView(frame: scroll.bounds)
    diff.isEditable = false
    diff.isRichText = true
    diff.textContainerInset = NSSize(width: 10, height: 10)
    let value = NSMutableAttributedString()
    value.append(NSAttributedString(string: "--- Current\n", attributes: diffAttributes(.systemRed)))
    for line in current.split(separator: "\n", omittingEmptySubsequences: false) {
      value.append(NSAttributedString(string: "- \(line)\n", attributes: diffAttributes(.systemRed)))
    }
    value.append(NSAttributedString(string: "+++ Agent Draft\n", attributes: diffAttributes(.systemGreen)))
    for line in action.text.split(separator: "\n", omittingEmptySubsequences: false) {
      value.append(NSAttributedString(string: "+ \(line)\n", attributes: diffAttributes(.systemGreen)))
    }
    diff.textStorage?.setAttributedString(value)
    scroll.documentView = diff
    alert.accessoryView = scroll
    let response = if let window = view.window {
      await alert.beginSheetModal(for: window)
    } else {
      alert.runModal()
    }
    return response == .alertFirstButtonReturn
  }

  func diffAttributes(_ color: NSColor) -> [NSAttributedString.Key: Any] {
    [
      .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular),
      .foregroundColor: color,
    ]
  }

  func recordAgentDraft(_ action: AgentDraftActionV1) {
    guard let workspaceSession, workspaceSession.isAuthorized,
          let data = try? JSONEncoder.agentDraftEncoder.encode(action) else {
      return
    }
    let rootURL = workspaceSession.rootURL
    let directory = rootURL.appending(path: ".ksamint", directoryHint: .isDirectory)
    let url = directory.appending(path: "agent-drafts.jsonl", directoryHint: .notDirectory)
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var line = data
    line.append(0x0A)
    if !FileManager.default.fileExists(atPath: url.path) {
      try? line.write(to: url, options: [.atomic, .completeFileProtection])
      return
    }
    guard let handle = try? FileHandle(forWritingTo: url) else { return }
    defer { try? handle.close() }
    try? handle.seekToEnd()
    try? handle.write(contentsOf: line)
  }

  func loginGuidance(for provider: LocalAgentProviderID, error: Error) -> String {
    let detail = error.localizedDescription
    if detail.localizedCaseInsensitiveContains("unauthorized")
      || detail.localizedCaseInsensitiveContains("login")
      || detail.localizedCaseInsensitiveContains("auth") {
      return provider == .codex
        ? "Codex is not signed in. Run ‘codex login’ in Terminal, then reopen this panel."
        : "Claude Code is not signed in. Run ‘claude auth login’ in Terminal, then reopen this panel."
    }
    return detail
  }

  func showAgentError(_ message: String) {
    Task { @MainActor [weak self] in
      guard let self else { return }
      _ = await showAlert(
        title: Localized.Agent.panel,
        message: message,
        buttons: [Localized.General.done]
      )
    }
  }

  func isAgentDraftURL(_ url: URL, inside workspaceURL: URL) -> Bool {
    let root = workspaceURL.resolvingSymlinksInPath().standardizedFileURL
    let parent = url.deletingLastPathComponent().resolvingSymlinksInPath().standardizedFileURL
    return parent.path == root.path || parent.path.hasPrefix(root.path + "/")
  }
}

private extension JSONEncoder {
  static var agentDraftEncoder: JSONEncoder {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return encoder
  }
}
