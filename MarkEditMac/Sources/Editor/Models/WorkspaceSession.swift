//
//  WorkspaceSession.swift
//  MarkEditMac
//
//  Created by ksamint on 7/27/26.
//

import AppKit
import SharedUI

enum WorkspaceSidebarMode: Int {
  case files
  case search
  case tags
  case preview
}

enum WorkspaceTaxonomyItem: Equatable {
  case tag(WorkspaceTagSummary)
  case category(WorkspaceCategorySummary)

  var displayName: String {
    switch self {
    case let .tag(tag):
      return tag.displayName
    case let .category(category):
      return category.path
    }
  }

  var fileCount: Int {
    switch self {
    case let .tag(tag):
      return tag.fileCount
    case let .category(category):
      return category.fileCount
    }
  }
}

enum WorkspaceTaxonomyAction: Equatable {
  case rename
  case merge
  case delete
}

struct WorkspaceHubSnapshot: Codable {
  let workspaceName: String
  let rootPath: String
  let recentFiles: [WorkspaceFileSummary]
  let tags: [WorkspaceTagSummary]
  let categories: [WorkspaceCategorySummary]
  let graph: WorkspaceGraph
  let accountEnabled: Bool
  let syncEnabled: Bool
  let backupEnabled: Bool
}

@MainActor
final class WorkspaceSession {
  let rootURL: URL
  let index: WorkspaceIndex
  let deepSearchIndex: WorkspaceDeepSearch

  private(set) var isAuthorized: Bool
  var onFileSystemChange: (() -> Void)?
  var onIndexStateChange: ((WorkspaceIndexState) -> Void)?

  private let bookmark: Data
  private let filePresenter: WorkspaceFilePresenter
  private var refreshTask: Task<Void, Never>?

  init(rootURL: URL, bookmark: Data, isAuthorized: Bool) {
    let standardizedRoot = rootURL.standardizedFileURL
    self.rootURL = standardizedRoot
    self.bookmark = bookmark
    self.isAuthorized = isAuthorized
    self.index = WorkspaceIndex(rootURL: standardizedRoot)
    self.deepSearchIndex = WorkspaceDeepSearch(rootURL: standardizedRoot)
    self.filePresenter = WorkspaceFilePresenter(rootURL: standardizedRoot)

    filePresenter.onChange = { [weak self] changedURL in
      self?.scheduleRefresh(changedURL: changedURL)
    }
    NSFileCoordinator.addFilePresenter(filePresenter)
  }

  deinit {
    refreshTask?.cancel()
    NSFileCoordinator.removeFilePresenter(filePresenter)
    if isAuthorized {
      rootURL.stopAccessingSecurityScopedResource()
    }
  }

  static func create(for rootURL: URL) throws -> WorkspaceSession {
    let bookmark = try rootURL.bookmarkData(
      options: [.withSecurityScope],
      includingResourceValuesForKeys: nil,
      relativeTo: nil
    )
    let isAuthorized = rootURL.startAccessingSecurityScopedResource()
    return WorkspaceSession(rootURL: rootURL, bookmark: bookmark, isAuthorized: isAuthorized)
  }

  static func restore(from bookmark: Data) throws -> WorkspaceSession {
    var isStale = false
    let url = try URL(
      resolvingBookmarkData: bookmark,
      options: [.withSecurityScope],
      relativeTo: nil,
      bookmarkDataIsStale: &isStale
    )
    let isAuthorized = url.startAccessingSecurityScopedResource()
    let resolvedBookmark = isStale
      ? try url.bookmarkData(
        options: [.withSecurityScope],
        includingResourceValuesForKeys: nil,
        relativeTo: nil
      )
      : bookmark

    return WorkspaceSession(rootURL: url, bookmark: resolvedBookmark, isAuthorized: isAuthorized)
  }

  func persist(for fileURLs: [URL] = []) {
    AppPreferences.General.workspaceFolderBookmark = bookmark

    guard !fileURLs.isEmpty else {
      return
    }

    var bookmarks = AppPreferences.General.workspaceFolderBookmarks
    for fileURL in fileURLs where contains(fileURL) {
      bookmarks[fileURL.standardizedFileURL.path] = bookmark
    }
    AppPreferences.General.workspaceFolderBookmarks = bookmarks
  }

  func contains(_ url: URL) -> Bool {
    let root = rootURL.resolvingSymlinksInPath().standardizedFileURL
    let candidate = url.resolvingSymlinksInPath().standardizedFileURL
    let rootComponents = root.pathComponents
    let candidateComponents = candidate.pathComponents

    return candidateComponents.count >= rootComponents.count
      && candidateComponents.prefix(rootComponents.count) == rootComponents[...]
  }

  func rebuildIndex() {
    guard isAuthorized else {
      onIndexStateChange?(.failed)
      return
    }

    onIndexStateChange?(.indexing)
    Task { [weak self] in
      guard let self else {
        return
      }

      do {
        let fileCount = try await index.rebuild()
        guard !Task.isCancelled else {
          return
        }
        onIndexStateChange?(.ready(fileCount: fileCount))
      } catch {
        onIndexStateChange?(.failed)
      }
    }
  }

  func search(_ query: String) async -> [WorkspaceSearchResult] {
    guard isAuthorized else {
      return []
    }

    return await index.search(query)
  }

  func deepSearch(_ query: String) async throws -> [WorkspaceSearchResult] {
    guard isAuthorized else {
      return []
    }
    return try await deepSearchIndex.search(query).map(\.result)
  }

  func deepSearchState() async -> WorkspaceDeepSearchState {
    await deepSearchIndex.state
  }

  func installAndIndexDeepSearch() async throws {
    guard isAuthorized else {
      return
    }
    try await deepSearchIndex.installModel()
    _ = try await deepSearchIndex.rebuild()
  }

