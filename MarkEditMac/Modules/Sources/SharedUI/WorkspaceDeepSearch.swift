// swiftlint:disable file_length
//
//  WorkspaceDeepSearch.swift
//
//  Private, on-device semantic search for ksamint MarkEdit.
//

import Accelerate
@preconcurrency import CoreML
import CryptoKit
import Foundation
import SQLite3

public enum WorkspaceDeepSearchState: Sendable, Equatable {
  case modelNotInstalled
  case downloading(progress: Double)
  case indexing(completed: Int, total: Int)
  case ready(chunkCount: Int)
  case failed(String)
}

public enum WorkspaceDeepSearchError: LocalizedError {
  case invalidManifest
  case invalidModelDigest
  case modelNotInstalled
  case unsupportedModelInterface
  case unsafeWorkspacePath

  public var errorDescription: String? {
    switch self {
    case .invalidManifest:
      "The Deep Search model manifest is invalid."
    case .invalidModelDigest:
      "The downloaded Deep Search model failed verification."
    case .modelNotInstalled:
      "The optional Deep Search model has not been downloaded."
    case .unsupportedModelInterface:
      "The Deep Search model does not expose the expected text and embedding features."
    case .unsafeWorkspacePath:
      "A Deep Search result resolved outside the workspace."
    }
  }
}

public struct WorkspaceDeepSearchModelManifest: Codable, Sendable, Equatable {
  public let version: String
  public let modelURL: URL
  public let sha256: String
  public let byteSize: Int
  public let dimensions: Int
  public let inputFeature: String
  public let outputFeature: String

  public init(
    version: String,
    modelURL: URL,
    sha256: String,
    byteSize: Int,
    dimensions: Int = 384,
    inputFeature: String = "text",
    outputFeature: String = "sentence_embedding"
  ) {
    self.version = version
    self.modelURL = modelURL
    self.sha256 = sha256
    self.byteSize = byteSize
    self.dimensions = dimensions
    self.inputFeature = inputFeature
    self.outputFeature = outputFeature
  }
}

public struct WorkspaceDeepSearchHit: Sendable, Equatable {
  public let result: WorkspaceSearchResult
  public let score: Float

  public init(result: WorkspaceSearchResult, score: Float) {
    self.result = result
    self.score = score
  }
}

