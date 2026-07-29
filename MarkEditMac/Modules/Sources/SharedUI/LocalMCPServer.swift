// swiftlint:disable file_length type_body_length
//
//  LocalMCPServer.swift
//
//  Local-first, opt-in MCP stdio endpoint for ksamint MarkEdit.
//

import CryptoKit
import Foundation

public actor LocalMCPServer {
  public enum ServerError: LocalizedError {
    case invalidArguments
    case invalidRequest(String)
    case unsafePath
    case writeDisabled
    case confirmationRequired
    case unsupportedFile

    public var errorDescription: String? {
      switch self {
      case .invalidArguments:
        "Usage: --mcp-stdio --workspace <folder> [--allow-write]"
      case let .invalidRequest(message):
        message
      case .unsafePath:
        "The requested path is outside the authorized workspace."
      case .writeDisabled:
        "Write tools are disabled. Relaunch with --allow-write to opt in."
      case .confirmationRequired:
        "This operation requires confirmed: true."
      case .unsupportedFile:
        "Only Markdown files smaller than 10 MB are available."
      }
    }
  }

  public static let maximumFileSize = 10 * 1024 * 1024

  private let rootURL: URL
  private let allowWrite: Bool
  private let index: WorkspaceIndex
  private let deepSearch: WorkspaceDeepSearch

  public init(workspaceURL: URL, allowWrite: Bool = false) throws {
    let rootURL = workspaceURL.standardizedFileURL.resolvingSymlinksInPath()
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: rootURL.path, isDirectory: &isDirectory),
          isDirectory.boolValue else {
      throw ServerError.invalidArguments
    }

    self.rootURL = rootURL
    self.allowWrite = allowWrite
    self.index = WorkspaceIndex(rootURL: rootURL)
    self.deepSearch = WorkspaceDeepSearch(rootURL: rootURL)
  }

  public static func run(
    arguments: [String] = CommandLine.arguments,
    input: FileHandle = .standardInput,
    output: FileHandle = .standardOutput
  ) async throws {
    guard let workspaceIndex = arguments.firstIndex(of: "--workspace"),
          arguments.indices.contains(workspaceIndex + 1) else {
      throw ServerError.invalidArguments
    }

    let server = try LocalMCPServer(
      workspaceURL: URL(fileURLWithPath: arguments[workspaceIndex + 1], isDirectory: true),
      allowWrite: arguments.contains("--allow-write")
    )
    try await server.prepare()

    for try await line in input.bytes.lines {
      guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        continue
      }
      let response = await server.responseData(for: Data(line.utf8))
      try output.write(contentsOf: response)
      try output.write(contentsOf: Data([0x0A]))
    }
  }

  public func prepare() async throws {
    _ = try await index.rebuild()
  }

  public func responseData(for requestData: Data) async -> Data {
    var requestID: Any?
    do {
      let requestValue = try JSONSerialization.jsonObject(with: requestData)
      guard let request = requestValue as? [String: Any] else {
        throw ServerError.invalidRequest("The JSON-RPC request must be an object.")
      }
      requestID = request["id"]
      let result = try await handle(request)
      return try Self.encodedResponse(
        id: requestID,
        result: result,
        error: nil
      )
    } catch {
      return (try? Self.encodedResponse(
        id: requestID,
        result: nil,
        error: [
          "code": -32_000,
          "message": error.localizedDescription,
        ]
      )) ?? Data(#"{"jsonrpc":"2.0","error":{"code":-32603,"message":"Internal error"}}"#.utf8)
    }
  }
}

// MARK: - Protocol

private extension LocalMCPServer {
  func handle(_ request: [String: Any]) async throws -> Any {
    guard request["jsonrpc"] as? String == "2.0",
          let method = request["method"] as? String else {
      throw ServerError.invalidRequest("Invalid JSON-RPC request.")
    }

    switch method {
    case "initialize":
      return [
        "protocolVersion": "2025-06-18",
        "serverInfo": [
          "name": "ksamint-markedit",
          "version": "1.3.0",
        ],
        "capabilities": ["tools": ["listChanged": false]],
      ]
    case "notifications/initialized":
      return NSNull()
    case "tools/list":
      return ["tools": Self.toolDescriptions]
    case "tools/call":
      guard let parameters = request["params"] as? [String: Any],
            let name = parameters["name"] as? String else {
        throw ServerError.invalidRequest("Missing tool name.")
      }
      let arguments = parameters["arguments"] as? [String: Any] ?? [:]
      let value = try await callTool(name, arguments: arguments)
      return [
        "content": [[
          "type": "text",
          "text": try Self.prettyJSONString(value),
        ]],
        "structuredContent": value,
        "isError": false,
      ]
    default:
      throw ServerError.invalidRequest("Method not found: \(method)")
    }
  }

