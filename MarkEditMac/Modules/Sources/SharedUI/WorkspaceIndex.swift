//
//  WorkspaceIndex.swift
//
//  Created by ksamint on 7/27/26.
//

import CryptoKit
import Foundation
import SQLite3
import UniformTypeIdentifiers

public struct WorkspaceSearchResult: Sendable, Equatable {
  public let url: URL
  public let relativePath: String
  public let lineNumber: Int
  public let snippet: String

  public init(url: URL, relativePath: String, lineNumber: Int, snippet: String) {
    self.url = url
    self.relativePath = relativePath
    self.lineNumber = lineNumber
    self.snippet = snippet
  }
}

public enum WorkspaceIndexState: Sendable, Equatable {
  case idle
  case indexing
  case ready(fileCount: Int)
  case failed
}

public actor WorkspaceIndex {
  public static let maximumFileSize = 10 * 1024 * 1024
  public static let maximumResultCount = 500

  public private(set) var state = WorkspaceIndexState.idle

  private let rootURL: URL
  private let databaseURL: URL

  public init(rootURL: URL, databaseURL: URL? = nil) {
    self.rootURL = rootURL.standardizedFileURL
    self.databaseURL = databaseURL ?? Self.defaultDatabaseURL(rootURL: rootURL)
  }

  @discardableResult
  public func rebuild() throws -> Int {
    state = .indexing

    do {
      let files = indexableFiles()
      var insertedFileCount = 0
      try withDatabase { database in
        try configure(database)
        try execute(database, sql: "BEGIN IMMEDIATE")
        try execute(database, sql: "DELETE FROM documents")

        do {
          for url in files {
            insertedFileCount += try insert(url, database: database) ? 1 : 0
          }
          try execute(database, sql: "COMMIT")
        } catch {
          try? execute(database, sql: "ROLLBACK")
          throw error
        }
      }

      state = .ready(fileCount: insertedFileCount)
      return insertedFileCount
    } catch {
      state = .failed
      throw error
    }
  }

  public func refresh(url: URL) throws {
    let standardizedURL = url.standardizedFileURL
    guard standardizedURL.isDescendant(of: rootURL) else {
      return
    }

    let values = try? standardizedURL.resourceValues(forKeys: [.isDirectoryKey])
    if values?.isDirectory == true {
      _ = try rebuild()
      return
    }

    try withDatabase { database in
      try configure(database)
      try remove(standardizedURL, database: database)
      if isIndexable(standardizedURL) {
        try insert(standardizedURL, database: database)
      }
    }
  }

  public func search(_ input: String) -> [WorkspaceSearchResult] {
    let query = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else {
      return []
    }

    do {
      return try searchDatabase(query)
    } catch {
      return linearSearch(query)
    }
  }
}

// MARK: - SQLite

private extension WorkspaceIndex {
  enum DatabaseError: Error {
    case open(String)
    case execute(String)
    case prepare(String)
  }

  func withDatabase<T>(_ operation: (OpaquePointer) throws -> T) throws -> T {
    try FileManager.default.createDirectory(
      at: databaseURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )

    var database: OpaquePointer?
    guard sqlite3_open_v2(
      databaseURL.path(percentEncoded: false),
      &database,
      SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
      nil
    ) == SQLITE_OK, let database else {
      let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
      sqlite3_close(database)
      throw DatabaseError.open(message)
    }

    defer {
      sqlite3_close(database)
    }

    sqlite3_busy_timeout(database, 2_000)
    return try operation(database)
  }

  func configure(_ database: OpaquePointer) throws {
    try execute(database, sql: "PRAGMA journal_mode=WAL")
    try execute(database, sql: "PRAGMA synchronous=NORMAL")
    try execute(
      database,
      sql: """
      CREATE VIRTUAL TABLE IF NOT EXISTS documents USING fts5(
        path UNINDEXED,
        name,
        body,
        folded,
        tokenize='trigram'
      )
      """
    )
  }

