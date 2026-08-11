import AppKit
import ServiceManagement

@MainActor
final class ConversationCaptureCoordinator: NSObject {
  static let shared = ConversationCaptureCoordinator()
  static let agentArgument = "--conversation-capture-agent"

  private static let maximumClipboardBytes = 5 * 1024 * 1024
  private static let passwordManagerBundleIDs = [
    "com.1password.1password",
    "com.agilebits.onepassword7",
    "com.bitwarden.desktop",
    "com.apple.Passwords",
    "com.lastpass.LastPass",
  ]

  private var timer: Timer?
  private var statusItem: NSStatusItem?
  private var lastChangeCount = NSPasteboard.general.changeCount
  private var idlePolls = 0
  private var captureNextCopy = false
  private var lastSavedURL: URL?
  private var isAgentProcess = false
  private let documentCodec = ConversationCaptureDocument()
  private let pendingQueue = ConversationCaptureQueue()

  func configureFromPreferences() {
    synchronizeHelperConfiguration()
    guard AppPreferences.General.conversationCaptureEnabled else { return }
    _ = registerLoginAgent()
  }

  func startAgentProcess() {
    isAgentProcess = true
    DistributedNotificationCenter.default().addObserver(
      self,
      selector: #selector(stopAgentProcess),
      name: .conversationCaptureDisabled,
      object: nil
    )
    start()
  }

  func setEnabled(_ enabled: Bool, updatePreference: Bool = true) {
    if updatePreference {
      AppPreferences.General.conversationCaptureEnabled = enabled
    }
    if enabled {
      synchronizeHelperConfiguration()
      _ = registerLoginAgent()
    } else {
      timer?.invalidate()
      timer = nil
      if let statusItem {
        NSStatusBar.system.removeStatusItem(statusItem)
        self.statusItem = nil
      }
      unregisterLoginAgent()
      DistributedNotificationCenter.default().post(name: .conversationCaptureDisabled, object: nil)
      if isAgentProcess { NSApp.terminate(nil) }
    }
  }

  var pendingCount: Int {
    pendingQueue.count
  }

  func showInbox() {
    reviewNextPendingCapture()
  }

  func importConversationResources(_ urls: [URL]) throws {
    var imported = false
    for url in urls where !url.hasDirectoryPath {
      let values = try url.resourceValues(forKeys: [.fileSizeKey])
      guard (values.fileSize ?? 0) <= Self.maximumClipboardBytes else { continue }
      guard let text = try? String(contentsOf: url, encoding: .utf8) else { continue }
      imported = saveConversation(text, sourceName: url.lastPathComponent, sourceBundleID: nil) || imported
    }
    if !imported { throw CocoaError(.fileReadUnsupportedScheme) }
  }

  private func start() {
    guard timer == nil else { return }
    lastChangeCount = NSPasteboard.general.changeCount
    installStatusItem()
    pendingQueue.purgeExpired()
    schedulePoll(after: 0.75)
  }

