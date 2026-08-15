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
  var isPinned: Bool
  var tagIDs: [String]

  init(
    id: String,
    capturedAt: Date,
    sourceName: String?,
    sourceBundleID: String?,
    content: String,
    category: ClipboardContentCategory,
    isPinned: Bool = false,
    tagIDs: [String] = []
  ) {
    self.id = id
    self.capturedAt = capturedAt
    self.sourceName = sourceName
    self.sourceBundleID = sourceBundleID
    self.content = content
    self.category = category
    self.isPinned = isPinned
    self.tagIDs = tagIDs
  }

  private enum CodingKeys: String, CodingKey {
    case id, capturedAt, sourceName, sourceBundleID, content, category, isPinned, tagIDs
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    capturedAt = try container.decode(Date.self, forKey: .capturedAt)
    sourceName = try container.decodeIfPresent(String.self, forKey: .sourceName)
    sourceBundleID = try container.decodeIfPresent(String.self, forKey: .sourceBundleID)
    content = try container.decode(String.self, forKey: .content)
    category = try container.decode(ClipboardContentCategory.self, forKey: .category)
    isPinned = try container.decodeIfPresent(Bool.self, forKey: .isPinned) ?? false
    tagIDs = try container.decodeIfPresent([String].self, forKey: .tagIDs) ?? []
  }
}

struct ClipboardUserTag: Codable, Equatable, Identifiable {
  let id: String
  var name: String
}

private struct ClipboardHistoryArchive: Codable {
  let version: Int
  var items: [ClipboardHistoryItem]
  var tags: [ClipboardUserTag]
}

@MainActor
final class ClipboardHistoryStore {
  private static let maximumRecentItems = 100
  private static let maximumPinnedItems = 100
  private static let maximumTags = 32
  private static let maximumTagNameLength = 40
  private static let maximumItemBytes = 256 * 1024
  private static let retention: TimeInterval = 7 * 24 * 60 * 60
  private static let keyService = "art.apuch.ksamint-markedit.clipboard-history"
  private static let keyAccount = "clipboard-history-v1"

  private let overrideFileURL: URL?
  private let overrideKey: SymmetricKey?
  private(set) var items = [ClipboardHistoryItem]()
  private(set) var tags = [ClipboardUserTag]()

  init(fileURL: URL? = nil, key: SymmetricKey? = nil) {
    overrideFileURL = fileURL
    overrideKey = key
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
    let existing = items.first { $0.id == digest }
    let item = ClipboardHistoryItem(
      id: digest,
      capturedAt: Date(),
      sourceName: sourceName,
      sourceBundleID: sourceBundleID,
      content: normalized,
      category: Self.category(for: normalized, hasFiles: hasFiles),
      isPinned: existing?.isPinned ?? false,
      tagIDs: existing?.tagIDs ?? []
    )
    items.removeAll { $0.id == digest }
    items.insert(item, at: 0)
    trimRecentItems()
    persist()
    return true
  }

  func createTag(named proposedName: String) -> ClipboardUserTag? {
    guard let name = normalizedTagName(proposedName) else { return nil }
    if let existing = tags.first(where: { equivalentTagNames($0.name, name) }) {
      return existing
    }
    guard tags.count < Self.maximumTags else { return nil }
    let tag = ClipboardUserTag(id: UUID().uuidString.lowercased(), name: name)
    tags.append(tag)
    persist()
    return tag
  }

  @discardableResult
  func renameTag(id: String, to proposedName: String) -> Bool {
    guard let name = normalizedTagName(proposedName),
          !tags.contains(where: { $0.id != id && equivalentTagNames($0.name, name) }),
          let index = tags.firstIndex(where: { $0.id == id }) else { return false }
    tags[index].name = name
    persist()
    return true
  }