public actor WorkspaceDeepSearch {
  public static let defaultManifestURL = URL(
    string: "https://notes.apuch.cn/models/multilingual-e5-small/v1/manifest.json"
  )!
  public static let exactSearchThreshold = 10_000
  public static let maximumResultCount = 100

  public private(set) var state: WorkspaceDeepSearchState
  public var onStateChange: (@Sendable (WorkspaceDeepSearchState) -> Void)?

  private let rootURL: URL
  private let databaseURL: URL
  private let modelStore: WorkspaceDeepSearchModelStore
  private var embeddingModel: WorkspaceEmbeddingModel?
  private var cachedIndex: HNSWIndex?

  public init(
    rootURL: URL,
    databaseURL: URL? = nil,
    modelDirectoryURL: URL? = nil
  ) {
    let standardizedRoot = rootURL.standardizedFileURL
    self.rootURL = standardizedRoot
    self.databaseURL = databaseURL ?? Self.defaultDatabaseURL(rootURL: standardizedRoot)
    self.modelStore = WorkspaceDeepSearchModelStore(
      directoryURL: modelDirectoryURL ?? Self.defaultModelDirectoryURL
    )
    self.state = modelStore.hasInstalledModel ? .ready(chunkCount: 0) : .modelNotInstalled
  }

  public func installModel(
    manifestURL: URL = defaultManifestURL
  ) async throws {
    updateState(.downloading(progress: 0))
    do {
      let manifest = try await modelStore.install(manifestURL: manifestURL) { [weak self] progress in
        await self?.updateState(.downloading(progress: progress))
      }
      embeddingModel = try modelStore.load(manifest: manifest)
      updateState(.ready(chunkCount: try chunkCount()))
    } catch {
      updateState(.failed(error.localizedDescription))
      throw error
    }
  }

  @discardableResult
  public func rebuild() async throws -> Int {
    let model = try loadModel()
    let chunks = try sourceChunks()
    updateState(.indexing(completed: 0, total: chunks.count))

    do {
      let existing = try existingChunkDigests()
      var records = [DeepChunkRecord]()
      records.reserveCapacity(chunks.count)
      for (index, chunk) in chunks.enumerated() {
        try Task.checkCancellation()
        if let current = existing[chunk.id], current.digest == chunk.digest {
          records.append(
            DeepChunkRecord(
              id: chunk.id,
              path: chunk.path,
              lineNumber: chunk.lineNumber,
              text: chunk.text,
              digest: chunk.digest,
              embedding: current.embedding
            )
          )
        } else {
          let embedding = try await model.embedding(for: "passage: \(chunk.text)")
          records.append(
            DeepChunkRecord(
              id: chunk.id,
              path: chunk.path,
              lineNumber: chunk.lineNumber,
              text: chunk.text,
              digest: chunk.digest,
              embedding: embedding
            )
          )
        }
        if index.isMultiple(of: 20) || index + 1 == chunks.count {
          updateState(.indexing(completed: index + 1, total: chunks.count))
        }
      }

      let index = HNSWIndex(records: records)
      try persist(records: records, index: index)
      cachedIndex = index
      updateState(.ready(chunkCount: records.count))
      return records.count
    } catch {
      if error is CancellationError {
        updateState(.ready(chunkCount: (try? chunkCount()) ?? 0))
      } else {
        updateState(.failed(error.localizedDescription))
      }
      throw error
    }
  }

  public func search(
    _ query: String,
    limit requestedLimit: Int = 20
  ) async throws -> [WorkspaceDeepSearchHit] {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return []
    }
    let model = try loadModel()
    let queryEmbedding = try await model.embedding(for: "query: \(trimmed)")
    let index: HNSWIndex
    if let cachedIndex {
      index = cachedIndex
    } else {
      let loaded = try loadIndex()
      cachedIndex = loaded
      index = loaded
    }
    let limit = min(max(requestedLimit, 1), Self.maximumResultCount)
    let matches = index.records.count < Self.exactSearchThreshold
      ? index.exactSearch(queryEmbedding, limit: limit)
      : index.search(queryEmbedding, limit: limit, efSearch: max(80, limit * 4))
    return try matches.map { match in
      let record = index.records[match.index]
      let url = rootURL.appending(path: record.path).standardizedFileURL
      guard Self.isDescendant(url, of: rootURL) else {
        throw WorkspaceDeepSearchError.unsafeWorkspacePath
      }
      return WorkspaceDeepSearchHit(
        result: WorkspaceSearchResult(
          url: url,
          relativePath: record.path,
          lineNumber: record.lineNumber,
          snippet: record.text.prefix(240).description
        ),
        score: 1 - match.distance
      )
    }
  }
}

// MARK: - Model

private actor WorkspaceEmbeddingModel {
  private let model: MLModel
  private let inputFeature: String
  private let outputFeature: String
  private let dimensions: Int

  init(
    modelURL: URL,
    inputFeature: String,
    outputFeature: String,
    dimensions: Int
  ) throws {
    let configuration = MLModelConfiguration()
    configuration.computeUnits = .all
    self.model = try MLModel(contentsOf: modelURL, configuration: configuration)
    self.inputFeature = inputFeature
    self.outputFeature = outputFeature
    self.dimensions = dimensions
  }

  func embedding(for text: String) async throws -> [Float] {
    let input = try MLDictionaryFeatureProvider(
      dictionary: [inputFeature: MLFeatureValue(string: text)]
    )
    let prediction = try await model.prediction(from: input)
    guard let values = prediction.featureValue(for: outputFeature)?.multiArrayValue,
          values.count == dimensions
    else {
      throw WorkspaceDeepSearchError.unsupportedModelInterface
    }
    var result = [Float](repeating: 0, count: dimensions)
    for index in 0..<dimensions {
      result[index] = values[index].floatValue
    }
    normalize(&result)
    return result
  }
}

private final class WorkspaceDeepSearchModelStore: @unchecked Sendable {
  let directoryURL: URL

  init(directoryURL: URL) {
    self.directoryURL = directoryURL
  }

  var hasInstalledModel: Bool {
    FileManager.default.fileExists(atPath: manifestURL.path)
      && FileManager.default.fileExists(atPath: compiledModelURL.path)
  }