  func callTool(_ name: String, arguments: [String: Any]) async throws -> Any {
    switch name {
    case "list_workspaces":
      return [[
        "name": rootURL.lastPathComponent,
        "path": rootURL.path,
        "writeEnabled": allowWrite,
      ]]
    case "list_files":
      return try listFiles(path: arguments["path"] as? String)
    case "read_file":
      let url = try existingMarkdownURL(path: try Self.requiredString("path", in: arguments))
      return [
        "path": relativePath(for: url),
        "text": try Self.readTextFile(at: url).text,
      ]
    case "search":
      return await textSearch(arguments)
    case "deep_search":
      return await semanticSearch(arguments)
    case "list_tags":
      return await index.tags().map {
        [
          "identity": $0.identity,
          "display": $0.displayName,
          "fileCount": $0.fileCount,
        ] as [String: Any]
      }
    case "list_categories":
      return await index.categories().map {
        [
          "path": $0.path,
          "fileCount": $0.fileCount,
        ] as [String: Any]
      }
    case "backlinks":
      let url = try existingMarkdownURL(path: try Self.requiredString("path", in: arguments))
      return await index.backlinks(to: url).map(Self.searchResult)
    case "graph_neighbors":
      return try await graphNeighbors(arguments)
    case "create_file":
      return try await createFile(arguments)
    case "apply_patch":
      return try await applyTextPatch(arguments)
    case "set_tags":
      return try await setTags(arguments)
    case "set_category":
      return try await setCategory(arguments)
    case "move_to_trash":
      return try await moveToTrash(arguments)
    default:
      throw ServerError.invalidRequest("Unknown tool: \(name)")
    }
  }
}

// MARK: - Read tools

private extension LocalMCPServer {
  func listFiles(path: String?) throws -> [[String: Any]] {
    let directory = try existingDirectoryURL(path: path ?? "")
    return try FileManager.default.contentsOfDirectory(
      at: directory,
      includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey, .fileSizeKey],
      options: [.skipsHiddenFiles]
    )
    .compactMap { url -> [String: Any]? in
      let values = try? url.resourceValues(forKeys: [
        .isDirectoryKey,
        .isRegularFileKey,
        .fileSizeKey,
      ])
      if values?.isDirectory == true {
        return ["path": relativePath(for: url), "kind": "directory"]
      }
      guard isMarkdown(url), values?.isRegularFile == true,
            (values?.fileSize ?? Self.maximumFileSize + 1) <= Self.maximumFileSize else {
        return nil
      }
      return ["path": relativePath(for: url), "kind": "markdown"]
    }
    .sorted {
      ($0["path"] as? String ?? "").localizedStandardCompare(
        $1["path"] as? String ?? ""
      ) == .orderedAscending
    }
  }

  func textSearch(_ arguments: [String: Any]) async -> [[String: Any]] {
    guard let query = arguments["query"] as? String else {
      return []
    }
    let limit = Self.resultLimit(arguments)
    return await index.search(query).prefix(limit).map(Self.searchResult)
  }

  func semanticSearch(_ arguments: [String: Any]) async -> [[String: Any]] {
    guard let query = arguments["query"] as? String else {
      return []
    }
    let limit = Self.resultLimit(arguments)
    do {
      return try await deepSearch.search(query, limit: limit).map {
        var value = Self.searchResult($0.result)
        value["score"] = $0.score
        value["mode"] = "embedding"
        return value
      }
    } catch {
      return await index.search(query).prefix(limit).map {
        var value = Self.searchResult($0)
        value["mode"] = "text_fallback"
        return value
      }
    }
  }

  func graphNeighbors(_ arguments: [String: Any]) async throws -> [String: Any] {
    let path = try Self.requiredString("path", in: arguments)
    _ = try existingMarkdownURL(path: path)
    let depth = min(max(arguments["depth"] as? Int ?? 1, 1), 3)
    let graph = await index.graph(limit: WorkspaceIndex.maximumGraphNodeLimit)
    var frontier = Set([path])
    var visible = frontier
    var edges = [[String: Any]]()

    for _ in 0..<depth {
      var next = Set<String>()
      for edge in graph.edges
      where frontier.contains(edge.sourcePath) || frontier.contains(edge.targetPath) {
        next.insert(edge.sourcePath)
        next.insert(edge.targetPath)
        edges.append([
          "source": edge.sourcePath,
          "target": edge.targetPath,
          "kind": edge.kind == .wiki ? "wiki" : "markdown",
        ])
      }
      visible.formUnion(next)
      frontier = next
    }

    return [
      "nodes": graph.nodes.filter { visible.contains($0.path) }.map {
        [
          "path": $0.path,
          "title": $0.title,
          "category": $0.category ?? NSNull(),
          "tags": $0.tags,
        ] as [String: Any]
      },
      "edges": edges,
    ]
  }
}

