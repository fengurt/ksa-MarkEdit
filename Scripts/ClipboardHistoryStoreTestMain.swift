import CryptoKit
import Foundation

private struct LegacyClipboardItem: Encodable {
  let id: String
  let capturedAt: Date
  let sourceName: String?
  let sourceBundleID: String?
  let content: String
  let category: ClipboardContentCategory
}

private enum ClipboardHistoryTestError: Error {
  case failed(String)
}

@main
@MainActor
private struct ClipboardHistoryStoreTestMain {
  static func main() throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: "kmd-clipboard-history-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }

    let key = SymmetricKey(size: .bits256)
    let archiveURL = root.appending(path: "history.ksc")
    var store = ClipboardHistoryStore(fileURL: archiveURL, key: key)
    try expect(store.record(content: "ACME invoice 1001", sourceName: "Tests", sourceBundleID: nil, hasFiles: false), "records content")
    let invoice = try unwrap(store.createTag(named: " 发票信息 "), "creates a label")
    let duplicate = try unwrap(store.createTag(named: "发票信息"), "returns an existing normalized label")
    try expect(invoice.id == duplicate.id, "deduplicates equivalent labels")
    let itemID = try unwrap(store.items.first?.id, "creates a history item")
    try expect(store.toggleTag(invoice.id, for: itemID) == true, "assigns a label")
    try expect(store.togglePinned(itemID: itemID) == true, "pins an item")

    store = ClipboardHistoryStore(fileURL: archiveURL, key: key)
    var restored = try unwrap(store.items.first, "restores an encrypted item")
    try expect(restored.isPinned, "persists pin state")
    try expect(restored.tagIDs == [invoice.id], "persists label assignment")
    try expect(store.record(content: "ACME invoice 1001", sourceName: "Tests Again", sourceBundleID: nil, hasFiles: false), "re-records duplicate content")
    restored = try unwrap(store.items.first, "keeps the re-recorded item")
    try expect(restored.isPinned && restored.tagIDs == [invoice.id], "preserves metadata when content is copied again")

    try expect(store.renameTag(id: invoice.id, to: "公司信息"), "renames a label")
    try expect(store.tags.first?.name == "公司信息", "stores the renamed label")
    store.deleteTag(id: invoice.id)
    try expect(store.items.first?.tagIDs.isEmpty == true, "removes deleted label references")
    _ = store.createTag(named: "常用 Command")
    store.clear()
    try expect(store.items.isEmpty, "clears clipboard entries")
    try expect(store.tags.map(\.name) == ["常用 Command"], "keeps user labels when history is cleared")

    let legacyURL = root.appending(path: "legacy.ksc")
    let legacy = LegacyClipboardItem(
      id: "legacy",
      capturedAt: Date(),
      sourceName: "Legacy",
      sourceBundleID: nil,
      content: "legacy clipboard value",
      category: .text
    )
    let legacyPlaintext = try JSONEncoder().encode([legacy])
    let legacySealed = try AES.GCM.seal(legacyPlaintext, using: key)
    try unwrap(legacySealed.combined, "creates a legacy encrypted archive").write(to: legacyURL)
    let migrated = ClipboardHistoryStore(fileURL: legacyURL, key: key)
    try expect(migrated.items.first?.content == legacy.content, "migrates v1 item arrays")
    try expect(migrated.items.first?.isPinned == false, "defaults migrated pin state")
    try expect(migrated.items.first?.tagIDs.isEmpty == true, "defaults migrated labels")

    print("Clipboard history store tests passed.")
  }

  private static func expect(
    _ condition: @autoclosure () -> Bool,
    _ message: String
  ) throws {
    if !condition() { throw ClipboardHistoryTestError.failed(message) }
  }

  private static func unwrap<Value>(_ value: Value?, _ message: String) throws -> Value {
    guard let value else { throw ClipboardHistoryTestError.failed(message) }
    return value
  }
}
