//
//  URL+Extension.swift
//
//  Created by cyan on 12/23/25.
//

import Foundation

public extension URL {
  /// The sandbox maps Documents into the app container. Ad-hoc development builds are not
  /// sandboxed, so use an isolated Application Support directory instead of scanning the
  /// user's real Documents folder.
  static var appDocumentsDirectory: URL {
    guard Bundle.main.bundleIdentifier?.hasSuffix(".dev") == true else { return .documentsDirectory }
    return .applicationSupportDirectory
      .appending(path: "kmd Development", directoryHint: .isDirectory)
      .appending(path: "Documents", directoryHint: .isDirectory)
  }

  static var standardDirectories: [String: String] {
    [
      "home": Self.homeDirectory,
      "documents": Self.documentsDirectory,
      "library": Self.libraryDirectory,
      "caches": Self.cachesDirectory,
      "temporary": Self.temporaryDirectory,
      "sharedContainer": Self.sharedContainerURL,
    ].compactMapValues {
      $0?.path(percentEncoded: false)
    }
  }

  static var sharedContainerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint.markedit")
  }

  /// Files in this directory whose extension is in `types`, sorted by localized filename order.
  func sortedFiles(types: Set<String>) -> [URL] {
    let files = (try? FileManager.default.contentsOfDirectory(
      at: self,
      includingPropertiesForKeys: nil
    )) ?? []

    return files
      .filter { types.contains($0.pathExtension.lowercased()) }
      .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
  }
}