  func execute(_ database: OpaquePointer, sql: String) throws {
    var errorMessage: UnsafeMutablePointer<CChar>?
    guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
      let message = errorMessage.map { String(cString: $0) }
        ?? String(cString: sqlite3_errmsg(database))
      sqlite3_free(errorMessage)
      throw DatabaseError.execute(message)
    }
  }

  @discardableResult
  func insert(_ url: URL, database: OpaquePointer) throws -> Bool {
    guard let body = fileContents(url) else {
      return false
    }

    let relativePath = url.relativePath(from: rootURL)
    let folded = Self.fold("\(relativePath)\n\(body)")
    let sql = "INSERT INTO documents(path, name, body, folded) VALUES(?, ?, ?, ?)"
    var statement: OpaquePointer?

    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw DatabaseError.prepare(String(cString: sqlite3_errmsg(database)))
    }

    defer {
      sqlite3_finalize(statement)
    }

    bind(relativePath, at: 1, statement: statement)
    bind(url.lastPathComponent, at: 2, statement: statement)
    bind(body, at: 3, statement: statement)
    bind(folded, at: 4, statement: statement)

    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw DatabaseError.execute(String(cString: sqlite3_errmsg(database)))
    }
    return true
  }

  func remove(_ url: URL, database: OpaquePointer) throws {
    let sql = "DELETE FROM documents WHERE path = ?"
    var statement: OpaquePointer?

    guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw DatabaseError.prepare(String(cString: sqlite3_errmsg(database)))
    }

    defer {
      sqlite3_finalize(statement)
    }

    bind(url.relativePath(from: rootURL), at: 1, statement: statement)
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw DatabaseError.execute(String(cString: sqlite3_errmsg(database)))
    }
  }

  func searchDatabase(_ query: String) throws -> [WorkspaceSearchResult] {
    try withDatabase { database in
      try configure(database)

      let foldedQuery = Self.fold(query)
      let isShortQuery = query.count < 3
      let sql: String

      if isShortQuery {
        sql = """
        SELECT path, body
        FROM documents
        WHERE instr(folded, ?) > 0
        LIMIT \(Self.maximumResultCount)
        """
      } else {
        sql = """
        SELECT path, body
        FROM documents
        WHERE documents MATCH ?
        ORDER BY bm25(documents)
        LIMIT \(Self.maximumResultCount)
        """
      }

      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
        throw DatabaseError.prepare(String(cString: sqlite3_errmsg(database)))
      }

      defer {
        sqlite3_finalize(statement)
      }

      let quotedQuery = foldedQuery.replacingOccurrences(of: "\"", with: "\"\"")
      let boundQuery = isShortQuery ? foldedQuery : "\"\(quotedQuery)\""
      bind(boundQuery, at: 1, statement: statement)

      var results = [WorkspaceSearchResult]()
      while sqlite3_step(statement) == SQLITE_ROW {
        guard !Task.isCancelled else {
          break
        }

        guard let pathValue = sqlite3_column_text(statement, 0),
              let bodyValue = sqlite3_column_text(statement, 1) else {
          continue
        }

        let relativePath = String(cString: pathValue)
        let body = String(cString: bodyValue)
        results.append(contentsOf: Self.results(
          rootURL: rootURL,
          relativePath: relativePath,
          body: body,
          query: query,
          remainingCount: Self.maximumResultCount - results.count
        ))

        if results.count >= Self.maximumResultCount {
          break
        }
      }

      return results
    }
  }

  func bind(_ value: String, at index: Int32, statement: OpaquePointer) {
    sqlite3_bind_text(
      statement,
      index,
      value,
      -1,
      unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    )
  }
}

// MARK: - Files

private extension WorkspaceIndex {
  static let excludedDirectories: Set<String> = [
    ".build",
    ".git",
    ".hg",
    ".svn",
    "DerivedData",
    "Pods",
    "build",
    "dist",
    "node_modules",
  ]

  func indexableFiles() -> [URL] {
    let keys: [URLResourceKey] = [
      .fileSizeKey,
      .isDirectoryKey,
      .isRegularFileKey,
      .isSymbolicLinkKey,
    ]

    guard let enumerator = FileManager.default.enumerator(
      at: rootURL,
      includingPropertiesForKeys: keys,
      options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
      return []
    }

    var files = [URL]()
    for case let url as URL in enumerator {
      let values = try? url.resourceValues(forKeys: Set(keys))

      if values?.isDirectory == true {
        if Self.excludedDirectories.contains(url.lastPathComponent) || values?.isSymbolicLink == true {
          enumerator.skipDescendants()
        }
        continue
      }

      if isIndexable(url, values: values) {
        files.append(url)
      }
    }

    return files
  }

