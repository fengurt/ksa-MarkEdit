//
//  ResourceSession.swift
//
//  Created by ksamint on 8/1/26.
//

import Foundation
import ResourceCore

public final class ResourceSession: @unchecked Sendable {
  public let id: UUID
  public let broker: ResourceAccessBroker
  public let capability: String

  public init(url: URL) throws {
    self.id = UUID()
    self.broker = try ResourceAccessBroker(rootURL: url)
    self.capability = Self.randomCapability()
  }

  public func resourceURL(entryID: String) -> URL? {
    guard ResourcePathPolicy.isSafeRelativePath(entryID) else {
      return nil
    }
    var components = URLComponents()
    components.scheme = ResourceURLSchemeHandler.scheme
    components.host = id.uuidString.lowercased()
    components.path = "/\(entryID)"
    components.queryItems = [URLQueryItem(name: "capability", value: capability)]
    return components.url
  }
}

private extension ResourceSession {
  static func randomCapability() -> String {
    (0..<32).map { _ in
      String(format: "%02x", UInt8.random(in: .min ... .max))
    }.joined()
  }
}
