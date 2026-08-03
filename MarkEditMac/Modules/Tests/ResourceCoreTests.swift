//
//  ResourceCoreTests.swift
//
//  Created by ksamint on 8/1/26.
//

import CryptoKit
import Foundation
import ResourceCore
import XCTest

final class ResourceCoreTests: XCTestCase {
  func testPathPolicyRejectsTraversalAndAbsolutePaths() {
    XCTAssertTrue(ResourcePathPolicy.isSafeRelativePath("notes/hello.md"))
    XCTAssertTrue(ResourcePathPolicy.isSafeRelativePath("資料/メモ.md"))
    XCTAssertFalse(ResourcePathPolicy.isSafeRelativePath("../secret"))
    XCTAssertFalse(ResourcePathPolicy.isSafeRelativePath("folder/../secret"))
    XCTAssertFalse(ResourcePathPolicy.isSafeRelativePath("/tmp/secret"))
    XCTAssertFalse(ResourcePathPolicy.isSafeRelativePath("C:\\secret"))
  }

  func testSignedManifestVerificationAndTamperDetection() throws {
    let key = P256.Signing.PrivateKey()
    let fileData = Data("export function open() {}".utf8)
    let unsigned = ResourceModuleManifestV1(
      id: "folder-base",
      version: "1.0.0",
      displayName: "Folder",
      entrypoint: "index.js",
      files: [
        ResourceModuleFileV1(
          path: "index.js",
          sha256: sha256(fileData),
          size: UInt64(fileData.count),
          mediaType: "text/javascript"
        ),
      ],
      probes: [ResourceProbeRuleV1(fileExtensions: ["md"], priority: 10)],
      signingKeyID: "official-test",
      signature: ""
    )
    let signature = try key.signature(for: unsigned.signingPayload()).derRepresentation.base64EncodedString()
    let signed = ResourceModuleManifestV1(
      id: unsigned.id,
      version: unsigned.version,
      displayName: unsigned.displayName,
      entrypoint: unsigned.entrypoint,
      files: unsigned.files,
      probes: unsigned.probes,
      signingKeyID: unsigned.signingKeyID,
      signature: signature
    )
    let trustStore = try ResourceModuleTrustStore(
      x963Keys: ["official-test": key.publicKey.x963Representation]
    )
    XCTAssertNoThrow(try signed.verifySignature(using: trustStore))

    let tampered = ResourceModuleManifestV1(
      id: signed.id,
      version: "1.0.1",
      displayName: signed.displayName,
      entrypoint: signed.entrypoint,
      files: signed.files,
      probes: signed.probes,
      signingKeyID: signed.signingKeyID,
      signature: signed.signature
    )
    XCTAssertThrowsError(try tampered.verifySignature(using: trustStore))
  }

  func testOfficialJavaScriptSignedModuleVector() throws {
    let repository = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    let modules = repository.appending(path: "ResourceModules")
    let publicKey = try String(
      contentsOf: modules.appending(path: "keys/official-v2-public.pem"),
      encoding: .utf8
    )
    let manifestData = try Data(
      contentsOf: modules.appending(path: "dist/folder-base/manifest.json")
    )
    let manifest = try JSONDecoder().decode(ResourceModuleManifestV1.self, from: manifestData)
    let trustStore = try ResourceModuleTrustStore(pemKeys: ["official-v2": publicKey])

    XCTAssertNoThrow(try manifest.verifySignature(using: trustStore))
    let registryData = try Data(contentsOf: modules.appending(path: "dist/registry.json"))
    let registry = try JSONDecoder().decode(ResourceModuleCatalogV2.self, from: registryData)
    XCTAssertNoThrow(try registry.verifySignature(using: trustStore))
    XCTAssertEqual(registry.modules.count, 5)
  }

  func testProbePriorityDoesNotMatchWithoutASelectorHit() {
    let minerU = ResourceProbeRuleV1(directoryMarkers: ["content_list.json"], priority: 600)
    XCTAssertNil(ResourceProbeMatcher.score(
      rule: minerU,
      extensionMatches: false,
      mediaTypeMatches: false,
      directoryMarkersMatch: false,
      frontMatterMatches: false
    ))
    let okf = ResourceProbeRuleV1(
      priority: 900,
      frontMatter: ResourceFrontMatterProbeV2(requiredKeys: ["okf_version"])
    )
    XCTAssertEqual(ResourceProbeMatcher.score(
      rule: okf,
      extensionMatches: false,
      mediaTypeMatches: false,
      directoryMarkersMatch: false,
      frontMatterMatches: true
    ), 1_200)
  }