  func isIndexable(_ url: URL, values providedValues: URLResourceValues? = nil) -> Bool {
    let values = providedValues ?? (try? url.resourceValues(forKeys: [
      .fileSizeKey,
      .isRegularFileKey,
      .isSymbolicLinkKey,
    ]))

    guard values?.isRegularFile == true,
          values?.isSymbolicLink != true,
          (values?.fileSize ?? Self.maximumFileSize + 1) <= Self.maximumFileSize else {
      return false
    }

    let type = UTType(filenameExtension: url.pathExtension)
    return type?.conforms(to: .text) == true || Self.textExtensions.contains(url.pathExtension.lowercased())
  }

  func fileContents(_ url: URL) -> String? {
    guard let data = try? Data(contentsOf: url, options: [.mappedIfSafe]) else {
      return nil
    }

    if data.prefix(8_192).contains(0) {
      return nil
    }

    for encoding in Self.encodings {
      if let value = String(data: data, encoding: encoding) {
        return value.precomposedStringWithCanonicalMapping
      }
    }

    return nil
  }

  func linearSearch(_ query: String) -> [WorkspaceSearchResult] {
    var results = [WorkspaceSearchResult]()

    for url in indexableFiles() {
      guard !Task.isCancelled else {
        break
      }

      guard results.count < Self.maximumResultCount else {
        break
      }
      guard let body = fileContents(url) else {
        continue
      }

      let relativePath = url.relativePath(from: rootURL)
      let searchable = Self.fold("\(relativePath)\n\(body)")
      guard searchable.contains(Self.fold(query)) else {
        continue
      }

      results.append(contentsOf: Self.results(
        rootURL: rootURL,
        relativePath: relativePath,
        body: body,
        query: query,
        remainingCount: Self.maximumResultCount - results.count
      ))
    }

    return results
  }

  static let textExtensions: Set<String> = [
    "adoc",
    "markdown",
    "md",
    "mdown",
    "mdx",
    "mkd",
    "qmd",
    "rmd",
    "text",
    "txt",
  ]

  static let encodings: [String.Encoding] = [
    .utf8,
    .utf16,
    .utf16LittleEndian,
    .utf16BigEndian,
    .windowsCP1252,
    .shiftJIS,
    .japaneseEUC,
  ]
}

// MARK: - Helpers

private extension WorkspaceIndex {
  static func defaultDatabaseURL(rootURL: URL) -> URL {
    let hash = SHA256.hash(data: Data(rootURL.standardizedFileURL.path.utf8))
      .map { String(format: "%02x", $0) }
      .joined()

    let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory

    return cacheURL
      .appending(path: "WorkspaceIndex", directoryHint: .isDirectory)
      .appending(path: "\(hash).sqlite", directoryHint: .notDirectory)
  }

  static func fold(_ value: String) -> String {
    value
      .precomposedStringWithCanonicalMapping
      .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
  }

  static func results(
    rootURL: URL,
    relativePath: String,
    body: String,
    query: String,
    remainingCount: Int
  ) -> [WorkspaceSearchResult] {
    let lines = body.components(separatedBy: .newlines)
    let foldedQuery = fold(query)
    var matchingLineIndices = lines.indices.filter {
      fold(lines[$0]).contains(foldedQuery)
    }

    if matchingLineIndices.isEmpty, fold(relativePath).contains(foldedQuery) {
      matchingLineIndices = [0]
    }

    return matchingLineIndices.prefix(max(0, remainingCount)).map { lineIndex in
      WorkspaceSearchResult(
        url: rootURL.appending(path: relativePath),
        relativePath: relativePath,
        lineNumber: lineIndex + 1,
        snippet: lines.indices.contains(lineIndex)
          ? lines[lineIndex].trimmingCharacters(in: .whitespaces)
          : ""
      )
    }
  }
}

private extension URL {
  func isDescendant(of rootURL: URL) -> Bool {
    let rootComponents = rootURL.standardizedFileURL.pathComponents
    let components = standardizedFileURL.pathComponents
    return components.count > rootComponents.count && components.prefix(rootComponents.count) == rootComponents[...]
  }

  func relativePath(from rootURL: URL) -> String {
    let rootComponents = rootURL.standardizedFileURL.pathComponents
    let components = standardizedFileURL.pathComponents

    guard components.prefix(rootComponents.count) == rootComponents[...] else {
      return lastPathComponent
    }

    return components.dropFirst(rootComponents.count).joined(separator: "/")
  }
}
