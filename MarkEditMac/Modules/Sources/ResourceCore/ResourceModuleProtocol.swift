//
//  ResourceModuleProtocol.swift
//
//  Created by ksamint on 8/1/26.
//

import CryptoKit
import Foundation

public struct ResourceModuleManifestV1: Codable, Equatable, Sendable {
  public static let supportedSchemaVersion = 1

  public let schemaVersion: Int
  public let id: String
  public let version: String
  public let displayName: String
  public let entrypoint: String
  public let files: [ResourceModuleFileV1]
  public let probes: [ResourceProbeRuleV1]
  public let signingKeyID: String
  public let signature: String

  public init(
    schemaVersion: Int = Self.supportedSchemaVersion,
    id: String,
    version: String,
    displayName: String,
    entrypoint: String,
    files: [ResourceModuleFileV1],
    probes: [ResourceProbeRuleV1],
    signingKeyID: String,
    signature: String
  ) {
    self.schemaVersion = schemaVersion
    self.id = id
    self.version = version
    self.displayName = displayName
    self.entrypoint = entrypoint
    self.files = files
    self.probes = probes
    self.signingKeyID = signingKeyID
    self.signature = signature
  }

  public var isSupported: Bool {
    schemaVersion == Self.supportedSchemaVersion
  }

  public func validate() throws {
    guard isSupported else {
      throw ResourceModuleError.unsupportedSchema(schemaVersion)
    }
    guard Self.isSafeIdentifier(id), !version.isEmpty, !displayName.isEmpty else {
      throw ResourceModuleError.invalidManifest
    }
    guard !files.isEmpty, files.count <= 10_000 else {
      throw ResourceModuleError.invalidManifest
    }
    guard files.contains(where: { $0.path == entrypoint }) else {
      throw ResourceModuleError.missingEntrypoint
    }

    var paths = Set<String>()
    var totalSize: UInt64 = 0
    for file in files {
      try file.validate()
      guard paths.insert(file.path).inserted else {
        throw ResourceModuleError.duplicatePath(file.path)
      }
      let (newTotal, overflow) = totalSize.addingReportingOverflow(file.size)
      guard !overflow, newTotal <= ResourceModuleLimits.maximumInstalledBytes else {
        throw ResourceModuleError.moduleTooLarge
      }
      totalSize = newTotal
    }
  }

  public func signingPayload() throws -> Data {
    let payload = UnsignedManifest(
      schemaVersion: schemaVersion,
      id: id,
      version: version,
      displayName: displayName,
      entrypoint: entrypoint,
      files: files,
      probes: probes,
      signingKeyID: signingKeyID
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return try encoder.encode(payload)
  }

  public func verifySignature(using trustStore: ResourceModuleTrustStore) throws {
    try validate()
    guard let publicKey = trustStore.publicKey(for: signingKeyID),
          let signatureData = Data(base64Encoded: signature),
          let signature = try? P256.Signing.ECDSASignature(derRepresentation: signatureData),
          publicKey.isValidSignature(signature, for: try signingPayload()) else {
      throw ResourceModuleError.invalidSignature
    }
  }
}

public struct ResourceModuleFileV1: Codable, Equatable, Sendable {
  public let path: String
  public let sha256: String
  public let size: UInt64
  public let mediaType: String

  public init(path: String, sha256: String, size: UInt64, mediaType: String) {
    self.path = path
    self.sha256 = sha256
    self.size = size
    self.mediaType = mediaType
  }

  public func validate() throws {
    guard ResourcePathPolicy.isSafeRelativePath(path),
          sha256.count == 64,
          sha256.allSatisfy(\.isHexDigit),
          size <= ResourceModuleLimits.maximumFileBytes,
          ResourceModuleLimits.allowedModuleExtensions.contains(
            URL(fileURLWithPath: path).pathExtension.lowercased()
          ) else {
      throw ResourceModuleError.invalidFile(path)
    }
  }
}

public struct ResourceProbeRuleV1: Codable, Equatable, Sendable {
  public let fileExtensions: [String]
  public let directoryMarkers: [String]
  public let mediaTypes: [String]
  public let priority: Int

  public init(
    fileExtensions: [String] = [],
    directoryMarkers: [String] = [],
    mediaTypes: [String] = [],
    priority: Int = 0
  ) {
    self.fileExtensions = fileExtensions
    self.directoryMarkers = directoryMarkers
    self.mediaTypes = mediaTypes
    self.priority = priority
  }
}

public struct ResourceModuleTrustStore: Sendable {
  private let keys: [String: P256.Signing.PublicKey]

  public init() {
    self.keys = [:]
  }

  public init(x963Keys: [String: Data]) throws {
    var decoded = [String: P256.Signing.PublicKey]()
    for (identifier, data) in x963Keys {
      decoded[identifier] = try P256.Signing.PublicKey(x963Representation: data)
    }
    self.keys = decoded
  }

  public func publicKey(for identifier: String) -> P256.Signing.PublicKey? {
    keys[identifier]
  }
}

public struct ResourceDescriptorV1: Codable, Equatable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case file
    case folder
    case archive
  }

  public let id: String
  public let displayName: String
  public let kind: Kind
  public let mediaType: String?
  public let byteCount: UInt64?
  public let modifiedAt: Date?
  public let readOnly: Bool

  public init(
    id: String,
    displayName: String,
    kind: Kind,
    mediaType: String?,
    byteCount: UInt64?,
    modifiedAt: Date?,
    readOnly: Bool = true
  ) {
    self.id = id
    self.displayName = displayName
    self.kind = kind
    self.mediaType = mediaType
    self.byteCount = byteCount
    self.modifiedAt = modifiedAt
    self.readOnly = readOnly
  }
}

