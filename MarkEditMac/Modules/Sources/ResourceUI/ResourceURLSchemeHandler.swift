//
//  ResourceURLSchemeHandler.swift
//
//  Created by ksamint on 8/1/26.
//

import Foundation
import ResourceCore
import WebKit

public final class ResourceURLSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
  nonisolated public static let scheme = "ksamint-resource"

  private let session: ResourceSession
  private let lock = NSLock()
  private var operations = [ObjectIdentifier: Task<Void, Never>]()
  private var activeOperations = Set<ObjectIdentifier>()

  public init(session: ResourceSession) {
    self.session = session
  }

  public func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
    let identifier = ObjectIdentifier(urlSchemeTask as AnyObject)
    _ = lock.withLock {
      activeOperations.insert(identifier)
    }
    let operation = Task { [session] in
      do {
        let request = urlSchemeTask.request
        guard let url = request.url,
              url.scheme == Self.scheme,
              url.host == session.id.uuidString.lowercased(),
              URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "capability" })?.value == session.capability else {
          throw ResourceModuleError.invalidURL
        }
        let entryID = String(url.path.drop(while: { $0 == "/" })).removingPercentEncoding ?? ""
        guard ResourcePathPolicy.isSafeRelativePath(entryID) else {
          throw ResourceModuleError.unsafePath(entryID)
        }
        let entry = try await session.broker.entry(id: entryID)
        let range = Self.byteRange(
          from: request.value(forHTTPHeaderField: "Range"),
          fileSize: entry.byteCount ?? 0
        )
        let data = try await session.broker.readRange(
          entryID: entryID,
          offset: range.offset,
          length: range.length
        )
        try Task.checkCancellation()
        guard self.finish(identifier) else {
          return
        }
        let response = URLResponse(
          url: url,
          mimeType: entry.mediaType ?? "application/octet-stream",
          expectedContentLength: data.count,
          textEncodingName: nil
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
      } catch is CancellationError {
        if self.finish(identifier) {
          urlSchemeTask.didFailWithError(URLError(.cancelled))
        }
      } catch {
        if self.finish(identifier) {
          urlSchemeTask.didFailWithError(error)
        }
      }
    }
    lock.withLock {
      if activeOperations.contains(identifier) {
        operations[identifier] = operation
      } else {
        operation.cancel()
      }
    }
  }

  public func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
    let identifier = ObjectIdentifier(urlSchemeTask as AnyObject)
    lock.withLock {
      activeOperations.remove(identifier)
      operations.removeValue(forKey: identifier)?.cancel()
    }
  }
}

private extension ResourceURLSchemeHandler {
  struct ByteRange {
    let offset: UInt64
    let length: Int
  }

  func finish(_ identifier: ObjectIdentifier) -> Bool {
    lock.withLock {
      guard activeOperations.remove(identifier) != nil else {
        return false
      }
      operations[identifier] = nil
      return true
    }
  }

  static func byteRange(from header: String?, fileSize: UInt64) -> ByteRange {
    let maximum = ResourceModuleLimits.maximumReadBytes
    guard let header,
          header.hasPrefix("bytes="),
          let separator = header.firstIndex(of: "-") else {
      return ByteRange(offset: 0, length: min(Int(clamping: fileSize), maximum))
    }
    let startText = header[header.index(header.startIndex, offsetBy: 6)..<separator]
    let endText = header[header.index(after: separator)...]
    guard let start = UInt64(startText), start < fileSize else {
      return ByteRange(offset: fileSize, length: 0)
    }
    let requestedEnd = UInt64(endText) ?? min(
      fileSize - 1,
      start + UInt64(maximum) - 1
    )
    let end = min(requestedEnd, fileSize - 1, start + UInt64(maximum) - 1)
    return ByteRange(offset: start, length: Int(end - start + 1))
  }
}