  func deleteTag(id: String) {
    guard tags.contains(where: { $0.id == id }) else { return }
    tags.removeAll { $0.id == id }
    for index in items.indices {
      items[index].tagIDs.removeAll { $0 == id }
    }
    persist()
  }

  @discardableResult
  func togglePinned(itemID: String) -> Bool? {
    guard let index = items.firstIndex(where: { $0.id == itemID }) else { return nil }
    if !items[index].isPinned,
       items.filter(\.isPinned).count >= Self.maximumPinnedItems {
      return nil
    }
    items[index].isPinned.toggle()
    let result = items[index].isPinned
    persist()
    return result
  }

  @discardableResult
  func toggleTag(_ tagID: String, for itemID: String) -> Bool? {
    guard tags.contains(where: { $0.id == tagID }),
          let index = items.firstIndex(where: { $0.id == itemID }) else { return nil }
    if let tagIndex = items[index].tagIDs.firstIndex(of: tagID) {
      items[index].tagIDs.remove(at: tagIndex)
      persist()
      return false
    }
    items[index].tagIDs.append(tagID)
    persist()
    return true
  }

  func tagNames(for item: ClipboardHistoryItem) -> [String] {
    let selected = Set(item.tagIDs)
    return tags.filter { selected.contains($0.id) }.map(\.name)
  }

  func clear() {
    items.removeAll()
    persist()
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
    items.removeAll { !$0.isPinned && $0.capturedAt < cutoff }
    trimRecentItems()
    if items.count != originalCount { persist() }
  }

  func load() {
    guard let fileURL = try? historyFileURL(),
          let encrypted = try? Data(contentsOf: fileURL),
          let sealed = try? AES.GCM.SealedBox(combined: encrypted),
          let plaintext = try? AES.GCM.open(sealed, using: historyKey())
    else { return }
    if let archive = try? JSONDecoder().decode(ClipboardHistoryArchive.self, from: plaintext) {
      items = archive.items
      tags = Array(archive.tags.prefix(Self.maximumTags))
    } else if let legacyItems = try? JSONDecoder().decode([ClipboardHistoryItem].self, from: plaintext) {
      items = legacyItems
      tags = []
    }
    let validTagIDs = Set(tags.map(\.id))
    for index in items.indices {
      items[index].tagIDs = items[index].tagIDs.filter(validTagIDs.contains)
    }
    trimRecentItems()
  }

  func persist() {
    do {
      let fileURL = try historyFileURL()
      try FileManager.default.createDirectory(
        at: fileURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      let archive = ClipboardHistoryArchive(version: 2, items: items, tags: tags)
      let plaintext = try JSONEncoder().encode(archive)
      let sealed = try AES.GCM.seal(plaintext, using: historyKey())
      guard let combined = sealed.combined else { return }
      try combined.write(to: fileURL, options: [.atomic, .completeFileProtectionUnlessOpen])
    } catch {
      // Clipboard monitoring must never interrupt copying or the host app.
    }
  }

  func historyFileURL() throws -> URL {
    if let overrideFileURL { return overrideFileURL }
    let baseURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
    ) ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return baseURL
      .appending(path: "ClipboardHistory", directoryHint: .isDirectory)
      .appending(path: "history-v1.ksc")
  }

  func historyKey() throws -> SymmetricKey {
    if let overrideKey { return overrideKey }
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

  func trimRecentItems() {
    var recentCount = 0
    items = items.filter { item in
      if item.isPinned { return true }
      recentCount += 1
      return recentCount <= Self.maximumRecentItems
    }
  }

  func normalizedTagName(_ proposedName: String) -> String? {
    let value = proposedName
      .precomposedStringWithCompatibilityMapping
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else { return nil }
    return String(value.prefix(Self.maximumTagNameLength))
  }

  func equivalentTagNames(_ lhs: String, _ rhs: String) -> Bool {
    lhs.compare(rhs, options: [.caseInsensitive, .diacriticInsensitive], locale: .current) == .orderedSame
  }
}