  func install(
    manifestURL sourceURL: URL,
    progress: @escaping @Sendable (Double) async -> Void
  ) async throws -> WorkspaceDeepSearchModelManifest {
    guard sourceURL.scheme == "https" else {
      throw WorkspaceDeepSearchError.invalidManifest
    }
    let (manifestData, response) = try await URLSession.shared.data(from: sourceURL)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      throw WorkspaceDeepSearchError.invalidManifest
    }
    let manifest = try JSONDecoder().decode(
      WorkspaceDeepSearchModelManifest.self,
      from: manifestData
    )
    guard manifest.modelURL.scheme == "https",
          manifest.dimensions == 384,
          manifest.byteSize > 0,
          manifest.sha256.count == 64
    else {
      throw WorkspaceDeepSearchError.invalidManifest
    }
    try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
    let temporaryURL = directoryURL.appending(path: "model.download")
    try? FileManager.default.removeItem(at: temporaryURL)
    let (downloadedURL, downloadResponse) = try await URLSession.shared.download(from: manifest.modelURL)
    guard (downloadResponse as? HTTPURLResponse)?.statusCode == 200 else {
      throw WorkspaceDeepSearchError.invalidManifest
    }
    try FileManager.default.moveItem(at: downloadedURL, to: temporaryURL)
    await progress(0.8)
    let resourceValues = try temporaryURL.resourceValues(forKeys: [.fileSizeKey])
    guard resourceValues.fileSize == manifest.byteSize,
          try Self.sha256(temporaryURL) == manifest.sha256.lowercased()
    else {
      try? FileManager.default.removeItem(at: temporaryURL)
      throw WorkspaceDeepSearchError.invalidModelDigest
    }
    let compiledTemporaryURL = try await MLModel.compileModel(at: temporaryURL)
    try? FileManager.default.removeItem(at: compiledModelURL)
    try FileManager.default.moveItem(at: compiledTemporaryURL, to: compiledModelURL)
    try? FileManager.default.removeItem(at: modelURL)
    try FileManager.default.moveItem(at: temporaryURL, to: modelURL)
    try manifestData.write(to: manifestURL, options: .atomic)
    await progress(1)
    return manifest
  }

  func load(
    manifest: WorkspaceDeepSearchModelManifest? = nil
  ) throws -> WorkspaceEmbeddingModel {
    let manifest = try manifest ?? JSONDecoder().decode(
      WorkspaceDeepSearchModelManifest.self,
      from: Data(contentsOf: manifestURL)
    )
    guard FileManager.default.fileExists(atPath: compiledModelURL.path) else {
      throw WorkspaceDeepSearchError.modelNotInstalled
    }
    return try WorkspaceEmbeddingModel(
      modelURL: compiledModelURL,
      inputFeature: manifest.inputFeature,
      outputFeature: manifest.outputFeature,
      dimensions: manifest.dimensions
    )
  }

  private var modelURL: URL {
    directoryURL.appending(path: "multilingual-e5-small.mlmodel")
  }

  private var compiledModelURL: URL {
    directoryURL.appending(path: "multilingual-e5-small.mlmodelc")
  }

  private var manifestURL: URL {
    directoryURL.appending(path: "manifest.json")
  }

  private static func sha256(_ url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer {
      try? handle.close()
    }
    var hasher = SHA256()
    while let data = try handle.read(upToCount: 1024 * 1024), !data.isEmpty {
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}

// MARK: - Chunks and persistence

private struct SourceChunk {
  let id: String
  let path: String
  let lineNumber: Int
  let text: String
  let digest: String
}

private struct DeepChunkRecord {
  let id: String
  let path: String
  let lineNumber: Int
  let text: String
  let digest: String
  let embedding: [Float]
}

private extension WorkspaceDeepSearch {
  static var defaultModelDirectoryURL: URL {
    let support = FileManager.default.homeDirectoryForCurrentUser
      .appending(path: "Library/Application Support", directoryHint: .isDirectory)
    return support.appending(path: "MarkEdit/DeepSearch/multilingual-e5-small-v1")
  }

  static func defaultDatabaseURL(rootURL: URL) -> URL {
    let digest = SHA256.hash(data: Data(rootURL.path.utf8))
      .map { String(format: "%02x", $0) }
      .joined()
    let support = FileManager.default.homeDirectoryForCurrentUser
      .appending(path: "Library/Application Support", directoryHint: .isDirectory)
    return support.appending(path: "MarkEdit/WorkspaceIndex/\(digest)-deep.sqlite")
  }

  func updateState(_ value: WorkspaceDeepSearchState) {
    state = value
    onStateChange?(value)
  }

  func loadModel() throws -> WorkspaceEmbeddingModel {
    if let embeddingModel {
      return embeddingModel
    }
    let model = try modelStore.load()
    embeddingModel = model
    return model
  }

  func sourceChunks() throws -> [SourceChunk] {
    let keys: Set<URLResourceKey> = [
      .isRegularFileKey,
      .isSymbolicLinkKey,
      .fileSizeKey,
    ]
    guard let enumerator = FileManager.default.enumerator(
      at: rootURL,
      includingPropertiesForKeys: Array(keys),
      options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
      return []
    }
    var chunks = [SourceChunk]()
    for case let url as URL in enumerator {
      try Task.checkCancellation()
      let values = try? url.resourceValues(forKeys: keys)
      guard values?.isRegularFile == true,
            values?.isSymbolicLink != true,
            (values?.fileSize ?? 0) <= WorkspaceIndex.maximumFileSize,
            ["md", "markdown", "mdown"].contains(url.pathExtension.lowercased()),
            Self.isDescendant(
              url.resolvingSymlinksInPath(),
              of: rootURL.resolvingSymlinksInPath()
            ),
            let text = try? String(contentsOf: url, encoding: .utf8)
      else {
        continue
      }
      let path = Self.relativePath(url, from: rootURL)
      chunks.append(contentsOf: Self.chunks(text, path: path))
    }
    return chunks
  }

  static func chunks(_ text: String, path: String) -> [SourceChunk] {
    var values = [SourceChunk]()
    var current = [String]()
    var startLine = 1
    var inCodeFence = false

    func flush() {
      let value = current.joined(separator: "\n")
        .trimmingCharacters(in: .whitespacesAndNewlines)
      current.removeAll(keepingCapacity: true)
      guard !value.isEmpty else {
        return
      }
      let digest = SHA256.hash(data: Data(value.utf8))
        .map { String(format: "%02x", $0) }
        .joined()
      let idInput = "\(path):\(startLine):\(digest)"
      let id = SHA256.hash(data: Data(idInput.utf8))
        .map { String(format: "%02x", $0) }
        .joined()
      values.append(
        SourceChunk(
          id: id,
          path: path,
          lineNumber: startLine,
          text: value,
          digest: digest
        )
      )
    }

    let lines = text.split(
      separator: "\n",
      omittingEmptySubsequences: false
    )
    for (offset, line) in lines.enumerated() {
      let lineNumber = offset + 1
      let string = String(line)
      let trimmed = string.trimmingCharacters(in: .whitespaces)
      if trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") {
        if !inCodeFence {
          flush()
        }
        inCodeFence.toggle()
        startLine = lineNumber + 1
        continue
      }
      guard !inCodeFence else {
        continue
      }
      let beginsBlock = trimmed.hasPrefix("#")
        || trimmed.hasPrefix("- ")
        || trimmed.hasPrefix("* ")
        || trimmed.hasPrefix("+ ")
        || trimmed.range(of: #"^\d+[.)]\s"#, options: .regularExpression) != nil
      if (trimmed.isEmpty || beginsBlock) && !current.isEmpty {
        flush()
      }
      if current.isEmpty {
        startLine = lineNumber
      }
      if !trimmed.isEmpty {
        current.append(string)
      }
      if current.joined(separator: "\n").utf8.count >= 1_500 {
        flush()
        startLine = lineNumber + 1
      }
    }
    flush()
    return values
  }

  static func isDescendant(_ url: URL, of rootURL: URL) -> Bool {
    let rootComponents = rootURL.standardizedFileURL.pathComponents
    let components = url.standardizedFileURL.pathComponents
    return components.count >= rootComponents.count
      && components.prefix(rootComponents.count) == rootComponents[...]
  }

  static func relativePath(_ url: URL, from rootURL: URL) -> String {
    let rootPath = rootURL.standardizedFileURL.path
    let path = url.standardizedFileURL.path
    guard path.hasPrefix(rootPath) else {
      return url.lastPathComponent
    }
    return String(path.dropFirst(rootPath.count)).trimmingCharacters(
      in: CharacterSet(charactersIn: "/")
    )
  }

  struct StoredChunk {
    let digest: String
    let embedding: [Float]
  }

  func existingChunkDigests() throws -> [String: StoredChunk] {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        "SELECT id, digest, embedding FROM deep_chunks",
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw DatabaseFailure.prepare
      }
      defer {
        sqlite3_finalize(statement)
      }
      var values = [String: StoredChunk]()
      while sqlite3_step(statement) == SQLITE_ROW {
        let id = Self.string(statement, column: 0)
        let digest = Self.string(statement, column: 1)
        values[id] = StoredChunk(
          digest: digest,
          embedding: Self.floatArray(statement, column: 2)
        )
      }
      return values
    }
  }

  func persist(records: [DeepChunkRecord], index: HNSWIndex) throws {
    try withDatabase { database in
      try configure(database)
      try execute(database, "BEGIN IMMEDIATE")
      do {
        try execute(database, "DELETE FROM deep_chunks")
        try execute(database, "DELETE FROM deep_hnsw_edges")
        for (position, record) in records.enumerated() {
          try insertChunk(database, record: record, position: position)
        }
        for (position, levels) in index.neighbors.enumerated() {
          for (level, neighbors) in levels.enumerated() where !neighbors.isEmpty {
            let data = try JSONEncoder().encode(neighbors)
            try insertEdges(database, position: position, level: level, data: data)
          }
        }
        try execute(database, "COMMIT")
      } catch {
        try? execute(database, "ROLLBACK")
        throw error
      }
    }
  }

  func loadIndex() throws -> HNSWIndex {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        """
        SELECT id, path, line_number, text, digest, embedding
        FROM deep_chunks ORDER BY position
        """,
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw DatabaseFailure.prepare
      }
      defer {
        sqlite3_finalize(statement)
      }
      var records = [DeepChunkRecord]()
      while sqlite3_step(statement) == SQLITE_ROW {
        records.append(
          DeepChunkRecord(
            id: Self.string(statement, column: 0),
            path: Self.string(statement, column: 1),
            lineNumber: Int(sqlite3_column_int64(statement, 2)),
            text: Self.string(statement, column: 3),
            digest: Self.string(statement, column: 4),
            embedding: Self.floatArray(statement, column: 5)
          )
        )
      }
      var index = HNSWIndex(emptyRecords: records)
      guard !records.isEmpty else {
        return index
      }
      var edgeStatement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        "SELECT position, level, neighbors FROM deep_hnsw_edges",
        -1,
        &edgeStatement,
        nil
      ) == SQLITE_OK, let edgeStatement else {
        throw DatabaseFailure.prepare
      }
      defer {
        sqlite3_finalize(edgeStatement)
      }
      while sqlite3_step(edgeStatement) == SQLITE_ROW {
        let position = Int(sqlite3_column_int64(edgeStatement, 0))
        let level = Int(sqlite3_column_int64(edgeStatement, 1))
        let data = Self.data(edgeStatement, column: 2)
        guard index.neighbors.indices.contains(position),
              index.neighbors[position].indices.contains(level),
              let neighbors = try? JSONDecoder().decode([Int].self, from: data)
        else {
          continue
        }
        index.neighbors[position][level] = neighbors
      }
      return index
    }
  }

  func chunkCount() throws -> Int {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        "SELECT COUNT(*) FROM deep_chunks",
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw DatabaseFailure.prepare
      }
      defer {
        sqlite3_finalize(statement)
      }
      return sqlite3_step(statement) == SQLITE_ROW
        ? Int(sqlite3_column_int64(statement, 0))
        : 0
    }
  }

  enum DatabaseFailure: Error {
    case open
    case execute
    case prepare
  }

  func withDatabase<T>(_ operation: (OpaquePointer) throws -> T) throws -> T {
    try FileManager.default.createDirectory(
      at: databaseURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    var database: OpaquePointer?
    guard sqlite3_open_v2(
      databaseURL.path,
      &database,
      SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
      nil
    ) == SQLITE_OK, let database else {
      sqlite3_close(database)
      throw DatabaseFailure.open
    }
    defer {
      sqlite3_close(database)
    }
    sqlite3_busy_timeout(database, 2_000)
    return try operation(database)
  }

  func configure(_ database: OpaquePointer) throws {
    try execute(database, "PRAGMA journal_mode=WAL")
    try execute(database, "PRAGMA synchronous=NORMAL")
    try execute(
      database,
      """
      CREATE TABLE IF NOT EXISTS deep_chunks (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL UNIQUE,
        path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        digest TEXT NOT NULL,
        embedding BLOB NOT NULL
      )
      """
    )
    try execute(
      database,
      """
      CREATE TABLE IF NOT EXISTS deep_hnsw_edges (
        position INTEGER NOT NULL,
        level INTEGER NOT NULL,
        neighbors BLOB NOT NULL,
        PRIMARY KEY (position, level)
      )
      """
    )
  }

  func execute(_ database: OpaquePointer, _ sql: String) throws {
    guard sqlite3_exec(database, sql, nil, nil, nil) == SQLITE_OK else {
      throw DatabaseFailure.execute
    }
  }

  func insertChunk(
    _ database: OpaquePointer,
    record: DeepChunkRecord,
    position: Int
  ) throws {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(
      database,
      """
      INSERT INTO deep_chunks(id, position, path, line_number, text, digest, embedding)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      """,
      -1,
      &statement,
      nil
    ) == SQLITE_OK, let statement else {
      throw DatabaseFailure.prepare
    }
    defer {
      sqlite3_finalize(statement)
    }
    Self.bind(record.id, index: 1, statement: statement)
    sqlite3_bind_int64(statement, 2, Int64(position))
    Self.bind(record.path, index: 3, statement: statement)
    sqlite3_bind_int64(statement, 4, Int64(record.lineNumber))
    Self.bind(record.text, index: 5, statement: statement)
    Self.bind(record.digest, index: 6, statement: statement)
    let data = Self.float16Data(record.embedding)
    _ = data.withUnsafeBytes {
      sqlite3_bind_blob(statement, 7, $0.baseAddress, Int32($0.count), SQLITE_TRANSIENT)
    }
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw DatabaseFailure.execute
    }
  }

  func insertEdges(
    _ database: OpaquePointer,
    position: Int,
    level: Int,
    data: Data
  ) throws {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(
      database,
      "INSERT INTO deep_hnsw_edges(position, level, neighbors) VALUES(?, ?, ?)",
      -1,
      &statement,
      nil
    ) == SQLITE_OK, let statement else {
      throw DatabaseFailure.prepare
    }
    defer {
      sqlite3_finalize(statement)
    }
    sqlite3_bind_int64(statement, 1, Int64(position))
    sqlite3_bind_int64(statement, 2, Int64(level))
    _ = data.withUnsafeBytes {
      sqlite3_bind_blob(statement, 3, $0.baseAddress, Int32($0.count), SQLITE_TRANSIENT)
    }
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw DatabaseFailure.execute
    }
  }

  static func bind(_ value: String, index: Int32, statement: OpaquePointer) {
    _ = value.withCString {
      sqlite3_bind_text(statement, index, $0, -1, SQLITE_TRANSIENT)
    }
  }

  static func string(_ statement: OpaquePointer, column: Int32) -> String {
    guard let pointer = sqlite3_column_text(statement, column) else {
      return ""
    }
    return String(cString: pointer)
  }

  static func data(_ statement: OpaquePointer, column: Int32) -> Data {
    guard let pointer = sqlite3_column_blob(statement, column) else {
      return Data()
    }
    return Data(bytes: pointer, count: Int(sqlite3_column_bytes(statement, column)))
  }

  static func float16Data(_ values: [Float]) -> Data {
    var bytes = [UInt8]()
    bytes.reserveCapacity(values.count * 2)
    for value in values {
      let bits = binary16Bits(value)
      bytes.append(UInt8(truncatingIfNeeded: bits))
      bytes.append(UInt8(truncatingIfNeeded: bits >> 8))
    }
    return Data(bytes)
  }

  static func floatArray(_ statement: OpaquePointer, column: Int32) -> [Float] {
    floatArray(fromBinary16Data: data(statement, column: column))
  }

  static func floatArray(fromBinary16Data data: Data) -> [Float] {
    guard data.count.isMultiple(of: 2) else {
      return []
    }
    return data.withUnsafeBytes { rawBytes in
      let bytes = rawBytes.bindMemory(to: UInt8.self)
      return stride(from: 0, to: bytes.count, by: 2).map { offset in
        let bits = UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
        return float(fromBinary16Bits: bits)
      }
    }
  }

  static func binary16Bits(_ value: Float) -> UInt16 {
    let bits = value.bitPattern
    let sign = UInt16(truncatingIfNeeded: (bits >> 16) & 0x8000)
    let sourceExponent = Int((bits >> 23) & 0xff)
    let sourceSignificand = bits & 0x7f_ffff

    if sourceExponent == 0xff {
      guard sourceSignificand != 0 else {
        return sign | 0x7c00
      }
      return sign | 0x7c00 | max(1, UInt16(truncatingIfNeeded: sourceSignificand >> 13))
    }

    let exponent = sourceExponent - 127 + 15
    if exponent >= 0x1f {
      return sign | 0x7c00
    }
    if exponent <= 0 {
      guard exponent >= -10 else {
        return sign
      }
      let significand = sourceSignificand | 0x80_0000
      let shift = UInt32(14 - exponent)
      var rounded = significand >> shift
      let remainderMask = (UInt32(1) << shift) - 1
      let remainder = significand & remainderMask
      let halfway = UInt32(1) << (shift - 1)
      if remainder > halfway || (remainder == halfway && rounded & 1 == 1) {
        rounded += 1
      }
      return sign | UInt16(truncatingIfNeeded: rounded)
    }

    var targetExponent = UInt16(exponent) << 10
    var targetSignificand = UInt16(truncatingIfNeeded: sourceSignificand >> 13)
    let remainder = sourceSignificand & 0x1fff
    if remainder > 0x1000 || (remainder == 0x1000 && targetSignificand & 1 == 1) {
      targetSignificand += 1
      if targetSignificand == 0x400 {
        targetSignificand = 0
        targetExponent += 0x400
        if targetExponent >= 0x7c00 {
          return sign | 0x7c00
        }
      }
    }
    return sign | targetExponent | targetSignificand
  }

  static func float(fromBinary16Bits bits: UInt16) -> Float {
    let sign = UInt32(bits & 0x8000) << 16
    let exponent = Int((bits >> 10) & 0x1f)
    var significand = UInt32(bits & 0x03ff)
    let output: UInt32

    if exponent == 0 {
      if significand == 0 {
        output = sign
      } else {
        var unbiasedExponent = -14
        while significand & 0x0400 == 0 {
          significand <<= 1
          unbiasedExponent -= 1
        }
        significand &= 0x03ff
        output = sign
          | UInt32(unbiasedExponent + 127) << 23
          | significand << 13
      }
    } else if exponent == 0x1f {
      output = sign | 0x7f80_0000 | significand << 13
    } else {
      output = sign
        | UInt32(exponent - 15 + 127) << 23
        | significand << 13
    }
    return Float(bitPattern: output)
  }
}

