import AppKit
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

// swiftlint:disable convenience_type
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

    let structured = "# 关键方案\n\n" + String(repeating: "- 中文 日本語 français documentation\n", count: 200)
    try expect(store.record(ClipboardHistoryCapture(
      content: structured,
      sourceName: "Safari",
      sourceBundleID: "com.apple.Safari",
      sourceURL: "https://example.com/session/42",
      sessionName: "Architecture discussion",
      hasFiles: false,
      hasRichText: true
    )), "records rich source metadata")
    let permanent = try unwrap(store.items.last, "stores structured content")
    try expect(permanent.isPermanent, "archives long formatted content permanently")
    try expect(permanent.sourceURL == "https://example.com/session/42", "persists a safe source URL")
    try expect(permanent.sessionName == "Architecture discussion", "persists the session name")

    store = ClipboardHistoryStore(fileURL: archiveURL, key: key)
    let restoredPermanent = try unwrap(store.items.first { $0.id == permanent.id }, "restores permanent content")
    try expect(restoredPermanent.isPermanent, "restores permanent status from the journal")
    try expect(restoredPermanent.sourceURL == permanent.sourceURL, "restores source context from the journal")

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
      capturedAt: Date(timeIntervalSince1970: 1_600_000_000),
      sourceName: "Legacy",
      sourceBundleID: nil,
      content: "legacy clipboard value",
      category: .text
    )
    let legacyPlaintext = try JSONEncoder().encode([legacy])
    let legacySealed = try AES.GCM.seal(legacyPlaintext, using: key)
    try unwrap(legacySealed.combined, "creates a legacy encrypted archive").write(to: legacyURL)
    let migratedJournalURL = root.appending(path: "migrated.ksj")
    let migrated = ClipboardHistoryStore(fileURL: migratedJournalURL, legacyFileURL: legacyURL, key: key)
    try expect(migrated.items.first?.content == legacy.content, "migrates v1 item arrays")
    try expect(migrated.items.first?.isPinned == false, "defaults migrated pin state")
    try expect(migrated.items.first?.tagIDs.isEmpty == true, "defaults migrated labels")
    try expect(migrated.items.first?.capturedAt == legacy.capturedAt, "keeps ordinary history by count instead of age")
    try expect(FileManager.default.fileExists(atPath: legacyURL.path), "keeps the legacy encrypted backup")
    try expect(FileManager.default.fileExists(atPath: migratedJournalURL.path), "creates the append-only journal")

    var truncated = try Data(contentsOf: migratedJournalURL)
    truncated.append(contentsOf: [0x12, 0x34])
    try truncated.write(to: migratedJournalURL)
    let recovered = ClipboardHistoryStore(fileURL: migratedJournalURL, key: key)
    try expect(recovered.items.first?.content == legacy.content, "ignores a truncated final journal record")

    let capacityURL = root.appending(path: "capacity.ksj")
    let capacityStore = ClipboardHistoryStore(fileURL: capacityURL, key: key)
    for index in 0 ... ClipboardHistoryStore.maximumRecentItems {
      try expect(capacityStore.record(
        content: "ordinary clipboard item \(index)",
        sourceName: "Tests",
        sourceBundleID: nil,
        hasFiles: false
      ), "appends capacity item \(index)")
    }
    try expect(
      capacityStore.items.filter { !$0.isPinned && !$0.isPermanent }.count == ClipboardHistoryStore.maximumRecentItems,
      "retains exactly 10,000 ordinary entries"
    )

    let reloadedCapacity = ClipboardHistoryStore(fileURL: capacityURL, key: key)
    try expect(reloadedCapacity.items.count == ClipboardHistoryStore.maximumRecentItems, "replays the 10,000-item journal")

    let pasteboard = NSPasteboard(name: NSPasteboard.Name("kmd-source-context-tests"))
    let sourceType = NSPasteboard.PasteboardType("org.chromium.source-url")
    let titleType = NSPasteboard.PasteboardType("org.chromium.source-title")
    pasteboard.declareTypes([sourceType, titleType], owner: nil)
    pasteboard.setString("https://example.com/chat/7", forType: sourceType)
    pasteboard.setString("Claude planning session", forType: titleType)
    let context = ClipboardSourceContextReader.read(pasteboard: pasteboard, application: nil)
    try expect(context.sourceURL == "https://example.com/chat/7", "reads the clipboard source URL")
    try expect(context.sessionName == "Claude planning session", "reads the clipboard session name")
    try expect(ClipboardHistoryStore.sanitizedSourceURL("javascript:alert(1)") == nil, "rejects unsafe source URLs")

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
// swiftlint:enable convenience_type
