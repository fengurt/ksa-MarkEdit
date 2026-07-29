//
//  VaultSyncQueue.swift
//
//  Persistent, bounded background work queue for encrypted sync and backups.
//

import Foundation
import SQLite3

public enum VaultSyncJobKind: String, Codable, Sendable {
  case cosObject
  case cosMultipartPart
  case manifest
  case githubBackup
}

public struct VaultSyncJob: Codable, Sendable, Equatable, Identifiable {
  public let id: UUID
  public let vaultID: UUID
  public let kind: VaultSyncJobKind
  public let objectID: UUID?
  public let localCiphertextURL: URL?
  public let objectKey: String?
  public let sha256: String?
  public let byteOffset: Int64?
  public let byteLength: Int64?
  public let multipartUploadID: String?
  public let partNumber: Int?
  public var attempt: Int
  public var earliestStart: Date

  public init(
    id: UUID = UUID(),
    vaultID: UUID,
    kind: VaultSyncJobKind,
    objectID: UUID? = nil,
    localCiphertextURL: URL? = nil,
    objectKey: String? = nil,
    sha256: String? = nil,
    byteOffset: Int64? = nil,
    byteLength: Int64? = nil,
    multipartUploadID: String? = nil,
    partNumber: Int? = nil,
    attempt: Int = 0,
    earliestStart: Date = .now
  ) {
    self.id = id
    self.vaultID = vaultID
    self.kind = kind
    self.objectID = objectID
    self.localCiphertextURL = localCiphertextURL
    self.objectKey = objectKey
    self.sha256 = sha256
    self.byteOffset = byteOffset
    self.byteLength = byteLength
    self.multipartUploadID = multipartUploadID
    self.partNumber = partNumber
    self.attempt = attempt
    self.earliestStart = earliestStart
  }
}

public protocol VaultSyncTransport: Sendable {
  func execute(_ job: VaultSyncJob) async throws
}

public struct VaultAttachmentUpload: Sendable, Equatable {
  public let vaultID: UUID
  public let objectID: UUID
  public let ciphertextURL: URL
  public let objectKey: String
  public let byteSize: Int64
  public let sha256: String
  public let multipartUploadID: String

  public init(
    vaultID: UUID,
    objectID: UUID,
    ciphertextURL: URL,
    objectKey: String,
    byteSize: Int64,
    sha256: String,
    multipartUploadID: String
  ) {
    self.vaultID = vaultID
    self.objectID = objectID
    self.ciphertextURL = ciphertextURL
    self.objectKey = objectKey
    self.byteSize = byteSize
    self.sha256 = sha256
    self.multipartUploadID = multipartUploadID
  }
}

