//
//  EditorHistoryStorage.swift
//  MarkEditMac
//
//  Created by cyan on 4/17/26.
//

import Foundation
import MarkEditCore

@MainActor
enum EditorHistory {
  struct Activity: Codable, Identifiable, Equatable {
    enum Kind: String, Codable {
      case opened
      case edited
      case saved
      case renamed
    }

    let id: UUID
    var path: String
    var title: String
    var kind: Kind
    var timestamp: Date
    var count: Int
  }

  struct ClosedTab: Codable {
    let bookmark: Data
    let tabIndex: Int?
    let wasStandalone: Bool?
  }

  struct SelectionRangeEntry: Codable {
    let selectionRange: SelectionRange
    let fileSize: Int
    let lastAccessed: Date

    init(_ selectionRange: SelectionRange, fileSize: Int) {
      self.selectionRange = selectionRange
      self.fileSize = fileSize
      self.lastAccessed = .now
    }
  }

  @Storage(key: "editor-history.closed-tabs", defaultValue: [])
  static var closedTabs: [ClosedTab]

  @Storage(key: "editor-history.selection-ranges", defaultValue: [:])
  static var selectionRanges: [String: SelectionRangeEntry]

  @Storage(key: "editor-history.activity", defaultValue: [])
  static var activity: [Activity]
}

@MainActor
final class ActivityHistoryStore {
  static let shared = ActivityHistoryStore()

  private let maximumEntries = 5_000
  private let retentionInterval: TimeInterval = 90 * 24 * 60 * 60
  private let coalescingInterval: TimeInterval = 5 * 60
  private var pendingEdits = [String: Task<Void, Never>]()

  private init() {
    purge()
  }

  func record(_ kind: EditorHistory.Activity.Kind, url: URL) {
    let path = url.standardizedFileURL.path
    let now = Date.now
    var entries = EditorHistory.activity.filter {
      now.timeIntervalSince($0.timestamp) <= retentionInterval
    }

    if let index = entries.firstIndex(where: {
      $0.path == path && $0.kind == kind && now.timeIntervalSince($0.timestamp) <= coalescingInterval
    }) {
      var entry = entries.remove(at: index)
      entry.timestamp = now
      entry.title = url.lastPathComponent
      entry.count += 1
      entries.insert(entry, at: 0)
    } else {
      entries.insert(EditorHistory.Activity(
        id: UUID(),
        path: path,
        title: url.lastPathComponent,
        kind: kind,
        timestamp: now,
        count: 1
      ), at: 0)
    }

    EditorHistory.activity = Array(entries.prefix(maximumEntries))
  }

  func scheduleEdit(url: URL?) {
    guard let url else { return }
    let path = url.standardizedFileURL.path
    pendingEdits[path]?.cancel()
    pendingEdits[path] = Task { @MainActor [weak self] in
      try? await Task.sleep(for: .seconds(2))
      guard let self, !Task.isCancelled else { return }
      self.pendingEdits[path] = nil
      self.record(.edited, url: url)
    }
  }

  func entries(limit: Int = 200) -> [EditorHistory.Activity] {
    purge()
    return Array(EditorHistory.activity.prefix(max(0, limit)))
  }

  func recentDocuments(limit: Int = 20) -> [EditorHistory.Activity] {
    var seen = Set<String>()
    let documents = entries(limit: maximumEntries)
      .filter { entry in
        guard !seen.contains(entry.path) else { return false }
        seen.insert(entry.path)
        return FileManager.default.fileExists(atPath: entry.path)
      }
    return Array(documents.prefix(limit))
  }

  func clear() {
    pendingEdits.values.forEach { $0.cancel() }
    pendingEdits.removeAll()
    EditorHistory.activity = []
  }

  func purge() {
    let cutoff = Date.now.addingTimeInterval(-retentionInterval)
    EditorHistory.activity = Array(
      EditorHistory.activity.filter { $0.timestamp >= cutoff }.prefix(maximumEntries)
    )
  }
}