  private func schedulePoll(after interval: TimeInterval) {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
      Task { @MainActor in self?.pollPasteboard() }
    }
  }

  private func pollPasteboard() {
    let pasteboard = NSPasteboard.general
    guard pasteboard.changeCount != lastChangeCount else {
      idlePolls += 1
      schedulePoll(after: idlePolls > 20 ? 2 : 0.75)
      return
    }
    lastChangeCount = pasteboard.changeCount
    idlePolls = 0
    defer { schedulePoll(after: 0.75) }

    guard let text = preferredText(from: pasteboard), shouldCapture(text) else { return }
    let application = NSWorkspace.shared.frontmostApplication
    let bundleID = application?.bundleIdentifier
    if !captureNextCopy, Self.passwordManagerBundleIDs.contains(bundleID ?? "") { return }

    let forced = captureNextCopy
    captureNextCopy = false
    updateStatusMenu()
    if !forced, isSensitive(text) { return }
    if forced || isHighConfidenceConversation(text) {
      _ = saveConversation(text, sourceName: application?.localizedName, sourceBundleID: bundleID)
    } else {
      savePending(text, sourceName: application?.localizedName, sourceBundleID: bundleID)
    }
  }

  private func preferredText(from pasteboard: NSPasteboard) -> String? {
    let value = attributedClipboardText(from: pasteboard, type: .html, documentType: .html)
      ?? attributedClipboardText(from: pasteboard, type: .rtf, documentType: .rtf)
      ?? pasteboard.string(forType: .string)
    guard let value, let size = value.data(using: .utf8)?.count,
          size > 0, size <= Self.maximumClipboardBytes else { return nil }
    return value
  }

  private func attributedClipboardText(
    from pasteboard: NSPasteboard,
    type: NSPasteboard.PasteboardType,
    documentType: NSAttributedString.DocumentType
  ) -> String? {
    guard let data = pasteboard.data(forType: type),
          let value = try? NSAttributedString(
            data: data,
            options: [.documentType: documentType],
            documentAttributes: nil
          ).string,
          !value.isEmpty else { return nil }
    return value
  }

  private func shouldCapture(_ text: String) -> Bool {
    captureNextCopy || text.trimmingCharacters(in: .whitespacesAndNewlines).count >= 80
  }

  private func isSensitive(_ text: String) -> Bool {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.range(of: #"^\d{4,8}$"#, options: .regularExpression) != nil { return true }
    if !trimmed.contains("\n"), trimmed.count >= 20 {
      let alphaNumeric = trimmed.filter { $0.isLetter || $0.isNumber }.count
      let unique = Set(trimmed).count
      if alphaNumeric == trimmed.count, unique > 14 { return true }
    }
    return false
  }

  private func isHighConfidenceConversation(_ text: String) -> Bool {
    documentCodec.isHighConfidenceConversation(text)
  }

  @discardableResult
  private func saveConversation(_ text: String, sourceName: String?, sourceBundleID: String?) -> Bool {
    guard let rootURL = authorizedWorkspaceRoot() else {
      savePending(text, sourceName: sourceName, sourceBundleID: sourceBundleID)
      return false
    }
    defer { rootURL.stopAccessingSecurityScopedResource() }
    let normalized = documentCodec.normalize(text)
    let digest = documentCodec.digest(normalized)
    let calendar = Calendar(identifier: .gregorian)
    let timeZone = TimeZone(secondsFromGMT: 0) ?? .current
    let parts = calendar.dateComponents(in: timeZone, from: Date())
    let directory = rootURL
      .appending(path: "Conversations", directoryHint: .isDirectory)
      .appending(path: String(format: "%04d", parts.year ?? 0), directoryHint: .isDirectory)
      .appending(path: String(format: "%02d", parts.month ?? 0), directoryHint: .isDirectory)
    let filename = "Captured--\(digest.prefix(12)).md"
    let fileURL = directory.appending(path: filename)
    guard !FileManager.default.fileExists(atPath: fileURL.path) else { return true }
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let markdown = documentCodec.markdown(
        for: normalized,
        digest: digest,
        sourceName: sourceName,
        sourceBundleID: sourceBundleID
      )
      try Data(markdown.utf8).write(to: fileURL, options: [.atomic, .completeFileProtectionUnlessOpen])
      lastSavedURL = fileURL
      updateStatusMenu()
      return true
    } catch {
      NSSound.beep()
      savePending(text, sourceName: sourceName, sourceBundleID: sourceBundleID)
      return false
    }
  }

  private func savePending(_ text: String, sourceName: String?, sourceBundleID: String?) {
    do {
      let capture = PendingConversationCapture(
        capturedAt: Date(),
        sourceName: sourceName,
        sourceBundleID: sourceBundleID,
        content: text
      )
      try pendingQueue.save(capture)
      updateStatusMenu()
    } catch {
      NSSound.beep()
    }
  }

  private func authorizedWorkspaceRoot() -> URL? {
    guard let bookmark = AppPreferences.General.workspaceFolderBookmark else { return nil }
    var stale = false
    guard let url = try? URL(
      resolvingBookmarkData: bookmark,
      options: [.withSecurityScope],
      relativeTo: nil,
      bookmarkDataIsStale: &stale
    ), url.startAccessingSecurityScopedResource() else { return nil }
    return url.standardizedFileURL
  }
}

private extension ConversationCaptureCoordinator {
  private func installStatusItem() {
    guard statusItem == nil else { return }
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    item.button?.image = NSImage(
      systemSymbolName: "text.bubble",
      accessibilityDescription: String(localized: "Conversation Inbox")
    )
    statusItem = item
    updateStatusMenu()
  }

  private func updateStatusMenu() {
    guard let statusItem else { return }
    let menu = NSMenu()
    let state = NSMenuItem(
      title: captureNextCopy
        ? String(localized: "Waiting for next copy…")
        : String(localized: "Conversation capture is on"),
      action: nil,
      keyEquivalent: ""
    )
    state.isEnabled = false
    menu.addItem(state)
    menu.addItem(
      withTitle: String(localized: "Capture Next Copy"),
      action: #selector(captureNext),
      keyEquivalent: ""
    )
      .target = self
    menu.addItem(
      withTitle: String(localized: "Open Conversation Inbox"),
      action: #selector(openInbox),
      keyEquivalent: ""
    )
      .target = self
    if lastSavedURL != nil {
      menu.addItem(
        withTitle: String(localized: "Undo Last Capture"),
        action: #selector(undoLastCapture),
        keyEquivalent: ""
      )
        .target = self
    }
    menu.addItem(.separator())
    menu.addItem(
      withTitle: String(localized: "Turn Off Conversation Capture"),
      action: #selector(turnOff),
      keyEquivalent: ""
    )
      .target = self
    statusItem.menu = menu
  }

