//
//  ResourceModuleInstaller.swift
//
//  Created by ksamint on 8/1/26.
//

import CryptoKit
import Foundation

public actor ResourceModuleInstaller {
  public typealias Download = @Sendable (URL) async throws -> Data

  private let installationRoot: URL
  private let trustStore: ResourceModuleTrustStore
  private let download: Download

  public init(
    installationRoot: URL,
    trustStore: ResourceModuleTrustStore,
    download: @escaping Download = ResourceModuleInstaller.httpsDownload
  ) {
    self.installationRoot = installationRoot.standardizedFileURL
    self.trustStore = trustStore
    self.download = download
  }

  public func install(from manifestURL: URL, expectedSHA256: String) async throws -> URL {
    guard manifestURL.scheme?.lowercased() == "https" else {
      throw ResourceModuleError.invalidURL
    }
    let manifestData = try await download(manifestURL)
    guard manifestData.sha256 == expectedSHA256.lowercased() else {
      throw ResourceModuleError.integrityMismatch("manifest.json")
    }
    let manifest = try JSONDecoder().decode(ResourceModuleManifestV1.self, from: manifestData)
    try manifest.verifySignature(using: trustStore)

    let fileManager = FileManager.default
    try fileManager.createDirectory(at: installationRoot, withIntermediateDirectories: true)
    let stagingRoot = installationRoot.appending(
      path: ".staging-\(manifest.id)-\(UUID().uuidString)",
      directoryHint: .isDirectory
    )
    let targetRoot = installationRoot.appending(path: manifest.id, directoryHint: .isDirectory)
    try fileManager.createDirectory(at: stagingRoot, withIntermediateDirectories: true)

    do {
      for file in manifest.files {
        try Task.checkCancellation()
        let fileURL = try Self.remoteURL(for: file.path, relativeTo: manifestURL)
        let data = try await download(fileURL)
        guard UInt64(data.count) == file.size, data.sha256 == file.sha256.lowercased() else {
          throw ResourceModuleError.integrityMismatch(file.path)
        }

        let destination = stagingRoot.appending(path: file.path, directoryHint: .notDirectory)
        guard ResourcePathPolicy.isDescendant(destination, of: stagingRoot) else {
          throw ResourceModuleError.unsafePath(file.path)
        }
        try fileManager.createDirectory(
          at: destination.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        try data.write(to: destination, options: [.atomic, .completeFileProtection])
      }

      let encodedManifest = try JSONEncoder.resourceManifestEncoder.encode(manifest)
      try encodedManifest.write(
        to: stagingRoot.appending(path: "manifest.json", directoryHint: .notDirectory),
        options: [.atomic, .completeFileProtection]
      )
      try Self.activate(stagingRoot: stagingRoot, targetRoot: targetRoot, fileManager: fileManager)
      return targetRoot
    } catch {
      try? fileManager.removeItem(at: stagingRoot)
      throw error
    }
  }

  public func installedModules() -> [URL] {
    let urls = (try? FileManager.default.contentsOfDirectory(
      at: installationRoot,
      includingPropertiesForKeys: [.isDirectoryKey],
      options: [.skipsHiddenFiles]
    )) ?? []
    return urls.filter {
      (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        && FileManager.default.fileExists(atPath: $0.appending(path: "manifest.json").path)
    }.sorted {
      $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending
    }
  }

  public func validateInstalledModule(at moduleURL: URL) throws -> ResourceModuleManifestV1 {
    let standardized = moduleURL.standardizedFileURL
    guard ResourcePathPolicy.isDescendant(standardized, of: installationRoot) else {
      throw ResourceModuleError.outsideRoot(moduleURL.lastPathComponent)
    }
    let data = try Data(contentsOf: standardized.appending(path: "manifest.json"))
    let manifest = try JSONDecoder().decode(ResourceModuleManifestV1.self, from: data)
    try manifest.verifySignature(using: trustStore)
    for file in manifest.files {
      let url = standardized.appending(path: file.path)
      guard ResourcePathPolicy.isDescendant(url, of: standardized),
            let data = try? Data(contentsOf: url, options: [.mappedIfSafe]),
            UInt64(data.count) == file.size,
            data.sha256 == file.sha256.lowercased() else {
        throw ResourceModuleError.integrityMismatch(file.path)
      }
    }
    return manifest
  }

  public static func httpsDownload(_ url: URL) async throws -> Data {
    guard url.scheme?.lowercased() == "https" else {
      throw ResourceModuleError.invalidURL
    }
    let (data, response) = try await URLSession.shared.data(from: url)
    guard let response = response as? HTTPURLResponse,
          response.statusCode == 200,
          data.count <= Int(ResourceModuleLimits.maximumFileBytes) else {
      throw ResourceModuleError.invalidURL
    }
    return data
  }
}

private extension ResourceModuleInstaller {
  static func remoteURL(for path: String, relativeTo manifestURL: URL) throws -> URL {
    guard ResourcePathPolicy.isSafeRelativePath(path),
          let url = URL(string: path, relativeTo: manifestURL.deletingLastPathComponent())?.absoluteURL,
          url.scheme?.lowercased() == "https",
          url.host == manifestURL.host else {
      throw ResourceModuleError.invalidURL
    }
    return url
  }

  static func activate(stagingRoot: URL, targetRoot: URL, fileManager: FileManager) throws {
    if fileManager.fileExists(atPath: targetRoot.path) {
      _ = try fileManager.replaceItemAt(
        targetRoot,
        withItemAt: stagingRoot,
        backupItemName: nil,
        options: []
      )
    } else {
      try fileManager.moveItem(at: stagingRoot, to: targetRoot)
    }
  }
}

private extension Data {
  var sha256: String {
    SHA256.hash(data: self).map { String(format: "%02x", $0) }.joined()
  }
}

private extension JSONEncoder {
  static var resourceManifestEncoder: JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    return encoder
  }
}
