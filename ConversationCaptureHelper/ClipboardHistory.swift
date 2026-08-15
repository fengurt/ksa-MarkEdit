import AppKit
import CryptoKit
import Security

enum ClipboardContentCategory: String, Codable, CaseIterable {
  case text
  case link
  case code
  case file

  var localizedTitle: String {
    switch self {
    case .text: String(localized: "Text")
    case .link: String(localized: "Links")
    case .code: String(localized: "Code")
    case .file: String(localized: "Files")
    }
  }

  var systemImage: String {
    switch self {
    case .text: "text.alignleft"
    case .link: "link"
    case .code: "chevron.left.forwardslash.chevron.right"
    case .file: "doc"
    }
  }
}
struct ClipboardHistoryItem: Codable, Equatable, Identifiable {
  let id: String
  let capturedAt: Date
  let sourceName: String?
  let sourceBundleID: String?
  let content: String
  let category: ClipboardContentCategory
}

@MainActor
final class ClipboardHistoryStore {
  private static let maximumItems = 100
  private static let maximumItemBytes = 256 * 1024
  private static let retention: TimeInterval = 7 * 24 * 60 * 60
  private static let keyService = "art.apuch.ksamint-markedit.clipboard-history"
  private static let keyAccount = "clipboard-history-v1"

  private(set) var items = [ClipboardHistoryItem]()

  init() {
    load()
    purgeExpired()
  }

  @discardableResult
  func record(
    content: String,
    sourceName: String?,
    sourceBundleID: String?,
    hasFiles: Bool
  ) -> Bool {
    let normalized = content
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")
      .precomposedStringWithCompatibilityMapping
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard let data = normalized.data(using: .utf8),
          !data.isEmpty,
          data.count <= Self.maximumItemBytes else { return false }

    let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    let item = ClipboardHistoryItem(
      id: digest,
      capturedAt: Date(),
      sourceName: sourceName,
      sourceBundleID: sourceBundleID,
      content: normalized,
      category: Self.category(for: normalized, hasFiles: hasFiles)
    )
    items.removeAll { $0.id == digest }
    items.insert(item, at: 0)
    if items.count > Self.maximumItems {
      items.removeLast(items.count - Self.maximumItems)
    }
    persist()
    return true
  }

  func clear() {
    items.removeAll()
    if let fileURL = try? historyFileURL() {
      try? FileManager.default.removeItem(at: fileURL)
    }
  }

  static func category(for content: String, hasFiles: Bool) -> ClipboardContentCategory {
    if hasFiles { return .file }

    let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
    if let url = URL(string: trimmed),
       let scheme = url.scheme?.lowercased(),
       ["http", "https", "mailto"].contains(scheme),
       !trimmed.contains(where: \.isWhitespace) {
      return .link
    }

    let codeSignals = ["```", "func ", "class ", "struct ", "import ", "const ", "let ", "var ", "=>", "</", "#!/"]
    let hasCodeSignal = codeSignals.contains { trimmed.contains($0) }
    let codePunctuation = trimmed.filter { "{}[]();=<>".contains($0) }.count
    if hasCodeSignal || (trimmed.contains("\n") && codePunctuation >= 4) {
      return .code
    }
    return .text
  }
}

private extension ClipboardHistoryStore {
  func purgeExpired() {
    let cutoff = Date().addingTimeInterval(-Self.retention)
    let originalCount = items.count
    items.removeAll { $0.capturedAt < cutoff }
    if items.count != originalCount { persist() }
  }

  func load() {
    guard let fileURL = try? historyFileURL(),
          let encrypted = try? Data(contentsOf: fileURL),
          let sealed = try? AES.GCM.SealedBox(combined: encrypted),
          let plaintext = try? AES.GCM.open(sealed, using: historyKey()),
          let decoded = try? JSONDecoder().decode([ClipboardHistoryItem].self, from: plaintext)
    else { return }
    items = Array(decoded.prefix(Self.maximumItems))
  }

  func persist() {
    do {
      let fileURL = try historyFileURL()
      try FileManager.default.createDirectory(
        at: fileURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      let plaintext = try JSONEncoder().encode(items)
      let sealed = try AES.GCM.seal(plaintext, using: historyKey())
      guard let combined = sealed.combined else { return }
      try combined.write(to: fileURL, options: [.atomic, .completeFileProtectionUnlessOpen])
    } catch {
      // Clipboard monitoring must never interrupt copying or the host app.
    }
  }

  func historyFileURL() throws -> URL {
    let baseURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
    ) ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return baseURL
      .appending(path: "ClipboardHistory", directoryHint: .isDirectory)
      .appending(path: "history-v1.ksc")
  }

  func historyKey() throws -> SymmetricKey {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: Self.keyService,
      kSecAttrAccount as String: Self.keyAccount,
      kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    if SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
       let data = item as? Data,
       data.count == 32 {
      return SymmetricKey(data: data)
    }

    let data = Data(SymmetricKey(size: .bits256).withUnsafeBytes(Array.init))
    var add = query
    add.removeValue(forKey: kSecReturnData as String)
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    add[kSecValueData as String] = data
    let status = SecItemAdd(add as CFDictionary, nil)
    if status == errSecSuccess { return SymmetricKey(data: data) }
    if status == errSecDuplicateItem {
      var existing: CFTypeRef?
      if SecItemCopyMatching(query as CFDictionary, &existing) == errSecSuccess,
         let existingData = existing as? Data,
         existingData.count == 32 {
        return SymmetricKey(data: existingData)
      }
    }
    throw CocoaError(.fileWriteNoPermission)
  }
}
