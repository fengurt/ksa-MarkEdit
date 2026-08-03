//
//  ResourceModuleURLSchemeHandler.swift
//
//  Created by ksamint on 8/3/26.
//

import Foundation
import ResourceCore
import WebKit

/// Serves a verified module and its generated shell from one isolated origin.
/// `loadHTMLString` has an opaque origin in WebKit and therefore cannot import a
/// local ES module, even when a file base URL is supplied.
final class ResourceModuleURLSchemeHandler: NSObject, WKURLSchemeHandler, @unchecked Sendable {
  nonisolated static let scheme = "ksamint-module"

  private let moduleURL: URL
  private let allowedFiles: [String: ResourceModuleFileV1]
  private let capability = UUID().uuidString.lowercased()
  private let lock = NSLock()
  private var shell = Data()

  init(moduleURL: URL, manifest: ResourceModuleManifestV1) {
    self.moduleURL = moduleURL.resolvingSymlinksInPath()
    allowedFiles = Dictionary(uniqueKeysWithValues: manifest.files.map { ($0.path, $0) })
  }

  func shellURL() throws -> URL {
    try url(path: "shell.html")
  }

  func moduleURL(path: String) throws -> URL {
    guard allowedFiles[path] != nil,
          ResourcePathPolicy.isSafeRelativePath(path) else {
      throw ResourceModuleError.unsafePath(path)
    }
    return try url(path: path)
  }

  func setShell(_ html: String) {
    lock.withLock {
      shell = Data(html.utf8)
    }
  }

  func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
    do {
      let request = urlSchemeTask.request
      guard let url = request.url,
            url.scheme == Self.scheme,
            url.host == capability else {
        throw ResourceModuleError.invalidURL
      }
      let path = String(url.path.drop { $0 == "/" }).removingPercentEncoding ?? ""
      let payload: Payload
      if path == "shell.html" {
        let data = lock.withLock { shell }
        guard !data.isEmpty else {
          throw ResourceModuleError.invalidURL
        }
        payload = Payload(data: data, mediaType: "text/html")
      } else {
        payload = try modulePayload(path: path)
      }
      let response = URLResponse(
        url: url,
        mimeType: payload.mediaType,
        expectedContentLength: payload.data.count,
        textEncodingName: payload.mediaType.hasPrefix("text/") ? "utf-8" : nil
      )
      urlSchemeTask.didReceive(response)
      urlSchemeTask.didReceive(payload.data)
      urlSchemeTask.didFinish()
    } catch {
      urlSchemeTask.didFailWithError(error)
    }
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
}

private extension ResourceModuleURLSchemeHandler {
  struct Payload {
    let data: Data
    let mediaType: String
  }

  func url(path: String) throws -> URL {
    var components = URLComponents()
    components.scheme = Self.scheme
    components.host = capability
    components.path = "/\(path)"
    guard let url = components.url else {
      throw ResourceModuleError.invalidURL
    }
    return url
  }

  func modulePayload(path: String) throws -> Payload {
    guard ResourcePathPolicy.isSafeRelativePath(path),
          let file = allowedFiles[path] else {
      throw ResourceModuleError.unsafePath(path)
    }
    let fileURL = moduleURL.appending(path: path, directoryHint: .notDirectory).resolvingSymlinksInPath()
    guard ResourcePathPolicy.isDescendant(fileURL, of: moduleURL) else {
      throw ResourceModuleError.unsafePath(path)
    }
    let data = try Data(contentsOf: fileURL, options: [.mappedIfSafe])
    guard data.count == file.size else {
      throw ResourceModuleError.integrityMismatch(path)
    }
    return Payload(data: data, mediaType: file.mediaType)
  }
}