extension WorkspaceDeepSearch {
  static func encodeBinary16(_ values: [Float]) -> Data {
    float16Data(values)
  }

  static func decodeBinary16(_ data: Data) -> [Float] {
    floatArray(fromBinary16Data: data)
  }
}

// MARK: - HNSW

private struct HNSWMatch {
  let index: Int
  let distance: Float
}

private struct HNSWIndex {
  let records: [DeepChunkRecord]
  var neighbors: [[[Int]]]
  private(set) var entryPoint: Int?
  private(set) var maximumLevel = 0
  private let maximumNeighbors = 16
  private let constructionCandidates = 64

  init(records: [DeepChunkRecord]) {
    self.records = records
    self.neighbors = records.map {
      Array(repeating: [], count: Self.level(for: $0.id) + 1)
    }
    for index in records.indices {
      insert(index)
    }
  }

  init(emptyRecords records: [DeepChunkRecord]) {
    self.records = records
    self.neighbors = records.map {
      Array(repeating: [], count: Self.level(for: $0.id) + 1)
    }
    self.maximumLevel = neighbors.map(\.count).max().map { max(0, $0 - 1) } ?? 0
    self.entryPoint = records.isEmpty ? nil : records.indices.max {
      neighbors[$0].count < neighbors[$1].count
    }
  }

