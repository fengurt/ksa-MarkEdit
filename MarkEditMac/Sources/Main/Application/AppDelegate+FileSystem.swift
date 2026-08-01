//
//  AppDelegate+FileSystem.swift
//  MarkEditMac
//
//  Created by cyan on 4/30/24.
//

import AppKit
import MarkEditKit
import ResourceCore

extension AppDelegate {
  func configureResourceMenu() {
    guard let mainFileMenu,
          !mainFileMenu.items.contains(where: { $0.action == #selector(openResource(_:)) }) else {
      return
    }
    let item = NSMenuItem(
      title: Localized.Resource.openResource,
      action: #selector(openResource(_:)),
      keyEquivalent: "o"
    )
    item.keyEquivalentModifierMask = [.command, .option]
    item.target = self
    let openIndex = mainFileMenu.items.firstIndex {
      $0.action == #selector(NSDocumentController.openDocument(_:))
    }
    mainFileMenu.insertItem(item, at: min((openIndex ?? 1) + 1, mainFileMenu.items.count))
  }

  @IBAction func openResource(_ sender: Any?) {
    let tabbingWindow = NSApp.keyWindow
    let openPanel = NSOpenPanel()
    openPanel.prompt = Localized.Resource.open
    openPanel.message = Localized.Resource.openDescription
    openPanel.canChooseDirectories = true
    openPanel.canChooseFiles = true
    openPanel.allowsMultipleSelection = false
    openPanel.resolvesAliases = false

    Task {
      guard await openPanel.begin() == .OK, let url = openPanel.url else {
        return
      }
      do {
        try await resourceModuleHost.open(url, tabbingWindow: tabbingWindow)
      } catch {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = Localized.Resource.openFailed
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: Localized.General.done)
        if let window = NSApp.keyWindow {
          await alert.beginSheetModal(for: window)
        } else {
          alert.runModal()
        }
      }
    }
  }

  func confirmResourceModuleInstallation(_ entry: ResourceModuleCatalogEntryV1) async -> Bool {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    let alert = NSAlert()
    alert.alertStyle = .informational
    alert.messageText = Localized.Resource.installModule
    alert.informativeText = String(
      format: Localized.Resource.installModuleDescription,
      locale: .current,
      entry.displayName,
      entry.version,
      formatter.string(fromByteCount: Int64(entry.downloadBytes))
    )
    alert.addButton(withTitle: Localized.Resource.install)
    alert.addButton(withTitle: Localized.General.cancel)
    let response: NSApplication.ModalResponse
    if let window = NSApp.keyWindow {
      response = await alert.beginSheetModal(for: window)
    } else {
      response = alert.runModal()
    }
    return response == .alertFirstButtonReturn
  }

  func saveGrantedFolderAsBookmark() async {
    let openPanel = NSOpenPanel()
    openPanel.prompt = Localized.General.grantAccess
    openPanel.canChooseDirectories = true
    openPanel.canChooseFiles = false
    openPanel.allowsMultipleSelection = false

    guard await openPanel.begin() == .OK, let url = openPanel.url else {
      return
    }

    guard let newBookmark = try? url.bookmarkData(
      options: .withSecurityScope,
      includingResourceValuesForKeys: nil,
      relativeTo: nil
    ) else {
      return Logger.log(.error, "Failed to create bookmark data")
    }

    let bookmarkData = AppPreferences.General.grantedFolderBookmark
    let bookmarkList: [Data] = {
      if let dataArray = bookmarkData?.decodeToDataArray() {
        return dataArray
      }

      if let bookmarkData {
        return [bookmarkData]
      }

      return []
    }()

    let encodedData = bookmarkList.appendingData(newBookmark).encodeToData()
    AppPreferences.General.grantedFolderBookmark = encodedData
  }

  func startAccessingGrantedFolder() {
    guard let bookmarkData = AppPreferences.General.grantedFolderBookmark else {
      return
    }

    if let bookmarkList = bookmarkData.decodeToDataArray() {
      bookmarkList.forEach {
        startAccessingBookmarkData($0)
      }
    } else {
      startAccessingBookmarkData(bookmarkData)
    }
  }
}

// MARK: - Private

private extension AppDelegate {
  func startAccessingBookmarkData(_ bookmarkData: Data) {
    do {
      var isStale = false
      let bookmarkURL = try URL(
        resolvingBookmarkData: bookmarkData,
        options: .withSecurityScope,
        relativeTo: nil,
        bookmarkDataIsStale: &isStale
      )

      if !bookmarkURL.startAccessingSecurityScopedResource() {
        Logger.log(.error, "Failed to start accessing security scoped resource")
      }
    } catch {
      Logger.log(.error, "Failed to resolve bookmark data")
    }
  }
}
