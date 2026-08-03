//
//  ResourceModuleViewController.swift
//
//  Created by ksamint on 8/1/26.
//

import AppKit
import ResourceCore
import WebKit

@MainActor
public final class ResourceModuleViewController: NSViewController, WKNavigationDelegate {
  private let session: ResourceSession
  private let moduleURL: URL?
  private let manifest: ResourceModuleManifestV1?
  private let catalogUnavailable: Bool
  private let messages: ResourceUIMessages
  private let openInEditor: @MainActor (URL) -> Void
  private let openExternally: @MainActor (URL) -> Void
  private var webView: WKWebView?
  private var messageHandler: ResourceModuleMessageHandler?
  private var schemeHandler: ResourceURLSchemeHandler?
  private let statusLabel = NSTextField(wrappingLabelWithString: "")

  public init(
    session: ResourceSession,
    moduleURL: URL?,
    manifest: ResourceModuleManifestV1?,
    catalogUnavailable: Bool,
    messages: ResourceUIMessages,
    openInEditor: @escaping @MainActor (URL) -> Void,
    openExternally: @escaping @MainActor (URL) -> Void
  ) {
    self.session = session
    self.moduleURL = moduleURL
    self.manifest = manifest
    self.catalogUnavailable = catalogUnavailable
    self.messages = messages
    self.openInEditor = openInEditor
    self.openExternally = openExternally
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override public func loadView() {
    let container = NSView()
    statusLabel.alignment = .center
    statusLabel.textColor = .secondaryLabelColor
    statusLabel.maximumNumberOfLines = 3
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(statusLabel)
    NSLayoutConstraint.activate([
      statusLabel.centerXAnchor.constraint(equalTo: container.centerXAnchor),
      statusLabel.centerYAnchor.constraint(equalTo: container.centerYAnchor),
      statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 40),
      statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -40),
    ])
    view = container
  }

  override public func viewDidLoad() {
    super.viewDidLoad()
    guard let moduleURL, let manifest else {
      statusLabel.stringValue = catalogUnavailable
        ? "\(messages.noCompatibleModule)\n\(messages.catalogUnavailable)"
        : messages.noCompatibleModule
      return
    }
    load(moduleURL: moduleURL, manifest: manifest)
  }

  public func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url,
          let scheme = url.scheme?.lowercased() else {
      return decisionHandler(.cancel)
    }
    if scheme == "file" {
      guard let moduleURL,
            ResourcePathPolicy.isDescendant(url.resolvingSymlinksInPath(), of: moduleURL.resolvingSymlinksInPath()) else {
        return decisionHandler(.cancel)
      }
      return decisionHandler(.allow)
    }
    decisionHandler(["about", ResourceURLSchemeHandler.scheme].contains(scheme) ? .allow : .cancel)
  }

  public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    webView.removeFromSuperview()
    self.webView = nil
    statusLabel.stringValue = messages.moduleStopped
    statusLabel.isHidden = false
  }
}

private extension ResourceModuleViewController {
  func load(moduleURL: URL, manifest: ResourceModuleManifestV1) {
    let contentController = WKUserContentController()
    let messageHandler = ResourceModuleMessageHandler(
      session: session,
      openInEditor: openInEditor,
      openExternally: openExternally
    )
    contentController.addScriptMessageHandler(messageHandler, contentWorld: .page, name: "ksamintResource")
    contentController.addUserScript(WKUserScript(
      source: Self.bridgeScript,
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    ))

    let configuration = WKWebViewConfiguration()
    let schemeHandler = ResourceURLSchemeHandler(session: session)
    configuration.setURLSchemeHandler(schemeHandler, forURLScheme: ResourceURLSchemeHandler.scheme)
    configuration.userContentController = contentController
    configuration.websiteDataStore = .nonPersistent()
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
    webView.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    statusLabel.isHidden = true
    self.messageHandler = messageHandler
    self.schemeHandler = schemeHandler
    self.webView = webView

    Task { @MainActor [weak self] in
      guard let self else {
        return
      }
      do {
        let descriptor = try await session.broker.descriptor()
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let descriptorData = try encoder.encode(descriptor)
        guard let descriptorJSON = String(data: descriptorData, encoding: .utf8) else {
          throw ResourceModuleError.invalidManifest
        }
        let entrypointURL = try manifest.entrypointURL(in: moduleURL)
        let entrypointData = try JSONEncoder().encode(entrypointURL.absoluteString)
        guard let entrypointJSON = String(data: entrypointData, encoding: .utf8) else {
          throw ResourceModuleError.invalidManifest
        }
        let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        webView.loadHTMLString(
          Self.shell(
            entrypoint: entrypointJSON,
            descriptor: descriptorJSON,
            nonce: nonce,
            failurePrefix: messages.moduleFailedPrefix
          ),
          baseURL: moduleURL
        )
      } catch {
        webView.removeFromSuperview()
        self.webView = nil
        statusLabel.stringValue = "\(messages.moduleFailedPrefix): \(error.localizedDescription)"
        statusLabel.isHidden = false
      }
    }
  }

  static func shell(
    entrypoint: String,
    descriptor: String,
    nonce: String,
    failurePrefix: String
  ) -> String {
    let prefixData = try? JSONEncoder().encode(failurePrefix)
    let prefix = prefixData.flatMap { String(data: $0, encoding: .utf8) } ?? "\"Preview failed\""
    return """
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'nonce-\(nonce)'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ksamint-resource:; media-src 'self' blob: ksamint-resource:; frame-src ksamint-resource:; connect-src ksamint-resource:; font-src 'self' data: ksamint-resource:; worker-src 'self' blob:; form-action 'none'; base-uri 'none'; object-src 'none'">
        <style>html,body,#resource-root{height:100%;margin:0}body{font:13px system-ui;color:CanvasText;background:Canvas}</style>
      </head>
      <body>
        <div id="resource-root"></div>
        <script type="module" nonce="\(nonce)">
          try {
            const module = await import(\(entrypoint));
            const open = module.open ?? module.default?.open;
            if (typeof open !== 'function') throw new Error('Module does not export open(resource)');
            await open(\(descriptor), document.getElementById('resource-root'));
          } catch (error) {
            document.getElementById('resource-root').textContent = \(prefix) + ': ' + String(error);
          }
        </script>
      </body>
    </html>
    """
  }

  static let bridgeScript = """
  Object.defineProperty(window, 'ksamintResource', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      request(value) {
        return window.webkit.messageHandlers.ksamintResource.postMessage(value).then(result => JSON.parse(result));
      }
    })
  });
  """
}

public struct ResourceUIMessages: Sendable {
  public let noCompatibleModule: String
  public let catalogUnavailable: String
  public let moduleStopped: String
  public let moduleFailedPrefix: String

  public init(
    noCompatibleModule: String,
    catalogUnavailable: String,
    moduleStopped: String,
    moduleFailedPrefix: String
  ) {
    self.noCompatibleModule = noCompatibleModule
    self.catalogUnavailable = catalogUnavailable
    self.moduleStopped = moduleStopped
    self.moduleFailedPrefix = moduleFailedPrefix
  }
}