  mutating func insert(_ index: Int) {
    guard let entryPoint else {
      self.entryPoint = index
      maximumLevel = neighbors[index].count - 1
      return
    }
    let level = neighbors[index].count - 1
    var current = entryPoint
    if maximumLevel > level {
      for searchLevel in stride(from: maximumLevel, through: level + 1, by: -1) {
        current = greedyNearest(records[index].embedding, entry: current, level: searchLevel)
      }
    }
    for searchLevel in stride(from: min(level, maximumLevel), through: 0, by: -1) {
      let candidates = searchLayer(
        records[index].embedding,
        entries: [current],
        level: searchLevel,
        ef: constructionCandidates
      )
      let selected = Array(candidates.prefix(maximumNeighbors)).map(\.index)
      neighbors[index][searchLevel] = selected
      for neighbor in selected {
        guard neighbors[neighbor].indices.contains(searchLevel) else {
          continue
        }
        neighbors[neighbor][searchLevel].append(index)
        neighbors[neighbor][searchLevel] = nearest(
          records[neighbor].embedding,
          indices: neighbors[neighbor][searchLevel],
          limit: maximumNeighbors
        )
      }
      current = selected.first ?? current
    }
    if level > maximumLevel {
      self.entryPoint = index
      maximumLevel = level
    }
  }