// MARK: - Write tools

private extension LocalMCPServer {
  func createFile(_ arguments: [String: Any]) async throws -> [String: Any] {
    try requireWrite(arguments)
    let path = try Self.requiredString("path", in: arguments)
    let url = try newMarkdownURL(path: path)
    guard !FileManager.default.fileExists(atPath: url.path) else {
      throw ServerError.invalidRequest("The file already exists.")
    }
    try FileManager.default.createDirectory(
      at: url.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    try (arguments["text"] as? String ?? "").write(to: url, atomically: true, encoding: .utf8)
    try await recordAudit(action: "create_file", url: url)
    try await index.refresh(url: url)
    return ["path": relativePath(for: url), "changed": true]
  }

  func applyTextPatch(_ arguments: [String: Any]) async throws -> [String: Any] {
    try requireWrite(arguments)
    let url = try existingMarkdownURL(path: try Self.requiredString("path", in: arguments))
    let oldText = try Self.requiredString("oldText", in: arguments)
    let newText = try Self.requiredString("newText", in: arguments)
    let document = try Self.readTextFile(at: url)
    guard document.text.ranges(of: oldText).count == 1 else {
      throw ServerError.invalidRequest("oldText must match exactly once.")
    }
    let updated = document.text.replacingOccurrences(of: oldText, with: newText)
    guard let data = updated.data(using: document.encoding) else {
      throw ServerError.invalidRequest(
        "The replacement cannot be represented in the file’s current encoding."
      )
    }
    try data.write(to: url, options: .atomic)
    try await recordAudit(action: "apply_patch", url: url)
    try await index.refresh(url: url)
    return ["path": relativePath(for: url), "changed": true]
  }

  func setTags(_ arguments: [String: Any]) async throws -> [String: Any] {
    try requireWrite(arguments, confirmationRequired: true)
    let url = try existingMarkdownURL(path: try Self.requiredString("path", in: arguments))
    guard let tags = arguments["tags"] as? [String] else {
      throw ServerError.invalidRequest("tags must be an array of strings.")
    }
    try WorkspaceMetadataFile.update(at: url) { metadata in
      WorkspaceDocumentMetadata(category: metadata.category, tags: tags)
    }
    try await recordAudit(action: "set_tags", url: url)
    try await index.refresh(url: url)
    return ["path": relativePath(for: url), "changed": true]
  }

  func setCategory(_ arguments: [String: Any]) async throws -> [String: Any] {
    try requireWrite(arguments, confirmationRequired: true)
    let url = try existingMarkdownURL(path: try Self.requiredString("path", in: arguments))
    let category = (arguments["category"] as? String)?.nilIfEmpty
    try WorkspaceMetadataFile.update(at: url) { metadata in
      WorkspaceDocumentMetadata(category: category, tags: metadata.tags)
    }
    try await recordAudit(action: "set_category", url: url)
    try await index.refresh(url: url)
    return ["path": relativePath(for: url), "changed": true]
  }

  func moveToTrash(_ arguments: [String: Any]) async throws -> [String: Any] {
    try requireWrite(arguments, confirmationRequired: true)
    let url = try existingURL(path: try Self.requiredString("path", in: arguments))
    let relativePath = relativePath(for: url)
    try await recordAudit(action: "move_to_trash", url: url)
    var resultingURL: NSURL?
    try FileManager.default.trashItem(at: url, resultingItemURL: &resultingURL)
    try await index.refresh(url: url)
    return ["path": relativePath, "trashed": true]
  }

  func requireWrite(
    _ arguments: [String: Any],
    confirmationRequired: Bool = false
  ) throws {
    guard allowWrite else {
      throw ServerError.writeDisabled
    }
    if confirmationRequired, arguments["confirmed"] as? Bool != true {
      throw ServerError.confirmationRequired
    }
  }
}

// MARK: - Paths and audit

private extension LocalMCPServer {
  func existingURL(path: String) throws -> URL {
    let candidate = try safeCandidate(path: path)
    let resolved = candidate.resolvingSymlinksInPath()
    guard Self.isDescendant(resolved, of: rootURL),
          FileManager.default.fileExists(atPath: resolved.path) else {
      throw ServerError.unsafePath
    }
    return resolved
  }