  func testV2ProbeGroupSupportsAllAnyAndExplicitFallback() throws {
    let group = ResourceProbeGroupV2(
      mode: .any,
      conditions: [
        ResourceProbeConditionV2(fileExtensions: ["okf"]),
        ResourceProbeConditionV2(frontMatter: ResourceFrontMatterProbeV2(
          paths: ["index.md"],
          requiredKeys: ["okf_version"]
        )),
      ],
      score: 900
    )
    let rule = ResourceProbeRuleV1(group: group)
    XCTAssertNoThrow(try rule.validate())
    let encoded = try JSONEncoder().encode(rule)
    let json = try XCTUnwrap(String(data: encoded, encoding: .utf8))
    XCTAssertTrue(json.contains("\"group\""))
    XCTAssertFalse(json.contains("\"frontMatter\":null"))
    XCTAssertNoThrow(try ResourceProbeGroupV2(
      mode: .any,
      conditions: [],
      score: 1,
      fallback: true
    ).validate())
  }

  func testOKFFrontMatterProbeAndMissingExplicitPath() async throws {
    let root = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    try Data("---\nokf_version: 0.2\n---\n# Index".utf8).write(to: root.appending(path: "index.md"))
    let broker = try ResourceAccessBroker(rootURL: root)
    XCTAssertTrue(try await broker.matchesFrontMatter(ResourceFrontMatterProbeV2(
      paths: ["index.md"],
      requiredKeys: ["okf_version"],
      allowedValues: ["okf_version": ["0.1", "0.2"]]
    )))
    XCTAssertFalse(try await broker.matchesFrontMatter(ResourceFrontMatterProbeV2(
      paths: ["missing.md"],
      requiredKeys: ["type"]
    )))
  }

  func testEntrypointResolvesToAbsoluteFileURLWithinModule() throws {
    let root = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    try Data("export function open() {}".utf8).write(to: root.appending(path: "index.js"))
    let manifest = ResourceModuleManifestV1(
      id: "okf",
      version: "1.1.0",
      displayName: "OKF",
      entrypoint: "index.js",
      files: [ResourceModuleFileV1(
        path: "index.js",
        sha256: String(repeating: "0", count: 64),
        size: 25,
        mediaType: "text/javascript"
      )],
      probes: [],
      signingKeyID: "test",
      signature: ""
    )
    let resolved = try manifest.entrypointURL(in: root)
    XCTAssertTrue(resolved.isFileURL)
    XCTAssertEqual(resolved.lastPathComponent, "index.js")
  }

  func testFreshOfflineInstallHasValidBuiltInOKFHTMLAndArchiveModules() throws {
    let modules = repositoryRoot().appending(path: "ResourceModules")
    let publicKey = try String(
      contentsOf: modules.appending(path: "keys/official-v2-public.pem"),
      encoding: .utf8
    )
    let trustStore = try ResourceModuleTrustStore(pemKeys: ["official-v2": publicKey])
    for identifier in ["okf", "html-safe", "archive-base"] {
      let moduleURL = modules.appending(path: "dist/\(identifier)")
      let manifest = try ResourceModuleInstaller.validateModule(at: moduleURL, trustStore: trustStore)
      XCTAssertEqual(manifest.id, identifier)
      XCTAssertTrue(try manifest.entrypointURL(in: moduleURL).isFileURL)
    }
  }

  func testStandardOKFV02BundleSelectsOKFInsteadOfMinerU() async throws {
    let root = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    try Data("---\nokf_version: 0.2\n---\n# Catalog".utf8).write(to: root.appending(path: "index.md"))
    try Data("---\ntype: Concept\ntags: [研究]\n---\n# 知识".utf8).write(to: root.appending(path: "知识.md"))
    let broker = try ResourceAccessBroker(rootURL: root)
    let modules = repositoryRoot().appending(path: "ResourceModules/dist")
    var scores = [String: Int]()
    for identifier in ["okf", "mineru", "archive-base", "html-safe"] {
      let data = try Data(contentsOf: modules.appending(path: "\(identifier)/manifest.json"))
      let manifest = try JSONDecoder().decode(ResourceModuleManifestV1.self, from: data)
      for rule in manifest.probes {
        let markersMatch = if rule.directoryMarkers.isEmpty {
          false
        } else {
          await markersExist(rule.directoryMarkers, broker: broker)
        }
        let frontMatterMatches = if let probe = rule.frontMatter {
          try await broker.matchesFrontMatter(probe)
        } else {
          false
        }
        if let score = ResourceProbeMatcher.score(
          rule: rule,
          extensionMatches: false,
          mediaTypeMatches: false,
          directoryMarkersMatch: markersMatch,
          frontMatterMatches: frontMatterMatches
        ) {
          scores[identifier] = max(scores[identifier] ?? 0, score)
        }
      }
    }
    XCTAssertEqual(scores.max(by: { $0.value < $1.value })?.key, "okf")
    XCTAssertNil(scores["mineru"])
  }

