import AppKit
import CryptoKit
import Security
import ServiceManagement

@MainActor
// The capture concerns are extracted into document and queue modules in the
// immediately following system-integration change.
// swiftlint:disable:next type_body_length
final class ConversationCaptureCoordinator: NSObject {
  static let shared = ConversationCaptureCoordinator()
  static let agentArgument = "--conversation-capture-agent"

  private static let maximumClipboardBytes = 5 * 1024 * 1024
  private static let pendingRetention: TimeInterval = 30 * 24 * 60 * 60
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

  func configureFromPreferences() {
    guard AppPreferences.General.conversationCaptureEnabled else { return }
    if !registerLoginAgent() {
      start()
    }
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
      if !registerLoginAgent() {
        start()
      }
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
    ((try? FileManager.default.contentsOfDirectory(
      at: pendingDirectory,
      includingPropertiesForKeys: nil,
      options: [.skipsHiddenFiles]
    )) ?? []).filter { $0.pathExtension == "ksc" }.count
  }

  func showInbox() {
    reviewNextPendingCapture()
  }

  private func start() {
    guard timer == nil else { return }
    lastChangeCount = NSPasteboard.general.changeCount
    installStatusItem()
    purgeExpiredPendingCaptures()
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
    guard text.precomposedStringWithCompatibilityMapping.count >= 200 else { return false }
    let roles = turns(in: text).map(\.role)
    return roles.count >= 2 && roles.contains("user") && roles.contains("assistant")
  }

