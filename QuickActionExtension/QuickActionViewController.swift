import AppKit
import UniformTypeIdentifiers

@objc(QuickActionViewController)
final class QuickActionViewController: NSViewController {
  private var inputURLs: [URL] = []
  private var context: NSExtensionContext?

  override func loadView() {
    let stack = NSStackView()
    stack.orientation = .vertical
    stack.alignment = .leading
    stack.spacing = 8
    stack.edgeInsets = NSEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    for action in QuickActionKind.allCases {
      let button = NSButton(title: action.title, target: self, action: #selector(runAction(_:)))
      button.identifier = NSUserInterfaceItemIdentifier(action.rawValue)
      button.bezelStyle = .rounded
      stack.addArrangedSubview(button)
    }
    view = stack
  }

  override func beginRequest(with context: NSExtensionContext) {
    self.context = context
    let providers = context.inputItems.compactMap { $0 as? NSExtensionItem }.flatMap {
      $0.attachments ?? []
    }
    let group = DispatchGroup()
    let lock = NSLock()
    var values: [URL] = []
    for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
      group.enter()
      provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, _ in
        let url = item as? URL ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
        if let url { lock.withLock { values.append(url) } }
        group.leave()
      }
    }
    group.notify(queue: .main) { [weak self] in
      self?.inputURLs = values
    }
  }

  @objc private func runAction(_ sender: NSButton) {
    guard let kind = sender.identifier.flatMap({ QuickActionKind(rawValue: $0.rawValue) }),
          !inputURLs.isEmpty else {
      NSSound.beep()
      return
    }
    do {
      let request = QuickActionRequestV1(
        version: 1,
        id: UUID(),
        createdAt: Date(),
        action: kind,
        resourceBookmarks: try inputURLs.map {
          try $0.bookmarkData(options: [.withSecurityScope], includingResourceValuesForKeys: nil, relativeTo: nil)
        }
      )
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
      ) else { throw CocoaError(.fileWriteNoPermission) }
      let directory = container.appending(path: "QuickActions/Pending", directoryHint: .isDirectory)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try JSONEncoder().encode(request).write(
        to: directory.appending(path: "\(request.id).json"),
        options: [.atomic, .completeFileProtectionUnlessOpen]
      )
      guard let callbackURL = URL(
        string: "ksamint-markedit://quick-action?id=\(request.id)"
      ) else { throw CocoaError(.fileWriteInvalidFileName) }
      NSWorkspace.shared.open(callbackURL)
      context?.completeRequest(returningItems: nil)
    } catch {
      context?.cancelRequest(withError: error)
    }
  }
}

private enum QuickActionKind: String, Codable, CaseIterable {
  case preview, openEditor, conversationInbox, saveReference, addWorkspace, analyzeAgent, convertMarkdown

  var title: String {
    switch self {
    case .preview: String(localized: "Quick Preview")
    case .openEditor: String(localized: "Open in ksamint MarkEdit")
    case .conversationInbox: String(localized: "Import to Conversation Inbox")
    case .saveReference: String(localized: "Save as Reference")
    case .addWorkspace: String(localized: "Add to Workspace")
    case .analyzeAgent: String(localized: "Analyze with Local Agent")
    case .convertMarkdown: String(localized: "Convert to Markdown")
    }
  }
}

private struct QuickActionRequestV1: Codable {
  let version: Int
  let id: UUID
  let createdAt: Date
  let action: QuickActionKind
  let resourceBookmarks: [Data]
}
