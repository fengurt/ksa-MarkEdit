//
//  LocalMCPServerTests.swift
//
//  Created by ksamint on 7/29/26.
//

import SharedUI
import XCTest

final class LocalMCPServerTests: XCTestCase {
  func testReadSearchTaxonomyAndToolDiscovery() async throws {
    let fixture = try Fixture()
    defer {
      fixture.remove()
    }
    try """
    ---
    category: Projects/AI
    tags: [研究, Café]
    ---
    # Swift search
    Semantic notes.
    """.write(to: fixture.root.appending(path: "Note.md"), atomically: true, encoding: .utf8)

    let server = try LocalMCPServer(workspaceURL: fixture.root)
    try await server.prepare()

    let tools = try await call(server, id: 1, method: "tools/list")
    let toolNames = try XCTUnwrap(
      ((tools["result"] as? [String: Any])?["tools"] as? [[String: Any]])?
        .compactMap { $0["name"] as? String }
    )
    XCTAssertEqual(
      Set(toolNames),
      [
        "apply_patch",
        "backlinks",
        "create_file",
        "deep_search",
        "graph_neighbors",
        "list_categories",
        "list_files",
        "list_tags",
        "list_workspaces",
        "move_to_trash",
        "read_file",
        "search",
        "set_category",
        "set_tags",
      ]
    )

    let search = try await toolCall(
      server,
      id: 2,
      name: "search",
      arguments: ["query": "semantic"]
    )
    let searchResults = try XCTUnwrap(search["structuredContent"] as? [[String: Any]])
    XCTAssertEqual(searchResults.first?["path"] as? String, "Note.md")
    XCTAssertEqual(searchResults.first?["line"] as? Int, 6)

    let tags = try await toolCall(server, id: 3, name: "list_tags")
    let tagResults = try XCTUnwrap(tags["structuredContent"] as? [[String: Any]])
    XCTAssertEqual(Set(tagResults.compactMap { $0["identity"] as? String }), ["研究", "café"])

    let categories = try await toolCall(server, id: 4, name: "list_categories")
    let categoryResults = try XCTUnwrap(categories["structuredContent"] as? [[String: Any]])
    XCTAssertEqual(categoryResults.first?["path"] as? String, "Projects/AI")
  }

  func testWorkspaceBoundaryAndWriteGates() async throws {
    let fixture = try Fixture()
    let external = try Fixture()
    defer {
      fixture.remove()
      external.remove()
    }
    try "outside".write(
      to: external.root.appending(path: "Outside.md"),
      atomically: true,
      encoding: .utf8
    )
    try FileManager.default.createSymbolicLink(
      at: fixture.root.appending(path: "Escape.md"),
      withDestinationURL: external.root.appending(path: "Outside.md")
    )
    try "inside".write(
      to: fixture.root.appending(path: "Inside.md"),
      atomically: true,
      encoding: .utf8
    )

    let server = try LocalMCPServer(workspaceURL: fixture.root)
    try await server.prepare()

    let traversal = try await rawToolCall(
      server,
      id: 1,
      name: "read_file",
      arguments: ["path": "../Outside.md"]
    )
    XCTAssertNotNil(traversal["error"])

    let symlink = try await rawToolCall(
      server,
      id: 2,
      name: "read_file",
      arguments: ["path": "Escape.md"]
    )
    XCTAssertNotNil(symlink["error"])

    let disabledWrite = try await rawToolCall(
      server,
      id: 3,
      name: "set_tags",
      arguments: ["path": "Inside.md", "tags": ["safe"], "confirmed": true]
    )
    XCTAssertEqual(
      (disabledWrite["error"] as? [String: Any])?["message"] as? String,
      "Write tools are disabled. Relaunch with --allow-write to opt in."
    )
  }

  func testConfirmedMetadataWritePreservesFrontMatterAndCreatesAuditChain() async throws {
    let fixture = try Fixture()
    defer {
      fixture.remove()
    }
    let note = fixture.root.appending(path: "Note.md")
    try """
    ---
    title: Keep me # comment
    tags: [old]
    custom: yes
    ---
    Body
    """.write(to: note, atomically: true, encoding: .utf8)

    let server = try LocalMCPServer(workspaceURL: fixture.root, allowWrite: true)
    try await server.prepare()

    let unconfirmed = try await rawToolCall(
      server,
      id: 1,
      name: "set_tags",
      arguments: ["path": "Note.md", "tags": ["新标签", "Café"]]
    )
    XCTAssertEqual(
      (unconfirmed["error"] as? [String: Any])?["message"] as? String,
      "This operation requires confirmed: true."
    )

    _ = try await toolCall(
      server,
      id: 2,
      name: "set_tags",
      arguments: [
        "path": "Note.md",
        "tags": ["新标签", "Café"],
        "confirmed": true,
      ]
    )
    _ = try await toolCall(
      server,
      id: 3,
      name: "set_category",
      arguments: [
        "path": "Note.md",
        "category": "Projects/知识",
        "confirmed": true,
      ]
    )

    let source = try String(contentsOf: note, encoding: .utf8)
    XCTAssertTrue(source.contains("title: Keep me # comment"))
    XCTAssertTrue(source.contains("custom: yes"))
    XCTAssertTrue(source.contains("tags: [新标签, Café]"))
    XCTAssertTrue(source.contains("category: Projects/知识"))

    let auditURL = fixture.root.appending(path: ".ksamint/audit.log")
    let entries = try String(contentsOf: auditURL, encoding: .utf8)
      .split(separator: "\n")
      .map { try JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any] }
    XCTAssertEqual(entries.count, 2)
    XCTAssertEqual(entries[1]?["previousHash"] as? String, entries[0]?["hash"] as? String)
  }
}

private extension LocalMCPServerTests {
  struct Fixture {
    let root: URL

    init() throws {
      self.root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
      try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    func remove() {
      try? FileManager.default.removeItem(at: root)
    }
  }

  func call(
    _ server: LocalMCPServer,
    id: Int,
    method: String,
    parameters: [String: Any]? = nil
  ) async throws -> [String: Any] {
    var request: [String: Any] = [
      "jsonrpc": "2.0",
      "id": id,
      "method": method,
    ]
    request["params"] = parameters
    let requestData = try JSONSerialization.data(withJSONObject: request)
    let responseData = await server.responseData(for: requestData)
    return try XCTUnwrap(
      JSONSerialization.jsonObject(with: responseData) as? [String: Any]
    )
  }

  func rawToolCall(
    _ server: LocalMCPServer,
    id: Int,
    name: String,
    arguments: [String: Any] = [:]
  ) async throws -> [String: Any] {
    try await call(
      server,
      id: id,
      method: "tools/call",
      parameters: [
        "name": name,
        "arguments": arguments,
      ]
    )
  }

  func toolCall(
    _ server: LocalMCPServer,
    id: Int,
    name: String,
    arguments: [String: Any] = [:]
  ) async throws -> [String: Any] {
    let response = try await rawToolCall(
      server,
      id: id,
      name: name,
      arguments: arguments
    )
    XCTAssertNil(response["error"])
    return try XCTUnwrap(response["result"] as? [String: Any])
  }
}
