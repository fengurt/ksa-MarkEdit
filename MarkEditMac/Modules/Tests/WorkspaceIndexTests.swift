//
//  WorkspaceIndexTests.swift
//
//  Created by ksamint on 7/27/26.
//

import SharedUI
import XCTest

final class WorkspaceIndexTests: XCTestCase {
  func testMultilingualSearchAndShortQueries() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let database = root.appending(path: "index.sqlite")

    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer {
      try? FileManager.default.removeItem(at: root)
    }

    try "简体中文测试\n第二行".write(
      to: root.appending(path: "中文.md"),
      atomically: true,
      encoding: .utf8
    )
    try "日本語の文章です。".write(
      to: root.appending(path: "日本語.md"),
      atomically: true,
      encoding: .utf8
    )
    try "Café déjà vu — été".write(
      to: root.appending(path: "français.md"),
      atomically: true,
      encoding: .utf8
    )

    let index = WorkspaceIndex(rootURL: root, databaseURL: database)
    let fileCount = try await index.rebuild()
    let chineseResult = await index.search("中文").first
    let japaneseResult = await index.search("日本語").first
    let frenchResult = await index.search("cafe").first

    XCTAssertEqual(fileCount, 3)
    XCTAssertEqual(chineseResult?.lineNumber, 1)
    XCTAssertEqual(japaneseResult?.relativePath, "日本語.md")
    XCTAssertEqual(frenchResult?.relativePath, "français.md")
  }

  func testSkipsBinaryLargeHiddenAndExternalSymlinkFiles() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let database = root.appending(path: "index.sqlite")
    let external = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)

    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: external, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(
      at: root.appending(path: ".git", directoryHint: .isDirectory),
      withIntermediateDirectories: true
    )
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: external)
    }

    try "visible".write(to: root.appending(path: "visible.md"), atomically: true, encoding: .utf8)
    try "hidden".write(to: root.appending(path: ".git/hidden.md"), atomically: true, encoding: .utf8)
    try Data([0, 1, 2, 3]).write(to: root.appending(path: "binary.txt"))
    try Data(count: WorkspaceIndex.maximumFileSize + 1).write(to: root.appending(path: "large.md"))
    let outsideFile = external.appending(path: "outside.md")
    try "outside workspace".write(to: outsideFile, atomically: true, encoding: .utf8)
    try FileManager.default.createSymbolicLink(
      at: root.appending(path: "linked.md"),
      withDestinationURL: outsideFile
    )

    let index = WorkspaceIndex(rootURL: root, databaseURL: database)
    let fileCount = try await index.rebuild()
    let visibleResults = await index.search("visible")
    let hiddenResults = await index.search("hidden")
    let binaryResults = await index.search("binary")
    let largeResults = await index.search("large")
    let outsideResults = await index.search("outside")

    XCTAssertEqual(fileCount, 1)
    XCTAssertEqual(visibleResults.count, 1)
    XCTAssertTrue(hiddenResults.isEmpty)
    XCTAssertTrue(binaryResults.isEmpty)
    XCTAssertTrue(largeResults.isEmpty)
    XCTAssertTrue(outsideResults.isEmpty)
  }

  func testRefreshAddsAndRemovesFile() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let database = root.appending(path: "index.sqlite")
    let file = root.appending(path: "note.md")

    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer {
      try? FileManager.default.removeItem(at: root)
    }

    let index = WorkspaceIndex(rootURL: root, databaseURL: database)
    _ = try await index.rebuild()

    try "new content".write(to: file, atomically: true, encoding: .utf8)
    try await index.refresh(url: file)
    let addedResults = await index.search("content")
    XCTAssertEqual(addedResults.count, 1)

    try FileManager.default.removeItem(at: file)
    try await index.refresh(url: file)
    let removedResults = await index.search("content")
    XCTAssertTrue(removedResults.isEmpty)
  }

  func testCancelledShortQueryStopsScanning() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let database = root.appending(path: "index.sqlite")

    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer {
      try? FileManager.default.removeItem(at: root)
    }

    for index in 0..<100 {
      try "短词 \(index)".write(
        to: root.appending(path: "\(index).md"),
        atomically: true,
        encoding: .utf8
      )
    }

    let workspaceIndex = WorkspaceIndex(rootURL: root, databaseURL: database)
    _ = try await workspaceIndex.rebuild()

    let task = Task {
      await workspaceIndex.search("短")
    }
    task.cancel()
    let results = await task.value
    XCTAssertTrue(results.isEmpty)
  }
}
