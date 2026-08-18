import Foundation

public struct MarkdownDraftSnapshot: Codable, Equatable, Sendable {
  public let text: String
  public let displayName: String
  public let sourcePath: String?
  public let updatedAt: Date

  public init(text: String, displayName: String, sourcePath: String?, updatedAt: Date = .now) {
    self.text = text
    self.displayName = displayName
    self.sourcePath = sourcePath
    self.updatedAt = updatedAt
  }
}

public actor DraftRepository {
  private let rootURL: URL
  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()

  public init(rootURL: URL) {
    self.rootURL = rootURL
    encoder.outputFormatting = [.sortedKeys]
    encoder.dateEncodingStrategy = .iso8601
    decoder.dateDecodingStrategy = .iso8601
  }

  public func load() throws -> MarkdownDraftSnapshot? {
    let url = rootURL.appending(path: "current-draft.json", directoryHint: .notDirectory)
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    return try decoder.decode(MarkdownDraftSnapshot.self, from: Data(contentsOf: url))
  }

  public func save(_ snapshot: MarkdownDraftSnapshot) throws {
    try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    let url = rootURL.appending(path: "current-draft.json", directoryHint: .notDirectory)
    try encoder.encode(snapshot).write(to: url, options: [.atomic, .completeFileProtection])
  }
}
