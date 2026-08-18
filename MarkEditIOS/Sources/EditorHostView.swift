import MarkEditCore
import MarkEditKit
import SwiftUI
import UIKit
import WebKit

struct EditorHostView: UIViewControllerRepresentable {
  @ObservedObject var session: DocumentSession

  func makeCoordinator() -> Coordinator {
    Coordinator(generation: session.editorGeneration)
  }

  func makeUIViewController(context: Context) -> EditorHostController {
    let controller = EditorHostController(session: session)
    context.coordinator.controller = controller
    return controller
  }

  func updateUIViewController(_ controller: EditorHostController, context: Context) {
    guard context.coordinator.generation != session.editorGeneration else { return }
    context.coordinator.generation = session.editorGeneration
    controller.replaceDocument(with: session.text)
  }

  final class Coordinator {
    var generation: Int
    weak var controller: EditorHostController?

    init(generation: Int) {
      self.generation = generation
    }
  }
}

@MainActor
final class EditorHostController: UIViewController {
  private weak var session: DocumentSession?
  private var webView: WKWebView!
  private var bridge: WebModuleBridge!
  private var hasLoaded = false
  private var pendingDocumentText: String?

  init(session: DocumentSession) {
    self.session = session
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func loadView() {
    let modules = NativeModules(modules: [
      EditorModuleCore(delegate: self),
      EditorModuleTokenizer(),
      EditorModuleAPI(delegate: self),
      EditorModuleTranslation(),
    ])
    let contentController = WKUserContentController()
    contentController.addScriptMessageHandler(
      EditorMessageHandler(modules: modules),
      contentWorld: .page,
      name: "bridge"
    )

    let configuration = WKWebViewConfiguration()
    configuration.userContentController = contentController
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.setURLSchemeHandler(EditorChunkLoader(), forURLScheme: EditorChunkLoader.scheme)
    configuration.setURLSchemeHandler(
      EditorImageLoader { [weak self] in self?.session?.fileURL?.deletingLastPathComponent() },
      forURLScheme: EditorImageLoader.scheme
    )

    webView = WKWebView(frame: .zero, configuration: configuration)
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.keyboardDismissMode = .interactive
    webView.navigationDelegate = self
    bridge = WebModuleBridge(webView: webView)
    view = webView

    let html = Self.editorConfig.toHtml
      .replacingOccurrences(of: "\"{{USER_SETTINGS}}\"", with: "{}")
    webView.loadHTMLString(html, baseURL: URL(string: "http://localhost/")!)

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(gotoEditorPosition(_:)),
      name: .kmdGotoEditorPosition,
      object: nil
    )
  }

  func replaceDocument(with text: String) {
    guard hasLoaded else {
      pendingDocumentText = text
      return
    }
    Task { [weak self] in
      _ = try? await self?.bridge.core.resetEditor(
        text: text,
        selectionRange: nil,
        documentChanged: true
      )
    }
  }

  @objc private func gotoEditorPosition(_ notification: Notification) {
    guard let position = notification.userInfo?["position"] as? Int else { return }
    bridge.selection.gotoPosition(position: position)
  }

  private static var editorConfig: EditorConfig {
    EditorConfig(
      text: "",
      theme: "github-light",
      fontFace: WebFontFace(
        family: "ui-monospace, SFMono-Regular, Menlo, monospace",
        weight: nil,
        style: nil
      ),
      fontSize: 16,
      showLineNumbers: false,
      showActiveLineIndicator: false,
      invisiblesBehavior: .selection,
      readOnlyMode: false,
      typewriterMode: false,
      focusMode: false,
      visualEditingMode: false,
      lineWrapping: true,
      lineHeight: 1.55,
      suggestWhileTyping: false,
      standardDirectories: [:],
      runtimeInfo: nil,
      defaultLineBreak: "\n",
      tabKeyBehavior: 0,
      indentUnit: "  ",
      localizable: nil,
      autoCharacterPairs: true,
      indentBehavior: .paragraph,
      undoGroupingInterval: nil,
      headerFontSizeDiffs: nil,
      visibleWhitespaceCharacter: nil,
      visibleLineBreakCharacter: nil,
      searchNormalizers: nil
    )
  }
}

extension EditorHostController: EditorModuleCoreDelegate {
  func editorCoreWindowDidLoad(_ sender: EditorModuleCore) {
    hasLoaded = true
    let text = pendingDocumentText ?? session?.text ?? ""
    pendingDocumentText = nil
    Task { [weak self] in
      guard let self else { return }
      _ = try? await bridge.core.resetEditor(
        text: text,
        selectionRange: nil,
        documentChanged: true
      )
      bridge.api.notifyAppReady()
    }
  }

  func editorCoreWindowResize(
    _ sender: EditorModuleCore,
    method: NativeModuleCoreNotifyWindowResizeMethod,
    size: CGSize
  ) {}