  func taxonomy() async -> ([WorkspaceTagSummary], [WorkspaceCategorySummary]) {
    guard isAuthorized else {
      return ([], [])
    }
    let tags = await index.tags()
    let categories = await index.categories()
    return (tags, categories)
  }

  func files(for item: WorkspaceTaxonomyItem) async -> [URL] {
    guard isAuthorized else {
      return []
    }

    switch item {
    case let .tag(tag):
      return await index.files(tagIdentity: tag.identity)
    case let .category(category):
      return await index.files(categoryPath: category.path)
    }
  }

  func graph(limit: Int = WorkspaceIndex.defaultGraphNodeLimit) async -> WorkspaceGraph {
    guard isAuthorized else {
      return WorkspaceGraph(nodes: [], edges: [])
    }
    return await index.graph(limit: limit)
  }

  func hubSnapshot() async -> WorkspaceHubSnapshot {
    let recentFiles = await index.recentFiles()
    let tags = await index.tags()
    let categories = await index.categories()
    let graph = await index.graph()
    let configuration = try? await WorkspaceConfigurationStore(rootURL: rootURL).load()
    let sync = configuration?.sync
    return WorkspaceHubSnapshot(
      workspaceName: rootURL.lastPathComponent,
      rootPath: rootURL.path,
      recentFiles: recentFiles,
      tags: tags,
      categories: categories,
      graph: graph,
      accountEnabled: sync?.accountEnabled == true,
      syncEnabled: sync?.syncEnabled == true,
      backupEnabled: sync?.cosBackupEnabled == true || sync?.githubBackupEnabled == true
    )
  }

  private func scheduleRefresh(changedURL: URL?) {
    refreshTask?.cancel()
    refreshTask = Task { [weak self] in
      try? await Task.sleep(for: .milliseconds(250))
      guard let self, !Task.isCancelled else {
        return
      }

      onFileSystemChange?()

      do {
        if let changedURL, contains(changedURL) {
          try await index.refresh(url: changedURL)
        } else {
          _ = try await index.rebuild()
        }

        guard !Task.isCancelled else {
          return
        }
        onIndexStateChange?(await index.state)
      } catch {
        onIndexStateChange?(.failed)
      }
    }
  }
}

@MainActor
enum WorkspaceSessionRegistry {
  private static var sessions = [String: WorkspaceSession]()

  static func register(_ session: WorkspaceSession, for fileURL: URL) {
    sessions[fileURL.standardizedFileURL.path] = session
  }

  static func consume(for fileURL: URL?) -> WorkspaceSession? {
    guard let fileURL else {
      return nil
    }

    return sessions.removeValue(forKey: fileURL.standardizedFileURL.path)
  }
}

final class WorkspaceTreeNode: NSObject {
  let url: URL
  let isDirectory: Bool
  let isSymbolicLink: Bool
  weak var parent: WorkspaceTreeNode?

  private var loadedChildren: [WorkspaceTreeNode]?

  init(url: URL, parent: WorkspaceTreeNode? = nil) {
    let values = try? url.resourceValues(forKeys: [
      .isDirectoryKey,
      .isSymbolicLinkKey,
    ])

    self.url = url.standardizedFileURL
    self.isDirectory = values?.isDirectory == true
    self.isSymbolicLink = values?.isSymbolicLink == true
    self.parent = parent
  }

  func children(showHiddenFiles: Bool) -> [WorkspaceTreeNode] {
    if let loadedChildren {
      return loadedChildren
    }

    guard isDirectory, !isSymbolicLink else {
      return []
    }

    let properties: [URLResourceKey] = [
      .isDirectoryKey,
      .isSymbolicLinkKey,
      .isHiddenKey,
    ]
    let urls = (try? FileManager.default.contentsOfDirectory(
      at: url,
      includingPropertiesForKeys: properties,
      options: showHiddenFiles ? [] : [.skipsHiddenFiles]
    )) ?? []

    let children = urls
      .map { WorkspaceTreeNode(url: $0, parent: self) }
      .sorted {
        if $0.isDirectory != $1.isDirectory {
          return $0.isDirectory
        }
        return $0.url.lastPathComponent.localizedStandardCompare($1.url.lastPathComponent) == .orderedAscending
      }

    loadedChildren = children
    return children
  }

  func invalidate(recursive: Bool = false) {
    if recursive {
      loadedChildren?.forEach { $0.invalidate(recursive: true) }
    }
    loadedChildren = nil
  }
}

private final class WorkspaceFilePresenter: NSObject, NSFilePresenter, @unchecked Sendable {
  let presentedItemURL: URL?
  let presentedItemOperationQueue: OperationQueue
  var onChange: (@MainActor (URL?) -> Void)?

  init(rootURL: URL) {
    self.presentedItemURL = rootURL
    self.presentedItemOperationQueue = OperationQueue()
    presentedItemOperationQueue.maxConcurrentOperationCount = 1
    presentedItemOperationQueue.qualityOfService = .utility
  }

  func presentedItemDidChange() {
    notify(nil)
  }

  func presentedSubitemDidAppear(at url: URL) {
    notify(url)
  }

  func presentedSubitemDidChange(at url: URL) {
    notify(url)
  }

  func presentedSubitem(at oldURL: URL, didMoveTo newURL: URL) {
    notify(oldURL.deletingLastPathComponent())
  }

  func accommodatePresentedSubitemDeletion(
    at url: URL,
    completionHandler: @escaping @Sendable (Error?) -> Void
  ) {
    notify(url)
    completionHandler(nil)
  }

  private func notify(_ url: URL?) {
    Task { @MainActor [weak self] in
      self?.onChange?(url)
    }
  }
}
