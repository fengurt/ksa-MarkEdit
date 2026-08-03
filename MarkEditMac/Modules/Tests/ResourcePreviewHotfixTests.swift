//
//  ResourcePreviewHotfixTests.swift
//
//  Created by ksamint on 8/3/26.
//

import Foundation
import ResourceCore
import XCTest

final class ResourcePreviewHotfixTests: XCTestCase {
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
    let matchesIndex = try await broker.matchesFrontMatter(ResourceFrontMatterProbeV2(
      paths: ["index.md"],
      requiredKeys: ["okf_version"],
      allowedValues: ["okf_version": ["0.1", "0.2"]]
    ))
    let matchesMissing = try await broker.matchesFrontMatter(ResourceFrontMatterProbeV2(
      paths: ["missing.md"],
      requiredKeys: ["type"]
    ))
    XCTAssertTrue(matchesIndex)
    XCTAssertFalse(matchesMissing)
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
      files: [
        ResourceModuleFileV1(
          path: "index.js",
          sha256: String(repeating: "0", count: 64),
          size: 25,
          mediaType: "text/javascript"
        ),
      ],
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
    XCTAssertEqual(scores.max { $0.value < $1.value }?.key, "okf")
    XCTAssertNil(scores["mineru"])
  }
}

private extension ResourcePreviewHotfixTests {
  func repositoryRoot() -> URL {
    URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .deletingLastPathComponent()
  }

  func markersExist(_ markers: [String], broker: ResourceAccessBroker) async -> Bool {
    for marker in markers {
      if (try? await broker.entry(id: marker)) == nil {
        return false
      }
    }
    return true
  }

  func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
      path: "ksamint-resource-hotfix-tests-\(UUID().uuidString)",
      directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
}
