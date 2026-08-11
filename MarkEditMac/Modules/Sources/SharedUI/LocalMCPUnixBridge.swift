//
//  LocalMCPUnixBridge.swift
//
//  Capability-authenticated Unix socket used only while the Agent panel is open.
//

import Darwin
import Foundation

public struct LocalMCPConnectionInfo: Sendable {
  public let socketPath: String
  public let capabilityFileURL: URL

  public init(socketPath: String, capabilityFileURL: URL) {
    self.socketPath = socketPath
    self.capabilityFileURL = capabilityFileURL
  }
}

public final class LocalMCPUnixServer: @unchecked Sendable {
  public enum BridgeError: LocalizedError {
    case invalidSocketPath
    case socketFailure(String)
    case authenticationFailed
    case messageTooLarge
    case disconnected

    public var errorDescription: String? {
      switch self {
      case .invalidSocketPath:
        "The local MCP socket path is invalid."
      case let .socketFailure(operation):
        "The local MCP socket could not \(operation)."
      case .authenticationFailed:
        "The local MCP capability token was rejected."
      case .messageTooLarge:
        "The local MCP message exceeds its safety limit."
      case .disconnected:
        "The local MCP connection closed unexpectedly."
      }
    }
  }

  public let connectionInfo: LocalMCPConnectionInfo

  private static let maximumRequestBytes = 2 * 1024 * 1024
  private static let maximumResponseBytes = 16 * 1024 * 1024
  private let listener: Int32
  private let capability: String
  private let server: LocalMCPServer
  private let acceptTask: Task<Void, Never>
  private let runtimeDirectory: URL
  private let stateLock = NSLock()
  private var stopped = false

  public static func start(
    workspaceURL: URL,
    runtimeRoot: URL = URL.applicationSupportDirectory
      .appending(path: "ksamint MarkEdit", directoryHint: .isDirectory)
      .appending(path: "AgentBridge", directoryHint: .isDirectory)
  ) async throws -> LocalMCPUnixServer {
    let server = try LocalMCPServer(workspaceURL: workspaceURL, allowWrite: false)
    try await server.prepare()
    let runtimeDirectory = runtimeRoot.appending(
      path: UUID().uuidString.lowercased(),
      directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(
      at: runtimeDirectory,
      withIntermediateDirectories: true,
      attributes: [.posixPermissions: 0o700]
    )
    let capability = Self.randomCapability()
    let capabilityFileURL = runtimeDirectory.appending(path: "capability", directoryHint: .notDirectory)
    try Data(capability.utf8).write(to: capabilityFileURL, options: [.atomic, .completeFileProtection])
    try FileManager.default.setAttributes(
      [.posixPermissions: 0o600],
      ofItemAtPath: capabilityFileURL.path
    )

    let socketPath = "/tmp/ksamint-agent-\(getuid())-\(UUID().uuidString.prefix(12)).sock"
    let listener = try SocketIO.listen(path: socketPath)
    return LocalMCPUnixServer(
      listener: listener,
      socketPath: socketPath,
      capabilityFileURL: capabilityFileURL,
      capability: capability,
      server: server,
      runtimeDirectory: runtimeDirectory
    )
  }

  private init(
    listener: Int32,
    socketPath: String,
    capabilityFileURL: URL,
    capability: String,
    server: LocalMCPServer,
    runtimeDirectory: URL
  ) {
    self.listener = listener
    self.connectionInfo = LocalMCPConnectionInfo(
      socketPath: socketPath,
      capabilityFileURL: capabilityFileURL
    )
    self.capability = capability
    self.server = server
    self.runtimeDirectory = runtimeDirectory
    self.acceptTask = Task.detached(priority: .utility) {
      while !Task.isCancelled {
        var readiness = pollfd(fd: listener, events: Int16(POLLIN), revents: 0)
        let ready = Darwin.poll(&readiness, 1, 250)
        if Task.isCancelled {
          break
        }
        if ready == 0 {
          continue
        }
        if ready < 0 {
          if errno == EINTR {
            continue
          }
          break
        }
        guard readiness.revents & Int16(POLLIN) != 0 else {
          break
        }
        let client = Darwin.accept(listener, nil, nil)
        if client < 0 {
          if errno == EINTR {
            continue
          }
          break
        }
        Task.detached(priority: .utility) {
          defer {
            Darwin.close(client)
          }
          try? await Self.serve(
            client: client,
            capability: capability,
            server: server
          )
        }
      }
    }
  }

  deinit {
    stop()
  }

  public func stop() {
    stateLock.lock()
    guard !stopped else {
      stateLock.unlock()
      return
    }
    stopped = true
    stateLock.unlock()
    acceptTask.cancel()
    Darwin.shutdown(listener, SHUT_RDWR)
    Darwin.close(listener)
    Darwin.unlink(connectionInfo.socketPath)
    try? FileManager.default.removeItem(at: runtimeDirectory)
  }
}

public enum LocalMCPUnixClient {
  public static func run(
    socketPath: String,
    capabilityFileURL: URL,
    input: FileHandle = .standardInput,
    output: FileHandle = .standardOutput
  ) async throws {
    let attributes = try FileManager.default.attributesOfItem(atPath: capabilityFileURL.path)
    let permissions = (attributes[.posixPermissions] as? NSNumber)?.intValue ?? 0
    let owner = (attributes[.ownerAccountID] as? NSNumber)?.uint32Value
    guard permissions & 0o077 == 0, owner == nil || owner == getuid() else {
      throw LocalMCPUnixServer.BridgeError.authenticationFailed
    }
    let capability = try String(contentsOf: capabilityFileURL, encoding: .utf8)
    let socket = try SocketIO.connect(path: socketPath)
    defer {
      Darwin.close(socket)
    }
    let auth = try JSONSerialization.data(withJSONObject: ["capability": capability])
    try SocketIO.writeLine(auth, to: socket)

    var responseBuffer = Data()
    for try await line in input.bytes.lines {
      let data = Data(line.utf8)
      guard data.count <= 2 * 1024 * 1024 else {
        throw LocalMCPUnixServer.BridgeError.messageTooLarge
      }
      try SocketIO.writeLine(data, to: socket)
      guard let response = try SocketIO.readLine(
        from: socket,
        buffer: &responseBuffer,
        maximumBytes: 16 * 1024 * 1024
      ) else {
        throw LocalMCPUnixServer.BridgeError.disconnected
      }
      try output.write(contentsOf: response)
      try output.write(contentsOf: Data([0x0A]))
    }
  }
}

private extension LocalMCPUnixServer {
  static func serve(client: Int32, capability: String, server: LocalMCPServer) async throws {
    var input = Data()
    guard let authData = try SocketIO.readLine(
      from: client,
      buffer: &input,
      maximumBytes: maximumRequestBytes
    ),
    let auth = try JSONSerialization.jsonObject(with: authData) as? [String: Any],
    auth["capability"] as? String == capability else {
      throw BridgeError.authenticationFailed
    }

    while let request = try SocketIO.readLine(
      from: client,
      buffer: &input,
      maximumBytes: maximumRequestBytes
    ) {
      let response = await server.responseData(for: request)
      guard response.count <= maximumResponseBytes else {
        throw BridgeError.messageTooLarge
      }
      try SocketIO.writeLine(response, to: client)
    }
  }

