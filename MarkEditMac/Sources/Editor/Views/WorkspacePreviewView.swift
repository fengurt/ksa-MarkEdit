//
//  WorkspacePreviewView.swift
//  MarkEditMac
//
//  Created by ksamint on 7/27/26.
//

import AppKit
import MarkEditCore
import MarkEditKit
import WebKit

@MainActor
final class WorkspacePreviewView: NSView {
  var onLocateSource: ((Int) -> Void)?
  var onOpenLink: ((String) -> Void)?
  var baseURL: URL?

  private let messageHandler = WorkspacePreviewMessageHandler()
  private var isReady = false
  private var pendingReset: (text: String, revision: UInt64)?

  private(set) lazy var webView: WKWebView = {
    let config: WKWebViewConfiguration = .newConfig()
    let contentController = WKUserContentController()
    contentController.add(messageHandler, name: WorkspacePreviewMessageHandler.name)
    config.userContentController = contentController
    config.setURLSchemeHandler(
      EditorImageLoader { [weak self] in self?.baseURL },
      forURLScheme: EditorImageLoader.scheme
    )

    let webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.disableWindowOcclusionDetection()
    return webView
  }()

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    messageHandler.delegate = self
    addSubview(webView)
    loadPreview()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layout() {
    super.layout()
    webView.frame = bounds
  }

  func reset(text: String, revision: UInt64) {
    guard isReady else {
      pendingReset = (text, revision)
      return
    }

    Task {
      _ = try? await webView.callAsyncJavaScript(
        "return window.previewBridge.reset(text, revision)",
        arguments: [
          "text": text,
          "revision": revision,
        ],
        in: nil,
        contentWorld: .page
      )
    }
  }

  func apply(changes: [EditorTextChange], revision: UInt64, compositionEnded: Bool) {
    guard isReady else {
      return
    }

    let payload = changes.map {
      [
        "from": $0.from,
        "to": $0.to,
        "insert": $0.insert,
      ] as [String: Any]
    }

    Task { [weak self] in
      guard let self else {
        return
      }

      let applied = try? await webView.callAsyncJavaScript(
        "return window.previewBridge.applyChanges(changes, revision, compositionEnded)",
        arguments: [
          "changes": payload,
          "revision": revision,
          "compositionEnded": compositionEnded,
        ],
        in: nil,
        contentWorld: .page
      ) as? Bool

      if applied != true {
        onRevisionMismatch?()
      }
    }
  }

  func scrollTo(position: Int) {
    guard isReady else {
      return
    }

    Task {
      _ = try? await webView.callAsyncJavaScript(
        "return window.previewBridge.scrollTo(position)",
        arguments: ["position": position],
        in: nil,
        contentWorld: .page
      )
    }
  }

  func renderCurrent() {
    guard isReady else {
      return
    }

    Task {
      _ = try? await webView.callAsyncJavaScript(
        "return window.previewBridge.render()",
        arguments: [:],
        in: nil,
        contentWorld: .page
      )
    }
  }

  var onRevisionMismatch: (() -> Void)?

  private func loadPreview() {
    guard let url = Bundle.main.url(
      forResource: "rendered-preview",
      withExtension: "html"
    ) else {
      Logger.assertFail("Missing rendered-preview.html")
      return
    }

    webView.loadFileURL(
      url,
      allowingReadAccessTo: url.deletingLastPathComponent()
    )
  }
}

extension WorkspacePreviewView: WKNavigationDelegate {
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
    isReady = true
    if let pendingReset {
      self.pendingReset = nil
      reset(text: pendingReset.text, revision: pendingReset.revision)
    }
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
  ) {
    let isInitialLoad = navigationAction.navigationType == .other
    decisionHandler(isInitialLoad ? .allow : .cancel)
  }
}

@MainActor
private protocol WorkspacePreviewMessageDelegate: AnyObject {
  func previewMessageDidLocateSource(position: Int)
  func previewMessageDidOpenLink(_ link: String)
}

private final class WorkspacePreviewMessageHandler: NSObject, WKScriptMessageHandler, @unchecked Sendable {
  static let name = "workspacePreview"
  weak var delegate: WorkspacePreviewMessageDelegate?

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard let payload = message.body as? [String: Any],
          let type = payload["type"] as? String else {
      return
    }

    let position = payload["position"] as? Int
    let link = payload["url"] as? String
    Task { @MainActor [weak self] in
      guard let self else {
        return
      }

      switch type {
      case "source":
        if let position {
          delegate?.previewMessageDidLocateSource(position: position)
        }
      case "link":
        if let link {
          delegate?.previewMessageDidOpenLink(link)
        }
      default:
        break
      }
    }
  }
}

extension WorkspacePreviewView: WorkspacePreviewMessageDelegate {
  fileprivate func previewMessageDidLocateSource(position: Int) {
    onLocateSource?(position)
  }

  fileprivate func previewMessageDidOpenLink(_ link: String) {
    onOpenLink?(link)
  }
}
