import Foundation
import XCTest
@testable import KMDIOSCore

final class MarkdownOutlineTests: XCTestCase {
  func testParsesMultilingualHierarchyAndSectionMetrics() {
    let markdown = """
    # 项目
    中文内容
    ## 日本語
    テストです
    ### Français
    résumé important
    ## Commands
    swift test
    """

    let outline = MarkdownOutlineParser.parse(markdown)

    XCTAssertEqual(outline.headings.map(\.level), [1, 2, 3, 2])
    XCTAssertEqual(outline.headings.map(\.title), ["项目", "日本語", "Français", "Commands"])
    XCTAssertEqual(outline.roots.count, 1)
    XCTAssertEqual(outline.roots[0].children.count, 2)
    XCTAssertEqual(outline.roots[0].children[0].children.count, 1)
    XCTAssertGreaterThan(outline.totalWordCount, 0)
    XCTAssertGreaterThan(outline.headings[0].documentRatio, outline.headings[1].documentRatio)
  }

  func testIgnoresHeadingsInsideFencedCodeAndParsesSetext() {
    let markdown = """
    Title
    =====
    ```markdown
    # not a heading
    ```
    Subtitle
    --------
    body
    """

    let outline = MarkdownOutlineParser.parse(markdown)

    XCTAssertEqual(outline.headings.map(\.title), ["Title", "Subtitle"])
    XCTAssertEqual(outline.headings.map(\.level), [1, 2])
  }

  func testDraftRepositoryRoundTripsWithoutChangingMarkdown() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let repository = DraftRepository(rootURL: root)
    let snapshot = MarkdownDraftSnapshot(
      text: "# 标题\n\n```swift\nlet value = 1\n```\n",
      displayName: "草稿.md",
      sourcePath: nil,
      updatedAt: Date(timeIntervalSince1970: 123)
    )

    try await repository.save(snapshot)
    let restored = try await repository.load()
    XCTAssertEqual(restored, snapshot)
  }

  func testSharedInboxIsChronologicalAndLossless() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let repository = SharedInboxRepository(rootURL: root)
    let later = SharedInboxEnvelope(
      kind: .markdown,
      text: "# Later",
      createdAt: Date(timeIntervalSince1970: 2)
    )
    let earlier = SharedInboxEnvelope(
      kind: .text,
      text: "更早",
      createdAt: Date(timeIntervalSince1970: 1)
    )

    try await repository.append(later)
    try await repository.append(earlier)
    let pending = try await repository.pending()
    XCTAssertEqual(pending, [earlier, later])

    try await repository.archive(id: earlier.id)
    let afterArchive = try await repository.pending()
    XCTAssertEqual(afterArchive, [later])
    XCTAssertTrue(FileManager.default.fileExists(
      atPath: root.appending(path: "Archive/\(earlier.id.uuidString).json").path
    ))
  }
}