  @discardableResult
  private func saveConversation(_ text: String, sourceName: String?, sourceBundleID: String?) -> Bool {
    guard let rootURL = authorizedWorkspaceRoot() else {
      savePending(text, sourceName: sourceName, sourceBundleID: sourceBundleID)
      return false
    }
    defer { rootURL.stopAccessingSecurityScopedResource() }
    let normalized = normalize(text)
    let digest = sha256(normalized)
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
      let markdown = conversationMarkdown(
        normalized,
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

  private func conversationMarkdown(
    _ text: String,
    digest: String,
    sourceName: String?,
    sourceBundleID: String?
  ) -> String {
    let now = ISO8601DateFormatter().string(from: Date())
    let source = sourceName ?? "Clipboard"
    var output = """
    ---
    type: Conversation
    source: "clipboard"
    imported_at: \(now)
    message_count: \(turns(in: text).count)
    content_digest: \(digest)
    category: "Conversations/Clipboard"
    tags: ["conversation", "clipboard"]
    captured_from: \(jsonString(source))
    """
    if let sourceBundleID {
      output += "\ncaptured_bundle_id: \(jsonString(sourceBundleID))"
    }
    output += "\n---\n\n# \(source) conversation\n\n"
    let capturedTurns = turns(in: text)
    if capturedTurns.isEmpty {
      output += messageMarkdown(role: "unknown", content: text)
    } else {
      output += capturedTurns.map { messageMarkdown(role: $0.role, content: $0.content) }.joined()
    }
    return output + "\n"
  }

  private func messageMarkdown(role: String, content: String) -> String {
    let digest = sha256("\(role)\n\(normalize(content))")
    let marker = ["id": digest, "digest": digest, "role": role]
    let markerData = try? JSONSerialization.data(withJSONObject: marker, options: [.sortedKeys])
    let encoded = markerData?.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "") ?? ""
    return "<!-- ksamint-message-v1 \(encoded) -->\n## \(role.capitalized)\n\n\(content.trimmingCharacters(in: .whitespacesAndNewlines))\n\n"
  }

  private func turns(in text: String) -> [CapturedTurn] {
    let pattern = #"(?im)^(?:#{1,4}\s*)?(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)\s*(?:(?:·|said)[^\n:]*)?:\s*|^(?:#{1,4}\s+)(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)(?:\s*(?:·|said)[^\n]*)?\s*$"#
    guard let expression = try? NSRegularExpression(pattern: pattern) else { return [] }
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    let matches = expression.matches(in: text, range: range)
    return matches.enumerated().compactMap { index, match in
      guard let markerRange = Range(match.range, in: text) else { return nil }
      let roleRange = match.range(at: 1).location != NSNotFound ? match.range(at: 1) : match.range(at: 2)
      guard let roleStringRange = Range(roleRange, in: text) else { return nil }
      let contentEnd = index + 1 < matches.count ? matches[index + 1].range.location : range.length
      let contentRange = NSRange(location: match.range.location + match.range.length, length: contentEnd - match.range.location - match.range.length)
      guard let stringContentRange = Range(contentRange, in: text) else { return nil }
      let role = canonicalRole(String(text[roleStringRange]))
      let content = String(text[stringContentRange]).trimmingCharacters(in: .whitespacesAndNewlines)
      _ = markerRange
      return content.isEmpty ? nil : CapturedTurn(role: role, content: content)
    }
  }

  private func canonicalRole(_ value: String) -> String {
    switch value.lowercased() {
    case "user", "human", "you": "user"
    case "assistant", "claude", "chatgpt": "assistant"
    case "system": "system"
    case "tool": "tool"
    default: "unknown"
    }
  }

  private func savePending(_ text: String, sourceName: String?, sourceBundleID: String?) {
    do {
      let directory = pendingDirectory
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let capture = PendingCapture(
        capturedAt: Date(),
        sourceName: sourceName,
        sourceBundleID: sourceBundleID,
        content: text
      )
      let data = try JSONEncoder().encode(capture)
      let sealed = try AES.GCM.seal(data, using: pendingKey())
      guard let combined = sealed.combined else { throw CaptureError.encryption }
      try combined.write(
        to: directory.appending(path: "\(UUID().uuidString).ksc"),
        options: [.atomic, .completeFileProtectionUnlessOpen]
      )
      updateStatusMenu()
    } catch {
      NSSound.beep()
    }
  }

  private func purgeExpiredPendingCaptures() {
    let cutoff = Date().addingTimeInterval(-Self.pendingRetention)
    let urls = (try? FileManager.default.contentsOfDirectory(
      at: pendingDirectory,
      includingPropertiesForKeys: [.contentModificationDateKey],
      options: [.skipsHiddenFiles]
    )) ?? []
    for url in urls {
      let modified = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
      if modified.map({ $0 < cutoff }) == true { try? FileManager.default.removeItem(at: url) }
    }
  }

  private func pendingKey() throws -> SymmetricKey {
    let service = "art.apuch.ksamint-markedit.conversation-capture"
    let account = "pending-queue-v1"
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
    ]
    var result: CFTypeRef?
    if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
       let data = result as? Data, data.count == 32 {
      return SymmetricKey(data: data)
    }
    let data = Data(SymmetricKey(size: .bits256).withUnsafeBytes(Array.init))
    let add: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      kSecValueData as String: data,
    ]
    guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw CaptureError.keychain }
    return SymmetricKey(data: data)
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
    purgeExpiredPendingCaptures()
    guard let url = pendingCaptureURLs().first else {
      if let root = authorizedWorkspaceRoot() {
        let folder = root.appending(path: "Conversations", directoryHint: .isDirectory)
        root.stopAccessingSecurityScopedResource()
        NSWorkspace.shared.open(folder)
      }
      return
    }
    guard let capture = decryptPendingCapture(at: url) else {
      try? FileManager.default.removeItem(at: url)
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
        try? FileManager.default.removeItem(at: url)
        reviewNextPendingCapture()
      }
    case .alertThirdButtonReturn:
      try? FileManager.default.removeItem(at: url)
      reviewNextPendingCapture()
    default:
      break
    }
  }

  private func pendingCaptureURLs() -> [URL] {
    ((try? FileManager.default.contentsOfDirectory(
      at: pendingDirectory,
      includingPropertiesForKeys: [.contentModificationDateKey],
      options: [.skipsHiddenFiles]
    )) ?? [])
      .filter { $0.pathExtension == "ksc" }
      .sorted {
        let left = try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        let right = try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        return (left ?? .distantPast) < (right ?? .distantPast)
      }
  }

  private func decryptPendingCapture(at url: URL) -> PendingCapture? {
    guard let data = try? Data(contentsOf: url),
          let box = try? AES.GCM.SealedBox(combined: data),
          let plaintext = try? AES.GCM.open(box, using: pendingKey()),
          let capture = try? JSONDecoder().decode(PendingCapture.self, from: plaintext) else { return nil }
    return capture
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
    let service = SMAppService.agent(plistName: "art.apuch.ksamint-markedit.conversation-capture.plist")
    do {
      if service.status == .notRegistered { try service.register() }
      return service.status == .enabled || service.status == .requiresApproval
    } catch {
      return false
    }
  }

  private func unregisterLoginAgent() {
    guard #available(macOS 13, *) else { return }
    let service = SMAppService.agent(
      plistName: "art.apuch.ksamint-markedit.conversation-capture.plist"
    )
    try? service.unregister()
  }

  private var pendingDirectory: URL {
    URL.applicationSupportDirectory
      .appending(path: "ksamint MarkEdit", directoryHint: .isDirectory)
      .appending(path: "ConversationInbox/Pending", directoryHint: .isDirectory)
  }

  private func normalize(_ value: String) -> String {
    value
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")
      .precomposedStringWithCompatibilityMapping
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func sha256(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  private func jsonString(_ value: String) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: [value]),
          let array = String(data: data, encoding: .utf8) else { return "\"\"" }
    return String(array.dropFirst().dropLast())
  }
}

private struct CapturedTurn {
  let role: String
  let content: String
}

private struct PendingCapture: Codable {
  let capturedAt: Date
  let sourceName: String?
  let sourceBundleID: String?
  let content: String
}

private enum CaptureError: Error {
  case encryption
  case keychain
}

private extension Notification.Name {
  static let conversationCaptureDisabled = Notification.Name(
    "art.apuch.ksamint-markedit.conversation-capture-disabled"
  )
}
