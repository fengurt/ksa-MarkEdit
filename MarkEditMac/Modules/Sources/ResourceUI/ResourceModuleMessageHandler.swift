//
//  ResourceModuleMessageHandler.swift
//
//  Created by ksamint on 8/1/26.
//

import Foundation
import ResourceCore
import WebKit

@MainActor
final class ResourceModuleMessageHandler: NSObject, WKScriptMessageHandlerWithReply {
  private let session: ResourceSession
  private var operations = [String: Task<String, Error>]()

  init(session: ResourceSession) {
    self.session = session
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) async -> (Any?, String?) {
    guard let request = Self.decode(message.body) else {
      return (nil, "Invalid resource module request")
    }
    if request.method == .cancel {
      if let target = request.entryID {
        operations.removeValue(forKey: target)?.cancel()
      }
      return (try? Self.jsonString(["cancelled": request.entryID ?? ""]), nil)
    }

    operations[request.operationID]?.cancel()
    let operation = Task { @MainActor [weak self] in
      guard let self else {
        throw CancellationError()
      }
      let value = try await execute(request)
      try Task.checkCancellation()
      return try Self.jsonString(value)
    }
    operations[request.operationID] = operation
    defer {
      operations[request.operationID] = nil
    }
    do {
      return (try await operation.value, nil)
    } catch is CancellationError {
      return (nil, "Operation cancelled")
    } catch {
      return (nil, String(describing: error))
    }
  }
}

private extension ResourceModuleMessageHandler {
  static func decode(_ value: Any) -> ResourceModuleRequestV1? {
    guard JSONSerialization.isValidJSONObject(value),
          let data = try? JSONSerialization.data(withJSONObject: value) else {
      return nil
    }
    return try? JSONDecoder().decode(ResourceModuleRequestV1.self, from: data)
  }

  func execute(_ request: ResourceModuleRequestV1) async throws -> Any {
    switch request.method {
    case .probe, .open:
      return try Self.jsonObject(await session.broker.descriptor())
    case .listChildren:
      return try Self.jsonObject(await session.broker.listChildren(
        parentID: request.parentID,
        cursor: request.cursor
      ))
    case .readRange:
      guard let entryID = request.entryID else {
        throw ResourceModuleError.invalidManifest
      }
      let data = try await session.broker.readRange(
        entryID: entryID,
        offset: request.offset ?? 0,
        length: request.length ?? ResourceModuleLimits.maximumReadBytes
      )
      return [
        "base64": data.base64EncodedString(),
        "byteCount": data.count,
      ]
    case .search:
      let results = try await session.broker.searchFileNames(
        query: request.query ?? "",
        limit: request.limit ?? 500
      )
      return try Self.jsonObject(results)
    case .render:
      guard let entryID = request.entryID else {
        return try Self.jsonObject(await session.broker.descriptor())
      }
      let entry = try await session.broker.entry(id: entryID)
      let render = ResourceRenderV1(
        kind: .metadata,
        title: entry.name,
        resourceURL: session.resourceURL(entryID: entryID)?.absoluteString,
        metadata: [
          "mediaType": entry.mediaType ?? "application/octet-stream",
          "byteCount": String(entry.byteCount ?? 0),
        ]
      )
      return try Self.jsonObject(render)
    case .cancel:
      return ["cancelled": true]
    }
  }

  static func jsonObject<T: Encodable>(_ value: T) throws -> Any {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    return try JSONSerialization.jsonObject(with: encoder.encode(value))
  }

  static func jsonString(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value)
    guard let string = String(data: data, encoding: .utf8) else {
      throw ResourceModuleError.invalidManifest
    }
    return string
  }
}