  func search(_ query: [Float], limit: Int, efSearch: Int) -> [HNSWMatch] {
    guard var current = entryPoint else {
      return []
    }
    if maximumLevel > 0 {
      for level in stride(from: maximumLevel, through: 1, by: -1) {
        current = greedyNearest(query, entry: current, level: level)
      }
    }
    return Array(
      searchLayer(
        query,
        entries: [current],
        level: 0,
        ef: max(limit, efSearch)
      ).prefix(limit)
    )
  }

  func exactSearch(_ query: [Float], limit: Int) -> [HNSWMatch] {
    Array(
      records.indices
      .map { HNSWMatch(index: $0, distance: cosineDistance(query, records[$0].embedding)) }
      .sorted { $0.distance < $1.distance }
      .prefix(limit)
    )
  }

  private func greedyNearest(_ query: [Float], entry: Int, level: Int) -> Int {
    var current = entry
    var currentDistance = cosineDistance(query, records[current].embedding)
    var changed = true
    while changed {
      changed = false
      for neighbor in levelNeighbors(current, level: level) {
        let distance = cosineDistance(query, records[neighbor].embedding)
        if distance < currentDistance {
          current = neighbor
          currentDistance = distance
          changed = true
        }
      }
    }
    return current
  }

  private func searchLayer(
    _ query: [Float],
    entries: [Int],
    level: Int,
    ef: Int
  ) -> [HNSWMatch] {
    var visited = Set(entries)
    var candidates = entries.map {
      HNSWMatch(index: $0, distance: cosineDistance(query, records[$0].embedding))
    }
    var best = candidates.sorted { $0.distance < $1.distance }
    while let candidate = candidates.min(by: { $0.distance < $1.distance }) {
      candidates.removeAll { $0.index == candidate.index }
      let worst = best.last?.distance ?? .greatestFiniteMagnitude
      if best.count >= ef && candidate.distance > worst {
        break
      }
      for neighbor in levelNeighbors(candidate.index, level: level)
      where visited.insert(neighbor).inserted {
        let match = HNSWMatch(
          index: neighbor,
          distance: cosineDistance(query, records[neighbor].embedding)
        )
        if best.count < ef || match.distance < (best.last?.distance ?? .greatestFiniteMagnitude) {
          candidates.append(match)
          best.append(match)
          best.sort { $0.distance < $1.distance }
          if best.count > ef {
            best.removeLast()
          }
        }
      }
    }
    return best
  }

