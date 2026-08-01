//
//  ResourceAccessBroker.swift
//
//  Created by ksamint on 8/1/26.
//

import Foundation
import UniformTypeIdentifiers

public actor ResourceAccessBroker {
  private let rootURL: URL
  private let resolvedRootURL: URL
  private let pageSize: Int
  private let maximumEntries: Int
  private let maximumReadBytes: Int
  private let isDirectory: Bool
  private let securityScopeStarted: Bool
  private var observedEntries = Set<String>()

  public init(
    rootURL: URL,
    pageSize: Int = ResourceModuleLimits.pageSize,
    maximumEntries: Int = ResourceModuleLimits.maximumEntries,
    maximumReadBytes: Int = ResourceModuleLimits.maximumReadBytes
  ) throws {
    let standardized = rootURL.standardizedFileURL
    var directoryFlag = ObjCBool(false)
    guard FileManager.default.fileExists(atPath: standardized.path, isDirectory: &directoryFlag) else {
      throw ResourceModuleError.notFound(standardized.lastPathComponent)
    }
    guard pageSize > 0, pageSize <= ResourceModuleLimits.pageSize,
          maximumEntries > 0, maximumReadBytes > 0 else {
      throw ResourceModuleError.invalidManifest
    }

    self.rootURL = standardized
    self.resolvedRootURL = standardized.resolvingSymlinksInPath()
    self.pageSize = pageSize
    self.maximumEntries = maximumEntries
    self.maximumReadBytes = maximumReadBytes
    self.isDirectory = directoryFlag.boolValue
    self.securityScopeStarted = standardized.startAccessingSecurityScopedResource()
  }

  deinit {
    if securityScopeStarted {
      rootURL.stopAccessingSecurityScopedResource()
    }
  }

  public func descriptor() throws -> ResourceDescriptorV1 {
    let values = try rootURL.resourceValues(forKeys: [
      .contentModificationDateKey,
      .contentTypeKey,
      .fileSizeKey,
      .isDirectoryKey,
    ])
    return ResourceDescriptorV1(
      id: "root",
      displayName: rootURL.lastPathComponent,
      kind: values.isDirectory == true ? .folder : .file,
      mediaType: values.contentType?.identifier,
      byteCount: values.fileSize.map(UInt64.init),
      modifiedAt: values.contentModificationDate
    )
  }

  public func listChildren(parentID: String? = nil, cursor: String? = nil) throws -> ResourcePageV1 {
    let offset = try Self.decodeCursor(cursor)
    let parentPath = parentID ?? ""
    let parentURL = try resolve(relativePath: parentPath, expectsDirectory: true)
    let urls = try FileManager.default.contentsOfDirectory(
      at: parentURL,
      includingPropertiesForKeys: Self.resourceKeys,
      options: []
    ).sorted(by: Self.resourceOrder)

    guard offset <= urls.count else {
      throw ResourceModuleError.invalidCursor
    }

    let upperBound = min(offset + pageSize, urls.count)
    var entries = [ResourceEntryV1]()
    entries.reserveCapacity(upperBound - offset)
    for url in urls[offset..<upperBound] {
      try Task.checkCancellation()
      let relativePath = try relativePath(for: url)
      if observedEntries.insert(relativePath).inserted,
         observedEntries.count > maximumEntries {
        throw ResourceModuleError.entryLimitExceeded
      }
      entries.append(try entry(for: url, relativePath: relativePath, parentID: parentID))
    }

    return ResourcePageV1(
      entries: entries,
      nextCursor: upperBound < urls.count ? Self.encodeCursor(upperBound) : nil
    )
  }

  public func entry(id: String) throws -> ResourceEntryV1 {
    let url = try resolve(relativePath: id)
    let parentID = id.split(separator: "/").dropLast().joined(separator: "/")
    return try entry(
      for: url,
      relativePath: id,
      parentID: parentID.isEmpty ? nil : parentID
    )
  }

  public func readRange(entryID: String, offset: UInt64, length: Int) throws -> Data {
    guard length >= 0, length <= maximumReadBytes else {
      throw ResourceModuleError.rangeTooLarge
    }
    let url = try resolve(relativePath: entryID, expectsDirectory: false)
    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    guard values.isRegularFile == true else {
      throw ResourceModuleError.unsupportedFileType(entryID)
    }
    let fileSize = UInt64(values.fileSize ?? 0)
    guard offset <= fileSize else {
      return Data()
    }

    let handle = try FileHandle(forReadingFrom: url)
    defer {
      try? handle.close()
    }
    try handle.seek(toOffset: offset)
    let available = min(UInt64(length), fileSize - offset)
    return try handle.read(upToCount: Int(available)) ?? Data()
  }

  public func searchFileNames(query: String, limit: Int = 500) throws -> [ResourceEntryV1] {
    let foldedQuery = Self.fold(query)
    guard !foldedQuery.isEmpty else {
      return []
    }
    let resultLimit = min(max(limit, 1), 500)
    let baseURL = isDirectory ? rootURL : rootURL.deletingLastPathComponent()
    guard let enumerator = FileManager.default.enumerator(
      at: baseURL,
      includingPropertiesForKeys: Self.resourceKeys,
      options: [],
      errorHandler: { _, _ in true }
    ) else {
      return []
    }

    var results = [ResourceEntryV1]()
    var scanned = 0
    for case let url as URL in enumerator {
      try Task.checkCancellation()
      scanned += 1
      guard scanned <= maximumEntries else {
        throw ResourceModuleError.entryLimitExceeded
      }
      guard Self.fold(url.lastPathComponent).contains(foldedQuery) else {
        continue
      }
      do {
        let path = try relativePath(for: url)
        let parent = path.split(separator: "/").dropLast().joined(separator: "/")
        results.append(try entry(
          for: url,
          relativePath: path,
          parentID: parent.isEmpty ? nil : parent
        ))
        if results.count == resultLimit {
          break
        }
      } catch ResourceModuleError.outsideRoot {
        enumerator.skipDescendants()
      }
    }
    return results
  }
}

