//
//  VaultSyncQueueTests.swift
//
//  Created by ksamint on 7/29/26.
//

import Foundation
@testable import SharedUI
import XCTest

final class VaultSyncQueueTests: XCTestCase {
  func testAttachmentPlannerUsesEightMiBParts() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: "VaultSyncQueue-\(UUID().uuidString)")
    defer {
      try? FileManager.default.removeItem(at: root)
    }
    let transport = RecordingTransport()
    let queue = VaultSyncQueue(
      databaseURL: root.appending(path: "queue.sqlite"),
      transport: transport
    )
    try await queue.enqueueAttachment(
      VaultAttachmentUpload(
        vaultID: UUID(),
        objectID: UUID(),
        ciphertextURL: root.appending(path: "attachment.ksv"),
        objectKey: "vaults/id/object",
        byteSize: 17 * 1024 * 1024,
        sha256: String(repeating: "0", count: 64),
        multipartUploadID: "upload"
      )
    )
    XCTAssertEqual(try await queue.pendingCount(), 3)
    await queue.runOneBatch()
    XCTAssertEqual(await transport.count, 3)
  }

  func testThreeWayMergeCombinesDisjointRanges() {
    let result = MarkdownThreeWayMerge.merge(
      base: "one\ntwo\nthree\nfour",
      local: "ONE\ntwo\nthree\nfour",
      remote: "one\ntwo\nthree\nFOUR"
    )
    XCTAssertEqual(result, .merged("ONE\ntwo\nthree\nFOUR"))
  }

  func testThreeWayMergeCreatesConflictForOverlap() {
    let result = MarkdownThreeWayMerge.merge(
      base: "one\ntwo",
      local: "one\nLOCAL",
      remote: "one\nREMOTE"
    )
    XCTAssertEqual(result, .conflict(local: "one\nLOCAL", remote: "one\nREMOTE"))
  }
}

private actor RecordingTransport: VaultSyncTransport {
  private(set) var count = 0

  func execute(_ job: VaultSyncJob) async throws {
    count += 1
  }
}