public actor VaultSyncQueue {
  public static let maximumConcurrency = 4
  public static let attachmentPartSize: Int64 = 8 * 1024 * 1024

  public private(set) var isRunning = false
  public var onPendingCountChange: (@Sendable (Int) -> Void)?

  private let databaseURL: URL
  private let transport: any VaultSyncTransport
  private var worker: Task<Void, Never>?

  public init(databaseURL: URL, transport: any VaultSyncTransport) {
    self.databaseURL = databaseURL
    self.transport = transport
  }

  deinit {
    worker?.cancel()
  }

  public func enqueue(_ job: VaultSyncJob) throws {
    try withDatabase { database in
      try configure(database)
      let payload = try JSONEncoder().encode(job)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        """
        INSERT INTO sync_jobs(id, vault_id, kind, payload, attempt, earliest_start, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          attempt = excluded.attempt,
          earliest_start = excluded.earliest_start
        """,
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw VaultSyncQueueError.database
      }
      defer {
        sqlite3_finalize(statement)
      }
      Self.bind(job.id.uuidString, index: 1, statement: statement)
      Self.bind(job.vaultID.uuidString, index: 2, statement: statement)
      Self.bind(job.kind.rawValue, index: 3, statement: statement)
      _ = payload.withUnsafeBytes {
        sqlite3_bind_blob(statement, 4, $0.baseAddress, Int32($0.count), SQLITE_TRANSIENT)
      }
      sqlite3_bind_int64(statement, 5, Int64(job.attempt))
      sqlite3_bind_double(statement, 6, job.earliestStart.timeIntervalSince1970)
      sqlite3_bind_double(statement, 7, Date.now.timeIntervalSince1970)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw VaultSyncQueueError.database
      }
    }
    notifyPendingCount()
  }

  public func enqueueAttachment(_ upload: VaultAttachmentUpload) throws {
    guard upload.byteSize > 0 else {
      return
    }
    var offset: Int64 = 0
    var partNumber = 1
    while offset < upload.byteSize {
      let length = min(Self.attachmentPartSize, upload.byteSize - offset)
      try enqueue(
        VaultSyncJob(
          vaultID: upload.vaultID,
          kind: .cosMultipartPart,
          objectID: upload.objectID,
          localCiphertextURL: upload.ciphertextURL,
          objectKey: upload.objectKey,
          sha256: upload.sha256,
          byteOffset: offset,
          byteLength: length,
          multipartUploadID: upload.multipartUploadID,
          partNumber: partNumber
        )
      )
      offset += length
      partNumber += 1
    }
  }

  public func start() {
    guard worker == nil else {
      return
    }
    isRunning = true
    worker = Task { [weak self] in
      await self?.run()
    }
  }

  public func stop() {
    worker?.cancel()
    worker = nil
    isRunning = false
  }

  public func runOneBatch() async {
    let jobs = (try? dueJobs(limit: Self.maximumConcurrency)) ?? []
    guard !jobs.isEmpty else {
      return
    }
    await withTaskGroup(of: (VaultSyncJob, Result<Void, Error>).self) { group in
      for job in jobs {
        group.addTask { [transport] in
          do {
            try await transport.execute(job)
            return (job, .success(()))
          } catch {
            return (job, .failure(error))
          }
        }
      }
      for await (job, result) in group {
        switch result {
        case .success:
          try? remove(job.id)
        case .failure:
          try? reschedule(job)
        }
      }
    }
    notifyPendingCount()
  }

  public func pendingCount() throws -> Int {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        "SELECT COUNT(*) FROM sync_jobs",
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw VaultSyncQueueError.database
      }
      defer {
        sqlite3_finalize(statement)
      }
      return sqlite3_step(statement) == SQLITE_ROW
        ? Int(sqlite3_column_int64(statement, 0))
        : 0
    }
  }
}

private extension VaultSyncQueue {
  func run() async {
    while !Task.isCancelled {
      await runOneBatch()
      do {
        try await Task.sleep(for: .seconds(2))
      } catch {
        break
      }
    }
    isRunning = false
    worker = nil
  }

