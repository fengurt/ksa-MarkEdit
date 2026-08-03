//
//  ResourceModuleWebKitTests.swift
//
//  Created by ksamint on 8/3/26.
//

import CryptoKit
import Foundation
import ResourceCore
@testable import ResourceUI
import WebKit
import XCTest

final class ResourceModuleWebKitTests: XCTestCase {
  @MainActor
  func testWKWebViewImportsModuleFromIsolatedModuleOrigin() async throws {
    let root = try temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    let dependency = "export const value = 'module-loaded';"
    let entrypoint = "import { value } from './dependency.js'; document.body.dataset.loaded = value;"
    try Data(dependency.utf8).write(to: root.appending(path: "dependency.js"))
    try Data(entrypoint.utf8).write(to: root.appending(path: "index.js"))
    let manifest = moduleManifest(entrypoint: entrypoint, dependency: dependency)
    let handler = ResourceModuleURLSchemeHandler(moduleURL: root, manifest: manifest)
    let moduleURL = try handler.moduleURL(path: manifest.entrypoint)
    handler.setShell("""
    <!doctype html><html><body>
      <script type="module">import \(try jsonString(moduleURL.absoluteString));</script>
    </body></html>
    """)
    let configuration = WKWebViewConfiguration()
    configuration.setURLSchemeHandler(handler, forURLScheme: ResourceModuleURLSchemeHandler.scheme)
    let webView = WKWebView(frame: .zero, configuration: configuration)
    let navigation = NavigationDelegate(expectation: expectation(description: "module shell"))
    webView.navigationDelegate = navigation
    webView.load(URLRequest(url: try handler.shellURL()))
    await fulfillment(of: [navigation.expectation], timeout: 5)
    let loaded = try await webView.callAsyncJavaScript(
      Self.waitForModuleScript,
      arguments: [:],
      in: nil,
      contentWorld: .page
    )
    XCTAssertEqual(loaded as? String, "module-loaded")
  }
}

private extension ResourceModuleWebKitTests {
  static let waitForModuleScript = """
  return await new Promise(resolve => {
    if (document.body.dataset.loaded) return resolve(document.body.dataset.loaded);
    const observer = new MutationObserver(() => {
      if (document.body.dataset.loaded) {
        observer.disconnect();
        resolve(document.body.dataset.loaded);
      }
    });
    observer.observe(document.body, { attributes: true });
    setTimeout(() => resolve(document.body.dataset.loaded || ''), 2000);
  });
  """

  func moduleManifest(entrypoint: String, dependency: String) -> ResourceModuleManifestV1 {
    ResourceModuleManifestV1(
      id: "webkit-test",
      version: "1.0.0",
      displayName: "WebKit Test",
      entrypoint: "index.js",
      files: [
        ResourceModuleFileV1(
          path: "index.js",
          sha256: sha256(entrypoint),
          size: UInt64(entrypoint.utf8.count),
          mediaType: "text/javascript"
        ),
        ResourceModuleFileV1(
          path: "dependency.js",
          sha256: sha256(dependency),
          size: UInt64(dependency.utf8.count),
          mediaType: "text/javascript"
        ),
      ],
      probes: [],
      signingKeyID: "test",
      signature: ""
    )
  }

  func temporaryDirectory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appending(
      path: "ksamint-module-webkit-tests-\(UUID().uuidString)",
      directoryHint: .isDirectory
    )
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  func jsonString(_ value: String) throws -> String {
    let data = try JSONEncoder().encode(value)
    return try XCTUnwrap(String(data: data, encoding: .utf8))
  }

  func sha256(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }
}

@MainActor
private final class NavigationDelegate: NSObject, WKNavigationDelegate {
  let expectation: XCTestExpectation

  init(expectation: XCTestExpectation) {
    self.expectation = expectation
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
    expectation.fulfill()
  }
}
