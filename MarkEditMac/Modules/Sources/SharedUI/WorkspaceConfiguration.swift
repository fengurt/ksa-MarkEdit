//
//  WorkspaceConfiguration.swift
//
//  Non-content workspace metadata. Markdown remains the sole content source.
//

import Foundation

public struct WorkspaceConfiguration: Codable, Sendable, Equatable {
  public var version = 1
  public var tags = [String: TagDefinition]()
  public var categories = [String: CategoryDefinition]()
  public var sortOrder = [String]()
  public var graph = GraphConfiguration()
  public var sync = SyncConfiguration()

  public init() {}

  public struct TagDefinition: Codable, Sendable, Equatable {
    public var displayName: String
    public var color: String?
    public var description: String?
    public var aliases: [String]

    public init(
      displayName: String,
      color: String? = nil,
      description: String? = nil,
      aliases: [String] = []
    ) {
      self.displayName = displayName
      self.color = color
      self.description = description
      self.aliases = aliases
    }
  }

  public struct CategoryDefinition: Codable, Sendable, Equatable {
    public var color: String?
    public var description: String?
    public var aliases: [String]

    public init(
      color: String? = nil,
      description: String? = nil,
      aliases: [String] = []
    ) {
      self.color = color
      self.description = description
      self.aliases = aliases
    }
  }

  public struct GraphConfiguration: Codable, Sendable, Equatable {
    public var positions = [String: Point]()
    public var collapsedNodeIDs = [String]()

    public init() {}
  }

  public struct Point: Codable, Sendable, Equatable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
      self.x = x
      self.y = y
    }
  }

  public struct SyncConfiguration: Codable, Sendable, Equatable {
    public var excludedPaths = [
      ".git/**",
      ".build/**",
      "build/**",
      "DerivedData/**",
      "node_modules/**",
    ]

    public init() {}
  }
}

public actor WorkspaceConfigurationStore {
  public let rootURL: URL

  public init(rootURL: URL) {
    self.rootURL = rootURL.standardizedFileURL
  }

  public func load() throws -> WorkspaceConfiguration {
    guard FileManager.default.fileExists(atPath: fileURL.path) else {
      return WorkspaceConfiguration()
    }
    let data = try Data(contentsOf: fileURL)
    let value = try JSONDecoder().decode(WorkspaceConfiguration.self, from: data)
    guard value.version == 1 else {
      throw WorkspaceConfigurationError.unsupportedVersion
    }
    return value
  }

  public func update(
    _ operation: (inout WorkspaceConfiguration) throws -> Void
  ) throws {
    var value = try load()
    try operation(&value)
    try write(value)
  }

  public func write(_ value: WorkspaceConfiguration) throws {
    guard value.version == 1 else {
      throw WorkspaceConfigurationError.unsupportedVersion
    }
    let directoryURL = fileURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(
      at: directoryURL,
      withIntermediateDirectories: true
    )
    let data = try Self.encoder.encode(value)
    let temporaryURL = directoryURL.appending(
      path: "workspace-\(UUID().uuidString).tmp"
    )
    do {
      try data.write(to: temporaryURL, options: [.atomic, .completeFileProtection])
      if FileManager.default.fileExists(atPath: fileURL.path) {
        _ = try FileManager.default.replaceItemAt(
          fileURL,
          withItemAt: temporaryURL,
          backupItemName: nil,
          options: .usingNewMetadataOnly
        )
      } else {
        try FileManager.default.moveItem(at: temporaryURL, to: fileURL)
      }
    } catch {
      try? FileManager.default.removeItem(at: temporaryURL)
      throw error
    }
  }

  private var fileURL: URL {
    rootURL.appending(path: ".ksamint/workspace.yml")
  }

  private static let encoder: JSONEncoder = {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    return encoder
  }()
}

public enum WorkspaceConfigurationError: LocalizedError {
  case unsupportedVersion

  public var errorDescription: String? {
    switch self {
    case .unsupportedVersion:
      "This workspace configuration was created by a newer version of MarkEdit."
    }
  }
}