  @objc private func captureNext() {
    captureNextCopy = true
    updateStatusMenu()
  }

  @objc private func openInbox() {
    reviewNextPendingCapture()
  }

  private func reviewNextPendingCapture() {
    pendingQueue.purgeExpired()
    guard let url = pendingQueue.urls.first else {
      if let root = authorizedWorkspaceRoot() {
        let folder = root.appending(path: "Conversations", directoryHint: .isDirectory)
        root.stopAccessingSecurityScopedResource()
        NSWorkspace.shared.open(folder)
      }
      return
    }
    guard let capture = pendingQueue.capture(at: url) else {
      pendingQueue.remove(url)
      reviewNextPendingCapture()
      return
    }

    NSApp.activate(ignoringOtherApps: true)
    let alert = NSAlert()
    alert.messageText = String(localized: "Review clipboard capture")
    let source = capture.sourceName ?? String(localized: "Unknown application")
    let preview = String(capture.content.prefix(1_500))
    alert.informativeText = "\(source) · \(capture.capturedAt.formatted())\n\n\(preview)"
    alert.addButton(withTitle: String(localized: "Save to Conversations"))
    alert.addButton(withTitle: String(localized: "Keep for Later"))
    alert.addButton(withTitle: String(localized: "Discard"))

    switch alert.runModal() {
    case .alertFirstButtonReturn:
      if saveConversation(
        capture.content,
        sourceName: capture.sourceName,
        sourceBundleID: capture.sourceBundleID
      ) {
        pendingQueue.remove(url)
        reviewNextPendingCapture()
      }
    case .alertThirdButtonReturn:
      pendingQueue.remove(url)
      reviewNextPendingCapture()
    default:
      break
    }
  }

  @objc private func undoLastCapture() {
    guard let url = lastSavedURL else { return }
    _ = try? FileManager.default.trashItem(at: url, resultingItemURL: nil)
    lastSavedURL = nil
    updateStatusMenu()
  }

  @objc private func turnOff() {
    setEnabled(false)
  }

  @objc private func stopAgentProcess() {
    guard isAgentProcess else { return }
    NSApp.terminate(nil)
  }

  @discardableResult
  private func registerLoginAgent() -> Bool {
    guard #available(macOS 13, *) else { return false }
    let service = SMAppService.loginItem(
      identifier: "art.apuch.ksamint-markedit.conversation-capture-helper"
    )
    do {
      if service.status == .notRegistered { try service.register() }
      switch service.status {
      case .enabled:
        return true
      case .requiresApproval:
        showLoginItemApprovalRequired()
        return false
      default:
        return false
      }
    } catch {
      return false
    }
  }

  private func unregisterLoginAgent() {
    guard #available(macOS 13, *) else { return }
    let service = SMAppService.loginItem(
      identifier: "art.apuch.ksamint-markedit.conversation-capture-helper"
    )
    try? service.unregister()
  }

  func synchronizeHelperConfiguration() {
    guard let defaults = UserDefaults(suiteName: "group.art.apuch.ksamint-markedit") else { return }
    defaults.set(AppPreferences.General.conversationCaptureEnabled, forKey: "conversationCaptureEnabled")
    defaults.set(AppPreferences.General.workspaceFolderBookmark, forKey: "workspaceBookmark")
    var paths = Set<String>()
    if let bookmark = AppPreferences.General.workspaceFolderBookmark {
      var stale = false
      if let url = try? URL(
        resolvingBookmarkData: bookmark,
        options: [.withSecurityScope],
        relativeTo: nil,
        bookmarkDataIsStale: &stale
      ) {
        paths.insert(url.standardizedFileURL.path)
      }
    }
    defaults.set(paths.sorted(), forKey: "workspacePaths")
    // The helper and Finder extension are intentionally scoped to the single
    // authorized workspace root, never every document bookmark the app knows.
    defaults.set(
      [AppPreferences.General.workspaceFolderBookmark].compactMap { $0 },
      forKey: "workspaceBookmarks"
    )
    DistributedNotificationCenter.default().post(name: .captureSettingsChanged, object: nil)
  }

  private func showLoginItemApprovalRequired() {
    let notification = NSUserNotification()
    notification.title = String(localized: "Enable Conversation Capture")
    notification.informativeText = String(
      localized: "Allow ksamint Conversation Capture in System Settings › General › Login Items."
    )
    NSUserNotificationCenter.default.deliver(notification)
    if let settings = URL(
      string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension"
    ) {
      NSWorkspace.shared.open(settings)
    }
  }
}

private extension Notification.Name {
  static let conversationCaptureDisabled = Notification.Name(
    "art.apuch.ksamint-markedit.conversation-capture-disabled"
  )
  static let captureSettingsChanged = Notification.Name(
    "art.apuch.ksamint.capture-settings-changed"
  )
}
