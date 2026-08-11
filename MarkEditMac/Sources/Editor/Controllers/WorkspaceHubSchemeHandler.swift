//
//  WorkspaceHubSchemeHandler.swift
//  MarkEditMac
//
//  Created by ksamint on 8/3/26.
//

import Foundation
import WebKit

final class WorkspaceHubSchemeHandler: NSObject, WKURLSchemeHandler {
  static let scheme = "ksamint-hub"

  private let rootURL = Bundle.main.resourceURL?
    .appending(path: "dist-mac", directoryHint: .isDirectory)
    .standardizedFileURL

  func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    guard let requestURL = urlSchemeTask.request.url,
          requestURL.scheme == Self.scheme,
          let rootURL else {
      urlSchemeTask.didFailWithError(URLError(.badURL))
      return
    }

    let relativePath = requestURL.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard !relativePath.isEmpty,
          !relativePath.split(separator: "/").contains("..") else {
      urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
      return
    }

    let fileURL = rootURL.appending(path: relativePath).standardizedFileURL
    guard fileURL.path.hasPrefix(rootURL.path + "/") else {
      urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
      return
    }

    do {
      let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
      let contentType = mimeType(for: fileURL.pathExtension)
      let response = HTTPURLResponse(
        url: requestURL,
        statusCode: 200,
        httpVersion: nil,
        headerFields: [
          "Access-Control-Allow-Origin": "*",
          "Content-Type": contentType,
        ]
      ) ?? URLResponse(
        url: requestURL,
        mimeType: contentType,
        expectedContentLength: data.count,
        textEncodingName: fileURL.pathExtension == "html" ? "utf-8" : nil
      )
      urlSchemeTask.didReceive(response)
      urlSchemeTask.didReceive(data)
      urlSchemeTask.didFinish()
    } catch {
      urlSchemeTask.didFailWithError(error)
    }
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    // no-op
  }

  private func mimeType(for pathExtension: String) -> String {
    switch pathExtension.lowercased() {
    case "html": return "text/html"
    case "js", "mjs": return "text/javascript"
    case "css": return "text/css"
    case "json": return "application/json"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "woff2": return "font/woff2"
    default: return "application/octet-stream"
    }
  }
}