  static func randomCapability() -> String {
    var generator = SystemRandomNumberGenerator()
    return (0..<32)
      .map { _ in String(format: "%02x", UInt8.random(in: .min ... .max, using: &generator)) }
      .joined()
  }
}

private enum SocketIO {
  static func listen(path: String) throws -> Int32 {
    let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
    guard descriptor >= 0 else {
      throw LocalMCPUnixServer.BridgeError.socketFailure("be created")
    }
    do {
      var address = try unixAddress(path: path)
      let result = withUnsafePointer(to: &address) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
        }
      }
      guard result == 0 else {
        throw LocalMCPUnixServer.BridgeError.socketFailure("bind")
      }
      guard Darwin.chmod(path, S_IRUSR | S_IWUSR) == 0 else {
        throw LocalMCPUnixServer.BridgeError.socketFailure("set permissions")
      }
      guard Darwin.listen(descriptor, 8) == 0 else {
        throw LocalMCPUnixServer.BridgeError.socketFailure("listen")
      }
      return descriptor
    } catch {
      Darwin.close(descriptor)
      Darwin.unlink(path)
      throw error
    }
  }

  static func connect(path: String) throws -> Int32 {
    let descriptor = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
    guard descriptor >= 0 else {
      throw LocalMCPUnixServer.BridgeError.socketFailure("be created")
    }
    var address = try unixAddress(path: path)
    let result = withUnsafePointer(to: &address) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
      }
    }
    guard result == 0 else {
      Darwin.close(descriptor)
      throw LocalMCPUnixServer.BridgeError.socketFailure("connect")
    }
    return descriptor
  }

  static func readLine(
    from descriptor: Int32,
    buffer: inout Data,
    maximumBytes: Int
  ) throws -> Data? {
    while true {
      if let newline = buffer.firstIndex(of: 0x0A) {
        guard newline <= maximumBytes else {
          throw LocalMCPUnixServer.BridgeError.messageTooLarge
        }
        let line = buffer[..<newline]
        buffer.removeSubrange(...newline)
        return Data(line)
      }
      if buffer.count > maximumBytes {
        throw LocalMCPUnixServer.BridgeError.messageTooLarge
      }
      var bytes = [UInt8](repeating: 0, count: 64 * 1024)
      let count = Darwin.read(descriptor, &bytes, bytes.count)
      if count == 0 {
        return buffer.isEmpty ? nil : Data(buffer)
      }
      if count < 0 {
        if errno == EINTR {
          continue
        }
        throw LocalMCPUnixServer.BridgeError.disconnected
      }
      buffer.append(bytes, count: count)
    }
  }

  static func writeLine(_ data: Data, to descriptor: Int32) throws {
    var value = data
    value.append(0x0A)
    try value.withUnsafeBytes { rawBuffer in
      guard var base = rawBuffer.baseAddress else {
        return
      }
      var remaining = rawBuffer.count
      while remaining > 0 {
        let count = Darwin.write(descriptor, base, remaining)
        if count < 0 {
          if errno == EINTR {
            continue
          }
          throw LocalMCPUnixServer.BridgeError.disconnected
        }
        remaining -= count
        base = base.advanced(by: count)
      }
    }
  }

  static func unixAddress(path: String) throws -> sockaddr_un {
    let bytes = Array(path.utf8)
    var address = sockaddr_un()
    guard bytes.count < MemoryLayout.size(ofValue: address.sun_path) else {
      throw LocalMCPUnixServer.BridgeError.invalidSocketPath
    }
    address.sun_family = sa_family_t(AF_UNIX)
    withUnsafeMutableBytes(of: &address.sun_path) { buffer in
      buffer.initializeMemory(as: UInt8.self, repeating: 0)
      buffer.copyBytes(from: bytes)
    }
    return address
  }
}