  func testBrokerPagesAndReadsRanges() async throws {
    let root = try temporaryDirectory()
    defer {
      try? FileManager.default.removeItem(at: root)
    }
    try Data("abcdef".utf8).write(to: root.appending(path: "a.txt"))
    try Data("日本語".utf8).write(to: root.appending(path: "b.txt"))
    try FileManager.default.createDirectory(at: root.appending(path: "folder"), withIntermediateDirectories: true)

    let broker = try ResourceAccessBroker(rootURL: root, pageSize: 2)
    let first = try await broker.listChildren()
    XCTAssertEqual(first.entries.count, 2)
    XCTAssertNotNil(first.nextCursor)
    let second = try await broker.listChildren(cursor: first.nextCursor)
    XCTAssertEqual(second.entries.count, 1)
    XCTAssertNil(second.nextCursor)

    let range = try await broker.readRange(entryID: "a.txt", offset: 2, length: 3)
    XCTAssertEqual(String(data: range, encoding: .utf8), "cde")
    let search = try await broker.searchFileNames(query: "Ｂ", limit: 10)
    XCTAssertEqual(search.map(\.name), ["b.txt"])
  }

  func testBrokerRejectsExternalSymbolicLink() async throws {
    let root = try temporaryDirectory()
    let outside = try temporaryDirectory()
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: outside)
    }
    let secret = outside.appending(path: "secret.txt")
    try Data("secret".utf8).write(to: secret)
    try FileManager.default.createSymbolicLink(
      at: root.appending(path: "outside.txt"),
      withDestinationURL: secret
    )

    let broker = try ResourceAccessBroker(rootURL: root)
    do {
      _ = try await broker.listChildren()
      XCTFail("Expected an external symbolic link to be rejected")
    } catch let error as ResourceModuleError {
      guard case .outsideRoot = error else {
        return XCTFail("Unexpected error: \(error)")
      }
    }
  }

  func testInstallerChecksManifestAndEveryFileHash() async throws {
    let root = try temporaryDirectory()
    defer {
      try? FileManager.default.removeItem(at: root)
    }
    let key = P256.Signing.PrivateKey()
    let moduleData = Data("export const name = 'folder-base';".utf8)
    let draft = ResourceModuleManifestV1(
      id: "folder-base",
      version: "1.0.0",
      displayName: "Folder",
      entrypoint: "index.js",
      files: [
        ResourceModuleFileV1(
          path: "index.js",
          sha256: sha256(moduleData),
          size: UInt64(moduleData.count),
          mediaType: "text/javascript"
        ),
      ],
      probes: [],
      signingKeyID: "official-test",
      signature: ""
    )
    let signature = try key.signature(for: draft.signingPayload()).derRepresentation.base64EncodedString()
    let manifest = ResourceModuleManifestV1(
      id: draft.id,
      version: draft.version,
      displayName: draft.displayName,
      entrypoint: draft.entrypoint,
      files: draft.files,
      probes: draft.probes,
      signingKeyID: draft.signingKeyID,
      signature: signature
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let manifestData = try encoder.encode(manifest)
    let manifestURL = try XCTUnwrap(URL(string: "https://modules.example/folder-base/manifest.json"))
    let moduleURL = try XCTUnwrap(URL(string: "https://modules.example/folder-base/index.js"))
    let responses = [manifestURL: manifestData, moduleURL: moduleData]
    let trustStore = try ResourceModuleTrustStore(
      x963Keys: ["official-test": key.publicKey.x963Representation]
    )
    let installer = ResourceModuleInstaller(
      installationRoot: root,
      trustStore: trustStore
    ) { url in
      guard let data = responses[url] else {
        throw ResourceModuleError.notFound(url.absoluteString)
      }
      return data
    }

    let installed = try await installer.install(
      from: manifestURL,
      expectedSHA256: sha256(manifestData)
    )
    XCTAssertEqual(
      try Data(contentsOf: installed.appending(path: "index.js")),
      moduleData
    )
    _ = try await installer.validateInstalledModule(at: installed)
  }
}

private extension ResourceCoreTests {
  func repositoryRoot() -> URL {
    URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
  }

  func markersExist(_ markers: [String], broker: ResourceAccessBroker) async -> Bool {
    for marker in markers where (try? await broker.entry(id: marker)) == nil {
      return false
    }
    return true
  }

  func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
      path: "ksamint-resource-tests-\(UUID().uuidString)",
      directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
}
