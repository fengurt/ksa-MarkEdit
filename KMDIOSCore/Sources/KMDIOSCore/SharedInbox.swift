import Foundation

public struct SharedInboxEnvelope: Codable, Equatable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case text
    case markdown
    case html
    case url
    case file
  }

  public let id: UUID
  public let kind: Kind
  public let text: String
  public let sourceURL: String?
  public let createdAt: Date

  public init(
    id: UUID = UUID(),
    kind: Kind,
    text: String,
    sourceURL: String? = nil,
    createdAt: Date = .now
  ) {
    self.id = id
    self.kind = kind
    self.text = text
    self.sourceURL = sourceURL
    self.createdAt = createdAt
  }
}

public actor SharedInboxRepository {
  private let rootURL: URL
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  public init(rootURL: URL) {
    self.rootURL = rootURL
    encoder.outputFormatting = [.sortedKeys]
    encoder.dateEncodingStrategy = .iso8601
    decoder.dateDecodingStrategy = .iso8601
  }

  public func append(_ envelope: SharedInboxEnvelope) throws {
    try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    let url = rootURL.appending(path: "\(envelope.id.uuidString).json", directoryHint: .notDirectory)
    try encoder.encode(envelope).write(to: url, options: [.atomic, .completeFileProtection])
  }

  public func pending() throws -> [SharedInboxEnvelope] {
    guard FileManager.default.fileExists(atPath: rootURL.path) else { return [] }
    return try FileManager.default.contentsOfDirectory(
      at: rootURL,
      includingPropertiesForKeys: nil,
      options: [.skipsHiddenFiles]
    )
    .filter { $0.pathExtension == "json" }
    .compactMap { try? decoder.decode(SharedInboxEnvelope.self, from: Data(contentsOf: $0)) }
    .sorted { $0.createdAt < $1.createdAt }
  }

  public func archive(id: UUID) throws {
    let source = rootURL.appending(path: "\(id.uuidString).json", directoryHint: .notDirectory)
    guard FileManager.default.fileExists(atPath: source.path) else { return }
    let archive = rootURL.appending(path: "Archive", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: archive, withIntermediateDirectories: true)
    let destination = archive.appending(path: source.lastPathComponent, directoryHint: .notDirectory)
    if FileManager.default.fileExists(atPath: destination.path) {
      try FileManager.default.removeItem(at: destination)
    }
    try FileManager.default.moveItem(at: source, to: destination)
  }
}