  private func levelNeighbors(_ index: Int, level: Int) -> [Int] {
    guard neighbors.indices.contains(index),
          neighbors[index].indices.contains(level)
    else {
      return []
    }
    return neighbors[index][level]
  }

  private func nearest(_ query: [Float], indices: [Int], limit: Int) -> [Int] {
    indices
      .map { ($0, cosineDistance(query, records[$0].embedding)) }
      .sorted { $0.1 < $1.1 }
      .prefix(limit)
      .map(\.0)
  }

  private static func level(for id: String) -> Int {
    let prefix = UInt64(id.prefix(16), radix: 16) ?? 1
    return min(prefix.trailingZeroBitCount / 2, 12)
  }
}

private func cosineDistance(_ lhs: [Float], _ rhs: [Float]) -> Float {
  guard lhs.count == rhs.count, !lhs.isEmpty else {
    return 1
  }
  var dot: Float = 0
  vDSP_dotpr(lhs, 1, rhs, 1, &dot, vDSP_Length(lhs.count))
  return 1 - dot
}

private func normalize(_ values: inout [Float]) {
  var squared: Float = 0
  vDSP_svesq(values, 1, &squared, vDSP_Length(values.count))
  let norm = sqrt(max(squared, Float.leastNonzeroMagnitude))
  var divisor = norm
  vDSP_vsdiv(values, 1, &divisor, &values, 1, vDSP_Length(values.count))
}

private let SQLITE_TRANSIENT = unsafeBitCast(
  -1,
  to: sqlite3_destructor_type.self
)