  func dueJobs(limit: Int) throws -> [VaultSyncJob] {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        """
        SELECT payload FROM sync_jobs
        WHERE earliest_start <= ?
        ORDER BY earliest_start, created_at
        LIMIT ?
        """,
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw VaultSyncQueueError.database
      }
      defer {
        sqlite3_finalize(statement)
      }
      sqlite3_bind_double(statement, 1, Date.now.timeIntervalSince1970)
      sqlite3_bind_int64(statement, 2, Int64(limit))
      var jobs = [VaultSyncJob]()
      while sqlite3_step(statement) == SQLITE_ROW {
        guard let pointer = sqlite3_column_blob(statement, 0) else {
          continue
        }
        let data = Data(
          bytes: pointer,
          count: Int(sqlite3_column_bytes(statement, 0))
        )
        if let job = try? JSONDecoder().decode(VaultSyncJob.self, from: data) {
          jobs.append(job)
        }
      }
      return jobs
    }
  }

  func remove(_ id: UUID) throws {
    try withDatabase { database in
      try configure(database)
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(
        database,
        "DELETE FROM sync_jobs WHERE id = ?",
        -1,
        &statement,
        nil
      ) == SQLITE_OK, let statement else {
        throw VaultSyncQueueError.database
      }
      defer {
        sqlite3_finalize(statement)
      }
      Self.bind(id.uuidString, index: 1, statement: statement)
      guard sqlite3_step(statement) == SQLITE_DONE else {
        throw VaultSyncQueueError.database
      }
    }
  }

  func reschedule(_ original: VaultSyncJob) throws {
    var job = original
    job.attempt += 1
    let exponent = min(job.attempt, 10)
    let base = min(pow(2, Double(exponent)), 3_600)
    let deterministicJitter = Double(job.id.uuid.0 % 41) / 100 + 0.8
    job.earliestStart = Date(timeIntervalSinceNow: base * deterministicJitter)
    try enqueue(job)
  }

  func notifyPendingCount() {
    if let count = try? pendingCount() {
      onPendingCountChange?(count)
    }
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
      throw VaultSyncQueueError.database
    }
    defer {
      sqlite3_close(database)
    }
    sqlite3_busy_timeout(database, 2_000)
    return try operation(database)
  }

  func configure(_ database: OpaquePointer) throws {
    guard sqlite3_exec(database, "PRAGMA journal_mode=WAL", nil, nil, nil) == SQLITE_OK,
          sqlite3_exec(database, "PRAGMA synchronous=NORMAL", nil, nil, nil) == SQLITE_OK,
          sqlite3_exec(
            database,
            """
            CREATE TABLE IF NOT EXISTS sync_jobs (
              id TEXT PRIMARY KEY,
              vault_id TEXT NOT NULL,
              kind TEXT NOT NULL,
              payload BLOB NOT NULL,
              attempt INTEGER NOT NULL,
              earliest_start REAL NOT NULL,
              created_at REAL NOT NULL
            )
            """,
            nil,
            nil,
            nil
          ) == SQLITE_OK
    else {
      throw VaultSyncQueueError.database
    }
  }

  static func bind(
    _ value: String,
    index: Int32,
    statement: OpaquePointer
  ) {
    _ = value.withCString {
      sqlite3_bind_text(statement, index, $0, -1, SQLITE_TRANSIENT)
    }
  }
}

public enum VaultSyncQueueError: Error {
  case database
}

public enum MarkdownThreeWayMergeResult: Sendable, Equatable {
  case merged(String)
  case conflict(local: String, remote: String)
}

public enum MarkdownThreeWayMerge {
  public static func merge(
    base: String,
    local: String,
    remote: String
  ) -> MarkdownThreeWayMergeResult {
    if local == remote {
      return .merged(local)
    }
    if local == base {
      return .merged(remote)
    }
    if remote == base {
      return .merged(local)
    }
    let baseLines = base.components(separatedBy: "\n")
    let localChange = contiguousChange(from: baseLines, to: local.components(separatedBy: "\n"))
    let remoteChange = contiguousChange(from: baseLines, to: remote.components(separatedBy: "\n"))
    let sameInsertionPoint = localChange.baseRange.isEmpty
      && remoteChange.baseRange.isEmpty
      && localChange.baseRange.lowerBound == remoteChange.baseRange.lowerBound
    guard !sameInsertionPoint,
          !localChange.baseRange.overlaps(remoteChange.baseRange)
    else {
      return .conflict(local: local, remote: remote)
    }
    let first = localChange.baseRange.lowerBound < remoteChange.baseRange.lowerBound
      ? localChange
      : remoteChange
    let second = localChange.baseRange.lowerBound < remoteChange.baseRange.lowerBound
      ? remoteChange
      : localChange
    var merged = baseLines
    merged.replaceSubrange(second.baseRange, with: second.replacement)
    merged.replaceSubrange(first.baseRange, with: first.replacement)
    return .merged(merged.joined(separator: "\n"))
  }

  private struct Change {
    let baseRange: Range<Int>
    let replacement: [String]
  }

  private static func contiguousChange(from base: [String], to value: [String]) -> Change {
    var prefix = 0
    while prefix < min(base.count, value.count), base[prefix] == value[prefix] {
      prefix += 1
    }
    var suffix = 0
    while suffix < min(base.count - prefix, value.count - prefix),
          base[base.count - suffix - 1] == value[value.count - suffix - 1] {
      suffix += 1
    }
    return Change(
      baseRange: prefix..<(base.count - suffix),
      replacement: Array(value[prefix..<(value.count - suffix)])
    )
  }
}

private let SQLITE_TRANSIENT = unsafeBitCast(
  -1,
  to: sqlite3_destructor_type.self
)