public struct ResourceEntryV1: Codable, Equatable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case file
    case folder
    case symbolicLink
  }

  public let id: String
  public let parentID: String?
  public let name: String
  public let kind: Kind
  public let mediaType: String?
  public let byteCount: UInt64?
  public let modifiedAt: Date?
  public let isHidden: Bool

  public init(
    id: String,
    parentID: String?,
    name: String,
    kind: Kind,
    mediaType: String?,
    byteCount: UInt64?,
    modifiedAt: Date?,
    isHidden: Bool
  ) {
    self.id = id
    self.parentID = parentID
    self.name = name
    self.kind = kind
    self.mediaType = mediaType
    self.byteCount = byteCount
    self.modifiedAt = modifiedAt
    self.isHidden = isHidden
  }
}

public struct ResourcePageV1: Codable, Equatable, Sendable {
  public let entries: [ResourceEntryV1]
  public let nextCursor: String?

  public init(entries: [ResourceEntryV1], nextCursor: String?) {
    self.entries = entries
    self.nextCursor = nextCursor
  }
}

public struct ResourceRenderV1: Codable, Equatable, Sendable {
  public enum Kind: String, Codable, Sendable {
    case html
    case text
    case image
    case pdf
    case quickLook
    case metadata
  }

  public let kind: Kind
  public let title: String
  public let resourceURL: String?
  public let text: String?
  public let metadata: [String: String]

  public init(
    kind: Kind,
    title: String,
    resourceURL: String? = nil,
    text: String? = nil,
    metadata: [String: String] = [:]
  ) {
    self.kind = kind
    self.title = title
    self.resourceURL = resourceURL
    self.text = text
    self.metadata = metadata
  }
}

public struct ResourceModuleRequestV1: Codable, Equatable, Sendable {
  public enum Method: String, Codable, Sendable {
    case probe
    case open
    case listChildren
    case readRange
    case search
    case render
    case cancel
  }

  public let operationID: String
  public let method: Method
  public let entryID: String?
  public let parentID: String?
  public let cursor: String?
  public let offset: UInt64?
  public let length: Int?
  public let query: String?
  public let limit: Int?
  public let mode: String?

  public init(
    operationID: String,
    method: Method,
    entryID: String? = nil,
    parentID: String? = nil,
    cursor: String? = nil,
    offset: UInt64? = nil,
    length: Int? = nil,
    query: String? = nil,
    limit: Int? = nil,
    mode: String? = nil
  ) {
    self.operationID = operationID
    self.method = method
    self.entryID = entryID
    self.parentID = parentID
    self.cursor = cursor
    self.offset = offset
    self.length = length
    self.query = query
    self.limit = limit
    self.mode = mode
  }
}

public enum ResourceModuleError: Error, Equatable, Sendable {
  case unsupportedSchema(Int)
  case invalidManifest
  case invalidSignature
  case invalidFile(String)
  case duplicatePath(String)
  case missingEntrypoint
  case moduleTooLarge
  case invalidURL
  case integrityMismatch(String)
  case unsafePath(String)
  case outsideRoot(String)
  case unsupportedFileType(String)
  case entryLimitExceeded
  case rangeTooLarge
  case invalidCursor
  case notFound(String)
}

public enum ResourceModuleLimits {
  public static let maximumInstalledBytes: UInt64 = 128 * 1024 * 1024
  public static let maximumFileBytes: UInt64 = 64 * 1024 * 1024
  public static let maximumEntries = 200_000
  public static let pageSize = 500
  public static let maximumReadBytes = 10 * 1024 * 1024
  public static let maximumPreviewBytes: UInt64 = 100 * 1024 * 1024
  public static let maximumArchiveRatio: Double = 1_000
  public static let maximumArchiveDepth = 2
  public static let allowedModuleExtensions: Set<String> = [
    "avif", "css", "gif", "html", "jpeg", "jpg", "js", "json", "mjs",
    "png", "svg", "txt", "wasm", "webp", "woff", "woff2",
  ]
}

public enum ResourcePathPolicy {
  public static func isSafeRelativePath(_ path: String) -> Bool {
    guard !path.isEmpty,
          !path.hasPrefix("/"),
          !path.hasPrefix("\\"),
          !path.contains("\0"),
          !path.contains("://") else {
      return false
    }
    if path.count >= 2 {
      let prefix = path.prefix(2)
      if prefix.first?.isLetter == true, prefix.last == ":" {
        return false
      }
    }
    let components = path.replacingOccurrences(of: "\\", with: "/").split(separator: "/")
    return !components.isEmpty && components.allSatisfy { component in
      component != "." && component != ".." && !component.isEmpty
    }
  }

  public static func isDescendant(_ candidate: URL, of root: URL) -> Bool {
    let rootComponents = root.standardizedFileURL.pathComponents
    let candidateComponents = candidate.standardizedFileURL.pathComponents
    return candidateComponents.count >= rootComponents.count
      && Array(candidateComponents.prefix(rootComponents.count)) == rootComponents
  }
}

private extension ResourceModuleManifestV1 {
  struct UnsignedManifest: Codable {
    let schemaVersion: Int
    let id: String
    let version: String
    let displayName: String
    let entrypoint: String
    let files: [ResourceModuleFileV1]
    let probes: [ResourceProbeRuleV1]
    let signingKeyID: String
  }

  static func isSafeIdentifier(_ identifier: String) -> Bool {
    !identifier.isEmpty
      && !identifier.hasPrefix(".")
      && !identifier.contains("..")
      && identifier.allSatisfy {
        $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_")
      }
  }
}