  func editorCoreWindowMove(
    _ sender: EditorModuleCore,
    method: NativeModuleCoreNotifyWindowMoveMethod,
    point: CGPoint
  ) {}

  func editorCoreWindowClose(_ sender: EditorModuleCore) {}
  func editorCoreEditorDidBecomeIdle(_ sender: EditorModuleCore) {}
  func editorCoreBackgroundColorDidChange(_ sender: EditorModuleCore, color: UInt32, alpha: Double) {}
  func editorCoreViewportScaleDidChange(_ sender: EditorModuleCore) {}

  func editorCoreViewDidUpdate(
    _ sender: EditorModuleCore,
    contentEdited: Bool,
    compositionEnded: Bool,
    isDirty: Bool,
    selectedLineColumn: LineColumnInfo
  ) {}

  func editorCoreTextChanged(
    _ sender: EditorModuleCore,
    revision: UInt64,
    changes: [EditorTextChange],
    compositionEnded: Bool
  ) {
    session?.applyEditorChanges(changes)
  }

  func editorCoreContentHeightDidChange(_ sender: EditorModuleCore, bottomPanelHeight: Double) {}
  func editorCoreContentOffsetDidChange(_ sender: EditorModuleCore, sourcePosition: Int) {}
  func editorCoreCompositionEnded(_ sender: EditorModuleCore, selectedLineColumn: LineColumnInfo) {}

  func editorCoreLinkClicked(_ sender: EditorModuleCore, link: String) {
    guard let url = URL(string: link),
          let scheme = url.scheme?.lowercased(),
          ["http", "https"].contains(scheme) else { return }
    UIApplication.shared.open(url)
  }

  func editorCoreLightWarning(_ sender: EditorModuleCore) {}
}

extension EditorHostController: EditorModuleAPIDelegate {
  func editorAPISaveDocument(_ sender: EditorModuleAPI) async -> Bool {
    await session?.save() ?? false
  }

  func editorAPICloseDocument(_ sender: EditorModuleAPI) -> Bool { false }
  func editorAPI(_ sender: EditorModuleAPI, addMainMenuItems items: [(String, WebMenuItem)]) {}
  func editorAPI(_ sender: EditorModuleAPI, showContextMenu items: [WebMenuItem], location: WebPoint) {}

  func editorAPI(
    _ sender: EditorModuleAPI,
    alertWith title: String?,
    message: String?,
    buttons: [String]?
  ) async -> Int {
    0
  }

  func editorAPI(
    _ sender: EditorModuleAPI,
    showTextBox title: String?,
    placeholder: String?,
    defaultValue: String?
  ) async -> String? {
    nil
  }

  func editorAPI(_ sender: EditorModuleAPI, showSavePanel data: Data, fileName: String?) async -> Bool {
    false
  }

  func editorAPI(_ sender: EditorModuleAPI, runService name: String, input: String?) async -> Bool {
    false
  }

  func editorAPIOpenFile(_ sender: EditorModuleAPI, fileURL: URL) -> Bool {
    false
  }

  func editorAPIGetFileURL(_ sender: EditorModuleAPI, path: String?) -> URL? {
    guard let base = session?.fileURL?.deletingLastPathComponent() else { return nil }
    guard let path else { return session?.fileURL }
    guard !path.hasPrefix("/"), !path.split(separator: "/").contains("..") else { return nil }
    let candidate = base.appending(path: path).standardizedFileURL
    guard candidate.path.hasPrefix(base.standardizedFileURL.path + "/") else { return nil }
    return candidate
  }
}

extension EditorHostController: WKNavigationDelegate {
  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
  ) {
    guard navigationAction.navigationType == .linkActivated,
          let url = navigationAction.request.url,
          let scheme = url.scheme?.lowercased(),
          ["http", "https"].contains(scheme) else {
      decisionHandler(.allow)
      return
    }
    UIApplication.shared.open(url)
    decisionHandler(.cancel)
  }
}

private final class EditorChunkLoader: NSObject, WKURLSchemeHandler {
  static let scheme = "chunk-loader"

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url, url.host == "chunks" else {
      task.didFailWithError(URLError(.badURL))
      return
    }
    let name = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard !name.isEmpty,
          !name.split(separator: "/").contains(".."),
          let fileURL = Bundle.main.url(forResource: "chunks/\(name)", withExtension: nil),
          let data = try? Data(contentsOf: fileURL),
          let mime = Self.mimeTypes[fileURL.pathExtension] else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }
    let response = URLResponse(
      url: url,
      mimeType: mime,
      expectedContentLength: data.count,
      textEncodingName: nil
    )
    task.didReceive(response)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

  private static let mimeTypes = [
    "js": "text/javascript",
    "css": "text/css",
    "woff2": "font/woff2",
  ]
}
