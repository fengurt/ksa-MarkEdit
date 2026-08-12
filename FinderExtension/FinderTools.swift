//
//  FinderTools.swift
//  FinderExtension
//
//  Created by cyan on 11/13/25.
//

import AppKit
import FinderSync
import os.log

final class FinderTools: FIFinderSync {
  private var securityScopedWorkspaceURLs: [URL] = []

  override init() {
    super.init()
    let defaults = UserDefaults(suiteName: "group.art.apuch.ksamint-markedit")
    let bookmarks = defaults?.array(forKey: "workspaceBookmarks") as? [Data] ?? []
    securityScopedWorkspaceURLs = bookmarks.compactMap { bookmark in
      var stale = false
      guard let url = try? URL(
        resolvingBookmarkData: bookmark,
        options: [.withSecurityScope],
        relativeTo: nil,
        bookmarkDataIsStale: &stale
      ), !stale, url.startAccessingSecurityScopedResource() else { return nil }
      return url.standardizedFileURL
    }
    let fallbackPaths = defaults?.stringArray(forKey: "workspacePaths") ?? []
    let urls = securityScopedWorkspaceURLs + fallbackPaths.map {
      URL(fileURLWithPath: $0, isDirectory: true).standardizedFileURL
    }
    FIFinderSyncController.default().directoryURLs = Set(urls)
  }

  override var toolbarItemName: String {
    String(format: String(localized: "New %@ File"), fileBaseName)
  }

  override var toolbarItemToolTip: String {
    toolbarItemName
  }

  override var toolbarItemImage: NSImage {
    let symbols = [
      "text.pad.header.badge.plus",
      "document.badge.plus",
      "plus.square.on.square",
    ]

    for symbol in symbols {
      if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil) {
        return image
      }
    }

    return super.toolbarItemImage
  }

  override func menu(for menuKind: FIMenuKind) -> NSMenu {
    let menu = NSMenu()
    if menuKind == .contextualMenuForItems || menuKind == .contextualMenuForContainer {
      let quickActions = NSMenu(title: String(localized: "kmd Quick Actions"))
      for (index, action) in WorkspaceQuickAction.allCases.enumerated() {
        let item = NSMenuItem(title: action.title, action: #selector(runQuickAction(_:)), keyEquivalent: "")
        item.tag = index
        item.target = self
        quickActions.addItem(item)
      }
      let wrapper = NSMenuItem(title: String(localized: "kmd Quick Actions"), action: nil, keyEquivalent: "")
      wrapper.submenu = quickActions
      menu.addItem(wrapper)
      menu.addItem(.separator())
    }
    let specs = fileTypes.map {
      String(format: String(localized: "New “%@%@”"), fileBaseName, $0)
    }

    for (index, title) in specs.enumerated() {
      let item = NSMenuItem(
        title: title,
        action: #selector(newTextFile(_:)),
        keyEquivalent: ""
      )

      item.tag = index
      menu.addItem(item)
    }

    if menuKind == .toolbarItemMenu {
      return menu
    }

    let itemWrapper = NSMenuItem(title: toolbarItemName, action: nil, keyEquivalent: "")
    itemWrapper.submenu = menu

    let menuWrapper = NSMenu()
    menuWrapper.addItem(itemWrapper)

    return menuWrapper
  }
}

// MARK: - Private

private let logger = os.Logger()
private let fileTypes = [".md", ".markdown", ".txt", ""]
private let fileBaseName = String(localized: "Untitled")

private extension FinderTools {
  @objc func runQuickAction(_ sender: NSMenuItem) {
    guard WorkspaceQuickAction.allCases.indices.contains(sender.tag) else { return }
    let urls = FIFinderSyncController.default().selectedItemURLs() ?? []
    guard !urls.isEmpty else { return logger.log(level: .error, "Missing selectedItemURLs") }
    do {
      let request = WorkspaceQuickActionRequest(
        version: 1,
        id: UUID(),
        createdAt: Date(),
        action: WorkspaceQuickAction.allCases[sender.tag],
        resourceBookmarks: try urls.map {
          try $0.bookmarkData(options: [.withSecurityScope], includingResourceValuesForKeys: nil, relativeTo: nil)
        }
      )
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
      ) else { throw CocoaError(.fileWriteNoPermission) }
      let directory = container.appending(path: "QuickActions/Pending", directoryHint: .isDirectory)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try JSONEncoder().encode(request).write(to: directory.appending(path: "\(request.id).json"), options: .atomic)
      guard let callbackURL = URL(
        string: "ksamint-markedit://quick-action?id=\(request.id)"
      ) else { throw CocoaError(.fileWriteInvalidFileName) }
      NSWorkspace.shared.open(callbackURL)
    } catch {
      logger.log(level: .error, "Quick Action failed: \(error.localizedDescription)")
    }
  }

  @objc func newTextFile(_ sender: NSMenuItem) {
    guard let directory = FIFinderSyncController.default().targetedURL() else {
      return logger.log(level: .error, "Missing targetedURL")
    }

    let uniqueFileURL = FileManager.default.uniqueFileURL(
      in: directory,
      baseName: fileBaseName,
      pathExtension: fileTypes[sender.tag]
    )

    do {
      try Data().write(to: uniqueFileURL)
      NSWorkspace.shared.activateFileViewerSelecting([uniqueFileURL])
    } catch {
      logger.log(level: .error, "\(error)")
    }
  }
}

private enum WorkspaceQuickAction: String, Codable, CaseIterable {
  case preview, openEditor, conversationInbox, saveReference, addWorkspace, analyzeAgent, convertMarkdown

  var title: String {
    switch self {
    case .preview: String(localized: "Quick Preview")
    case .openEditor: String(localized: "Open in Editor")
    case .conversationInbox: String(localized: "Import to Conversation Inbox")
    case .saveReference: String(localized: "Save as Reference")
    case .addWorkspace: String(localized: "Add to Workspace")
    case .analyzeAgent: String(localized: "Analyze with Local Agent")
    case .convertMarkdown: String(localized: "Convert to Markdown")
    }
  }
}

private struct WorkspaceQuickActionRequest: Codable {
  let version: Int
  let id: UUID
  let createdAt: Date
  let action: WorkspaceQuickAction
  let resourceBookmarks: [Data]
}

private extension FileManager {
  func uniqueFileURL(
    in directory: URL,
    baseName: String,
    pathExtension: String
  ) -> URL {
    var index = 1
    var fileName = "\(baseName)\(pathExtension)"

    while fileExists(atPath: directory.appending(path: fileName).path) {
      index += 1
      fileName = "\(baseName) \(index)\(pathExtension)"
    }

    return directory.appending(path: fileName)
  }
}