  func existingDirectoryURL(path: String) throws -> URL {
    let url = path.isEmpty ? rootURL : try existingURL(path: path)
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
          isDirectory.boolValue else {
      throw ServerError.unsafePath
    }
    return url
  }

  func existingMarkdownURL(path: String) throws -> URL {
    let url = try existingURL(path: path)
    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    guard values.isRegularFile == true, isMarkdown(url),
          (values.fileSize ?? Self.maximumFileSize + 1) <= Self.maximumFileSize else {
      throw ServerError.unsupportedFile
    }
    return url
  }

  func newMarkdownURL(path: String) throws -> URL {
    let candidate = try safeCandidate(path: path)
    guard isMarkdown(candidate) else {
      throw ServerError.unsupportedFile
    }
    let parent = candidate.deletingLastPathComponent()
    let existingParent = Self.nearestExistingParent(parent).resolvingSymlinksInPath()
    guard existingParent == rootURL || Self.isDescendant(existingParent, of: rootURL) else {
      throw ServerError.unsafePath
    }
    return candidate
  }

  func safeCandidate(path: String) throws -> URL {
    guard !path.isEmpty, !path.hasPrefix("/"), !path.contains("\0") else {
      throw ServerError.unsafePath
    }
    let components = NSString(string: path).standardizingPath
    guard components != "..", !components.hasPrefix("../") else {
      throw ServerError.unsafePath
    }
    let candidate = rootURL.appending(path: components).standardizedFileURL
    guard Self.isDescendant(candidate, of: rootURL) else {
      throw ServerError.unsafePath
    }
    return candidate
  }

  func relativePath(for url: URL) -> String {
    let rootComponents = rootURL.pathComponents
    return url.standardizedFileURL.pathComponents
      .dropFirst(rootComponents.count)
      .joined(separator: "/")
  }

  func isMarkdown(_ url: URL) -> Bool {
    ["md", "markdown", "mdown", "mkd", "mdx", "qmd", "rmd"]
      .contains(url.pathExtension.lowercased())
  }

  func recordAudit(action: String, url: URL) async throws {
    let directory = rootURL.appending(path: ".ksamint", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let auditURL = directory.appending(path: "audit.log")
    let previous = (try? String(contentsOf: auditURL, encoding: .utf8))
      .flatMap { $0.split(separator: "\n").last }
      .flatMap { Data($0.utf8) }
      .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
      .flatMap { $0["hash"] as? String } ?? String(repeating: "0", count: 64)
    let content = (try? Data(contentsOf: url)).map(Self.digest) ?? ""
    let payload: [String: Any] = [
      "timestampMs": Int64(Date().timeIntervalSince1970 * 1_000),
      "action": action,
      "path": relativePath(for: url),
      "contentDigest": content,
      "previousHash": previous,
    ]
    let hash = Self.digest(try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]))
    var entry = payload
    entry["hash"] = hash
    let data = try JSONSerialization.data(withJSONObject: entry, options: [.sortedKeys])
    let handle = try FileHandle(forWritingTo: auditURL, createIfNeeded: true)
    defer {
      try? handle.close()
    }
    try handle.seekToEnd()
    try handle.write(contentsOf: data)
    try handle.write(contentsOf: Data([0x0A]))
    try handle.synchronize()
  }
}

// MARK: - Helpers

