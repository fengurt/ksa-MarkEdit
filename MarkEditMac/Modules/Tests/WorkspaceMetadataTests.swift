//
//  WorkspaceMetadataTests.swift
//
//  Created by ksamint on 7/29/26.
//

import SharedUI
import XCTest

final class WorkspaceMetadataTests: XCTestCase {
  func testParsesInlineAndBlockTagsWithUnicodeIdentity() {
    let inline = """
    ---
    title: Exemple
    category: Projects/AI
    tags: [Research, "Café", Ｓｗｉｆｔ]
    ---
    Text
    """
    let block = """
    ---
    tags:
      - 日本語
      - 中文
    ---
    """

    let inlineMetadata = WorkspaceDocumentMetadata.parse(inline)
    let blockMetadata = WorkspaceDocumentMetadata.parse(block)

    XCTAssertEqual(inlineMetadata.category, "Projects/AI")
    XCTAssertEqual(inlineMetadata.tags, ["Research", "Café", "Ｓｗｉｆｔ"])
    XCTAssertEqual(blockMetadata.tags, ["日本語", "中文"])
    XCTAssertEqual(
      WorkspaceDocumentMetadata.canonicalTagIdentity("Ｓｗｉｆｔ"),
      WorkspaceDocumentMetadata.canonicalTagIdentity("swift")
    )
  }

  func testMetadataUpdatePreservesUnknownFieldsCommentsOrderAndLineEndings() {
    let source = """
    ---\r
    title: Original # keep title\r
    category: Old # keep category comment\r
    custom:\r
      nested: true # keep nested comment\r
    tags:\r
      - old\r
    aliases: [one, two]\r
    ---\r
    Body\r
    """
    let metadata = WorkspaceDocumentMetadata(
      category: "Projects/AI",
      tags: ["研究", "Café"]
    )

    let updated = metadata.applying(to: source)

    XCTAssertTrue(updated.contains("title: Original # keep title\r\n"))
    XCTAssertTrue(updated.contains("category: Projects/AI # keep category comment\r\n"))
    XCTAssertTrue(updated.contains("custom:\r\n  nested: true # keep nested comment\r\n"))
    XCTAssertTrue(updated.contains("tags: [研究, Café]\r\n"))
    XCTAssertTrue(updated.contains("aliases: [one, two]\r\n"))
    XCTAssertFalse(updated.replacingOccurrences(of: "\r\n", with: "").contains("\n"))
  }

  func testAddsAndRemovesManagedFieldsWithoutChangingBody() {
    let source = "First\r\nSecond\r\n"
    let added = WorkspaceDocumentMetadata(
      category: "Notes",
      tags: ["swift"]
    ).applying(to: source)
    let removed = WorkspaceDocumentMetadata().applying(to: added)

    XCTAssertEqual(
      added,
      "---\r\ncategory: Notes\r\ntags: [swift]\r\n---\r\nFirst\r\nSecond\r\n"
    )
    XCTAssertEqual(removed, "---\r\n---\r\nFirst\r\nSecond\r\n")
  }
}
