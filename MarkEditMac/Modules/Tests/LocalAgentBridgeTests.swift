//
//  LocalAgentBridgeTests.swift
//

import Foundation
import SharedUI
import XCTest

final class LocalAgentBridgeTests: XCTestCase {
  func testCapabilitySocketForwardsMCPWithoutTCP() async throws {
    let root = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    try Data("# Private note".utf8).write(to: root.appending(path: "note.md"))
    let runtime = root.appending(path: "runtime", directoryHint: .isDirectory)
    let server = try await LocalMCPUnixServer.start(workspaceURL: root, runtimeRoot: runtime)
    defer { server.stop() }

    let socketAttributes = try FileManager.default.attributesOfItem(
      atPath: server.connectionInfo.socketPath
    )
    XCTAssertEqual(((socketAttributes[.posixPermissions] as? NSNumber)?.intValue ?? 0) & 0o077, 0)
    let tokenAttributes = try FileManager.default.attributesOfItem(
      atPath: server.connectionInfo.capabilityFileURL.path
    )
    XCTAssertEqual(((tokenAttributes[.posixPermissions] as? NSNumber)?.intValue ?? 0) & 0o077, 0)

    let input = Pipe()
    let output = Pipe()
    let requests = [
      #"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#,
      #"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#,
    ].joined(separator: "\n") + "\n"
    try input.fileHandleForWriting.write(contentsOf: Data(requests.utf8))
    try input.fileHandleForWriting.close()
    try await LocalMCPUnixClient.run(
      socketPath: server.connectionInfo.socketPath,
      capabilityFileURL: server.connectionInfo.capabilityFileURL,
      input: input.fileHandleForReading,
      output: output.fileHandleForWriting
    )
    try output.fileHandleForWriting.close()
    let response = String(
      data: output.fileHandleForReading.readDataToEndOfFile(),
      encoding: .utf8
    ) ?? ""
    XCTAssertTrue(response.contains("ksamint-markedit"))
    XCTAssertTrue(response.contains("list_open_resources"))
    XCTAssertTrue(response.contains("read_resource_entry"))
  }

  func testCodexJSONLStreamingAndReadOnlyLaunch() async throws {
    let fixture = try mockCLI()
    defer { try? FileManager.default.removeItem(at: fixture.root) }
    let bridge = LocalAgentBridge()
    let configuration = LocalAgentMCPConfiguration(
      helperExecutableURL: fixture.executable,
      connection: LocalMCPConnectionInfo(
        socketPath: "/tmp/unused.sock",
        capabilityFileURL: fixture.root.appending(path: "capability")
      ),
      configurationDirectory: fixture.root.appending(path: "config")
    )
    try await bridge.start(
      provider: .codex,
      executableURL: fixture.executable,
      workspaceURL: fixture.root,
      mcp: configuration,
      applicationVersion: "2.1.0"
    )

    let result = Task { () -> String in
      var output = ""
      for await event in bridge.events {
        if case let .output(value) = event { output += value }
        if case .completed = event { return output }
      }
      return output
    }
    try await bridge.send("Summarize the note")
    let output = await result.value
    XCTAssertEqual(output, "mock answer")
    await bridge.stop()
  }

  func testClaudeJSONLStreamingAndPlanOnlyLaunch() async throws {
    let fixture = try mockClaudeCLI()
    defer { try? FileManager.default.removeItem(at: fixture.root) }
    let bridge = LocalAgentBridge()
    let configuration = LocalAgentMCPConfiguration(
      helperExecutableURL: fixture.executable,
      connection: LocalMCPConnectionInfo(
        socketPath: "/tmp/unused.sock",
        capabilityFileURL: fixture.root.appending(path: "capability")
      ),
      configurationDirectory: fixture.root.appending(path: "config")
    )
    try await bridge.start(
      provider: .claude,
      executableURL: fixture.executable,
      workspaceURL: fixture.root,
      mcp: configuration,
      applicationVersion: "2.1.0"
    )

    let result = Task { () -> String in
      var output = ""
      for await event in bridge.events {
        if case let .output(value) = event { output += value }
        if case .completed = event { return output }
      }
      return output
    }
    try await bridge.send("Summarize the resource")
    let output = await result.value
    XCTAssertEqual(output, "mock claude answer")
    await bridge.stop()
  }
}

private extension LocalAgentBridgeTests {
  struct Fixture {
    let root: URL
    let executable: URL
  }

  func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
      path: "ksamint-agent-tests-\(UUID().uuidString)",
      directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  func mockCLI() throws -> Fixture {
    let root = try temporaryDirectory()
    let executable = root.appending(path: "mock-agent")
    let script = #"""
    #!/bin/sh
    case "$*" in
      *dangerously-skip-permissions*) exit 90 ;;
    esac
    read initialize
    printf '%s\n' '{"id":1,"result":{"platformFamily":"unix"}}'
    read initialized
    read start
    printf '%s\n' '{"id":2,"result":{"thread":{"id":"thread-test"}}}'
    read turn
    printf '%s\n' '{"id":3,"result":{"turn":{"id":"turn-test","status":"inProgress"}}}'
    printf '%s\n' '{"method":"item/agentMessage/delta","params":{"delta":"mock answer"}}'
    printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-test","status":"completed"}}}'
    exit 0
    """#
    try script.write(to: executable, atomically: true, encoding: .utf8)
    try FileManager.default.setAttributes(
      [.posixPermissions: 0o700],
      ofItemAtPath: executable.path
    )
    try Data("test".utf8).write(to: root.appending(path: "capability"))
    return Fixture(root: root, executable: executable)
  }

  func mockClaudeCLI() throws -> Fixture {
    let root = try temporaryDirectory()
    let executable = root.appending(path: "mock-claude")
    let script = #"""
    #!/bin/sh
    case "$*" in
      *dangerously-skip-permissions*) exit 90 ;;
    esac
    case "$*" in
      *--permission-mode*plan*) ;;
      *) exit 91 ;;
    esac
    read request
    printf '%s\n' '{"type":"system","subtype":"init"}'
    printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"mock claude answer"}]}}'
    printf '%s\n' '{"type":"result","is_error":false,"result":"mock claude answer"}'
    exit 0
    """#
    try script.write(to: executable, atomically: true, encoding: .utf8)
    try FileManager.default.setAttributes(
      [.posixPermissions: 0o700],
      ofItemAtPath: executable.path
    )
    try Data("test".utf8).write(to: root.appending(path: "capability"))
    return Fixture(root: root, executable: executable)
  }
}