private extension LocalMCPServer {
  static func encodedResponse(id: Any?, result: Any?, error: Any?) throws -> Data {
    var response: [String: Any] = [
      "jsonrpc": "2.0",
      "id": id ?? NSNull(),
    ]
    if let result {
      response["result"] = result
    }
    if let error {
      response["error"] = error
    }
    return try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys])
  }

  static func prettyJSONString(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(
      withJSONObject: value,
      options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    )
    return String(decoding: data, as: UTF8.self)
  }

  static func requiredString(_ key: String, in arguments: [String: Any]) throws -> String {
    guard let value = arguments[key] as? String, !value.isEmpty else {
      throw ServerError.invalidRequest("Missing \(key).")
    }
    return value
  }

  static func resultLimit(_ arguments: [String: Any]) -> Int {
    min(max(arguments["limit"] as? Int ?? 50, 1), WorkspaceIndex.maximumResultCount)
  }

  static func searchResult(_ result: WorkspaceSearchResult) -> [String: Any] {
    [
      "path": result.relativePath,
      "line": result.lineNumber,
      "context": result.snippet,
    ]
  }

  static func digest(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  static func readTextFile(at url: URL) throws -> TextDocument {
    let data = try Data(contentsOf: url, options: [.mappedIfSafe])
    for encoding in TextDocument.supportedEncodings {
      if let text = String(data: data, encoding: encoding) {
        return TextDocument(text: text, encoding: encoding)
      }
    }
    throw ServerError.unsupportedFile
  }

  static func isDescendant(_ url: URL, of rootURL: URL) -> Bool {
    let rootComponents = rootURL.standardizedFileURL.pathComponents
    let components = url.standardizedFileURL.pathComponents
    return components.count > rootComponents.count
      && components.prefix(rootComponents.count) == rootComponents[...]
  }

  static func nearestExistingParent(_ url: URL) -> URL {
    var candidate = url
    while !FileManager.default.fileExists(atPath: candidate.path),
          candidate.pathComponents.count > 1 {
      candidate.deleteLastPathComponent()
    }
    return candidate
  }

  struct TextDocument {
    static let supportedEncodings: [String.Encoding] = [
      .utf8,
      .utf16,
      .utf16LittleEndian,
      .utf16BigEndian,
      .windowsCP1252,
      .shiftJIS,
      .japaneseEUC,
    ]

    let text: String
    let encoding: String.Encoding
  }

  static var toolDescriptions: [[String: Any]] {
    [
      tool("list_workspaces", "List the authorized workspace."),
      tool("list_files", "List Markdown files and folders.", properties: [
        "path": ["type": "string"],
      ]),
      tool("read_file", "Read one Markdown source file.", properties: [
        "path": ["type": "string"],
      ], required: ["path"]),
      tool(
        "search",
        "Search local Markdown text.",
        properties: searchProperties,
        required: ["query"]
      ),
      tool(
        "deep_search",
        "Search the private on-device semantic index.",
        properties: searchProperties,
        required: ["query"]
      ),
      tool("list_tags", "List normalized tags and file counts."),
      tool("list_categories", "List categories and file counts."),
      tool("backlinks", "List files linking to a Markdown file.", properties: [
        "path": ["type": "string"],
      ], required: ["path"]),
      tool("graph_neighbors", "Return the local graph around a file.", properties: [
        "path": ["type": "string"],
        "depth": ["type": "integer", "minimum": 1, "maximum": 3],
      ], required: ["path"]),
      tool("create_file", "Create a Markdown file when writes are enabled.", properties: [
        "path": ["type": "string"],
        "text": ["type": "string"],
      ], required: ["path"]),
      tool("apply_patch", "Replace one exact source span when writes are enabled.", properties: [
        "path": ["type": "string"],
        "oldText": ["type": "string"],
        "newText": ["type": "string"],
      ], required: ["path", "oldText", "newText"]),
      tool("set_tags", "Set YAML tags after explicit confirmation.", properties: [
        "path": ["type": "string"],
        "tags": ["type": "array", "items": ["type": "string"]],
        "confirmed": ["const": true],
      ], required: ["path", "tags", "confirmed"]),
      tool("set_category", "Set a YAML category after explicit confirmation.", properties: [
        "path": ["type": "string"],
        "category": ["type": "string"],
        "confirmed": ["const": true],
      ], required: ["path", "category", "confirmed"]),
      tool("move_to_trash", "Move a file to Trash after explicit confirmation.", properties: [
        "path": ["type": "string"],
        "confirmed": ["const": true],
      ], required: ["path", "confirmed"]),
    ]
  }

  static var searchProperties: [String: Any] {
    [
      "query": ["type": "string"],
      "limit": ["type": "integer", "minimum": 1, "maximum": 500],
    ]
  }

  static func tool(
    _ name: String,
    _ description: String,
    properties: [String: Any] = [:],
    required: [String] = []
  ) -> [String: Any] {
    [
      "name": name,
      "description": description,
      "inputSchema": [
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false,
      ] as [String: Any],
    ]
  }
}

private extension FileHandle {
  convenience init(forWritingTo url: URL, createIfNeeded: Bool) throws {
    if createIfNeeded, !FileManager.default.fileExists(atPath: url.path) {
      FileManager.default.createFile(atPath: url.path, contents: nil)
    }
    try self.init(forWritingTo: url)
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }

  func ranges(of string: String) -> [Range<String.Index>] {
    guard !string.isEmpty else {
      return []
    }
    var result = [Range<String.Index>]()
    var searchRange = startIndex..<endIndex
    while let range = range(of: string, range: searchRange) {
      result.append(range)
      searchRange = range.upperBound..<endIndex
    }
    return result
  }
}