private extension ResourceAccessBroker {
  static let resourceKeys: [URLResourceKey] = [
    .contentModificationDateKey,
    .contentTypeKey,
    .fileSizeKey,
    .isDirectoryKey,
    .isHiddenKey,
    .isRegularFileKey,
    .isSymbolicLinkKey,
  ]

  func resolve(relativePath: String, expectsDirectory: Bool? = nil) throws -> URL {
    if relativePath.isEmpty {
      guard isDirectory || expectsDirectory != true else {
        throw ResourceModuleError.unsupportedFileType(relativePath)
      }
      return rootURL
    }
    guard ResourcePathPolicy.isSafeRelativePath(relativePath) else {
      throw ResourceModuleError.unsafePath(relativePath)
    }

    let unresolved: URL = if isDirectory {
      rootURL.appending(path: relativePath)
    } else if relativePath == rootURL.lastPathComponent {
      rootURL
    } else {
      throw ResourceModuleError.outsideRoot(relativePath)
    }
    let resolved = unresolved.resolvingSymlinksInPath()
    guard ResourcePathPolicy.isDescendant(resolved, of: resolvedRootURL) else {
      throw ResourceModuleError.outsideRoot(relativePath)
    }

    let values = try resolved.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey])
    if expectsDirectory == true, values.isDirectory != true {
      throw ResourceModuleError.unsupportedFileType(relativePath)
    }
    if expectsDirectory == false, values.isRegularFile != true {
      throw ResourceModuleError.unsupportedFileType(relativePath)
    }
    return resolved
  }

  func relativePath(for url: URL) throws -> String {
    let resolved = url.resolvingSymlinksInPath()
    guard ResourcePathPolicy.isDescendant(resolved, of: resolvedRootURL) else {
      throw ResourceModuleError.outsideRoot(url.lastPathComponent)
    }
    let standardized = url.standardizedFileURL
    guard ResourcePathPolicy.isDescendant(standardized, of: rootURL) else {
      throw ResourceModuleError.outsideRoot(url.lastPathComponent)
    }
    let rootComponents = rootURL.pathComponents
    let components = standardized.pathComponents.dropFirst(rootComponents.count)
    let path = components.joined(separator: "/")
    guard ResourcePathPolicy.isSafeRelativePath(path) else {
      throw ResourceModuleError.unsafePath(path)
    }
    return path
  }

  func entry(for url: URL, relativePath: String, parentID: String?) throws -> ResourceEntryV1 {
    let resolved = try resolve(relativePath: relativePath)
    let values = try resolved.resourceValues(forKeys: Set(Self.resourceKeys))
    let isSymbolicLink = try url.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == true
    let kind: ResourceEntryV1.Kind
    if values.isDirectory == true {
      kind = isSymbolicLink ? .symbolicLink : .folder
    } else if values.isRegularFile == true {
      kind = isSymbolicLink ? .symbolicLink : .file
    } else {
      throw ResourceModuleError.unsupportedFileType(relativePath)
    }
    return ResourceEntryV1(
      id: relativePath,
      parentID: parentID,
      name: url.lastPathComponent,
      kind: kind,
      mediaType: values.contentType?.identifier,
      byteCount: values.fileSize.map(UInt64.init),
      modifiedAt: values.contentModificationDate,
      isHidden: values.isHidden ?? url.lastPathComponent.hasPrefix(".")
    )
  }

  static func resourceOrder(_ lhs: URL, _ rhs: URL) -> Bool {
    let lhsDirectory = (try? lhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    let rhsDirectory = (try? rhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
    if lhsDirectory != rhsDirectory {
      return lhsDirectory
    }
    return lhs.lastPathComponent.localizedStandardCompare(rhs.lastPathComponent) == .orderedAscending
  }

  static func encodeCursor(_ offset: Int) -> String {
    Data(String(offset).utf8).base64EncodedString()
  }

  static func decodeCursor(_ cursor: String?) throws -> Int {
    guard let cursor else {
      return 0
    }
    guard let data = Data(base64Encoded: cursor),
          let value = String(data: data, encoding: .utf8),
          let offset = Int(value), offset >= 0 else {
      throw ResourceModuleError.invalidCursor
    }
    return offset
  }

  static func fold(_ value: String) -> String {
    value.precomposedStringWithCompatibilityMapping.folding(
      options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive],
      locale: Locale(identifier: "en_US_POSIX")
    )
  }
}
