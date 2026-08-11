import Foundation
@testable import SharedUI
import XCTest

final class WorkspaceConfigurationTests: XCTestCase {
  func testRoundTripUsesWorkspaceYAMLPathAndPreservesDefinitions() async throws {
    let root = FileManager.default.temporaryDirectory
      .appending(path: "WorkspaceConfiguration-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer {
      try? FileManager.default.removeItem(at: root)
    }
    let store = WorkspaceConfigurationStore(rootURL: root)
    var configuration = WorkspaceConfiguration()
    configuration.tags["café"] = .init(
      displayName: "Café",
      color: "#3F7C5F",
      description: "French research",
      aliases: ["coffee"]
    )
    configuration.categories["Projects/AI"] = .init(color: "#4A6FA5")
    try await store.write(configuration)

    let restored = try await store.load()
    XCTAssertEqual(restored, configuration)
    XCTAssertTrue(
      FileManager.default.fileExists(
        atPath: root.appending(path: ".ksamint/workspace.yml").path
      )
    )
  }
}
