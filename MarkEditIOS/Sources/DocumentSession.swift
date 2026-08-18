import Foundation
import KMDIOSCore
import MarkEditKit
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class DocumentSession: ObservableObject {
  @Published private(set) var text = ""
  @Published private(set) var displayName = String(localized: "Untitled")
  @Published private(set) var fileURL: URL?
  @Published private(set) var isDirty = false
  @Published private(set) var outline = MarkdownOutlineParser.parse("")
  @Published private(set) var pendingShares: [SharedInboxEnvelope] = []
  @Published private(set) var hasRestored = false
  @Published var showsPreview = true
  @Published var showsInbox = false
  @Published var presentedError: PresentedError?
  @Published var exportRequest: MarkdownExportRequest?

  private(set) var editorGeneration = 0
  private var outlineTask: Task<Void, Never>?
  private var draftTask: Task<Void, Never>?
  private var securityScopedURL: URL?

  private lazy var draftRepository = DraftRepository(rootURL: Self.draftRootURL)
  private lazy var inboxRepository = SharedInboxRepository(rootURL: Self.inboxRootURL)

  deinit {
    securityScopedURL?.stopAccessingSecurityScopedResource()
  }

  func restoreDraftAndInbox() async {
    defer { hasRestored = true }
    do {
      if let draft = try await draftRepository.load(), text.isEmpty {
        text = draft.text
        displayName = draft.displayName
        isDirty = !draft.text.isEmpty
        editorGeneration &+= 1
        refreshOutline(immediately: true)
      }
      pendingShares = try await inboxRepository.pending()
    } catch {
      show(error)
    }
  }

  func newDocument() {
    releaseSecurityScope()
    text = ""
    fileURL = nil
    displayName = String(localized: "Untitled")
    isDirty = false
    editorGeneration &+= 1
    refreshOutline(immediately: true)
    scheduleDraftSave()
  }

  func open(_ url: URL) async {
    let didAccess = url.startAccessingSecurityScopedResource()
    do {
      let data = try Data(contentsOf: url, options: .mappedIfSafe)
      guard let source = String(data: data, encoding: .utf8) else {
        throw CocoaError(.fileReadInapplicableStringEncoding)
      }
      releaseSecurityScope()
      securityScopedURL = didAccess ? url : nil
      text = source
      fileURL = url
      displayName = url.lastPathComponent
      isDirty = false
      editorGeneration &+= 1
      refreshOutline(immediately: true)
      scheduleDraftSave()
    } catch {
      if didAccess { url.stopAccessingSecurityScopedResource() }
      show(error)
    }
  }

  func applyEditorChanges(_ changes: [EditorTextChange]) {
    guard !changes.isEmpty else { return }
    let value = NSMutableString(string: text)
    for change in changes.sorted(by: { $0.from > $1.from }) {
      let range = NSRange(location: change.from, length: change.to - change.from)
      guard range.location >= 0, range.length >= 0, NSMaxRange(range) <= value.length else {
        return
      }
      value.replaceCharacters(in: range, with: change.insert)
    }
    text = value as String
    isDirty = true
    scheduleOutlineRefresh()
    scheduleDraftSave()
  }

  func replaceTextFromOutside(_ newText: String, suggestedName: String? = nil) {
    text = newText
    if let suggestedName, !suggestedName.isEmpty { displayName = suggestedName }
    isDirty = true
    editorGeneration &+= 1
    refreshOutline(immediately: true)
    scheduleDraftSave()
  }

  func save() async -> Bool {
    guard let fileURL else {
      exportRequest = MarkdownExportRequest(text: text, filename: suggestedFilename)
      return false
    }

    do {
      let data = Data(text.utf8)
      var coordinatorError: NSError?
      var writeError: Error?
      NSFileCoordinator().coordinate(
        writingItemAt: fileURL,
        options: .forReplacing,
        error: &coordinatorError
      ) { coordinatedURL in
        do {
          try data.write(to: coordinatedURL, options: [.atomic, .completeFileProtection])
        } catch {
          writeError = error
        }
      }
      if let error = coordinatorError ?? writeError as NSError? { throw error }
      isDirty = false
      scheduleDraftSave()
      return true
    } catch {
      show(error)
      return false
    }
  }

  func didExport(to url: URL) async {
    await open(url)
  }

  func importShare(_ envelope: SharedInboxEnvelope) async {
    let separator = text.isEmpty || text.hasSuffix("\n") ? "" : "\n\n"
    replaceTextFromOutside(text + separator + envelope.text)
    do {
      try await inboxRepository.archive(id: envelope.id)
      pendingShares = try await inboxRepository.pending()
    } catch {
      show(error)
    }
  }

  func gotoHeading(_ heading: MarkdownHeading) {
    NotificationCenter.default.post(
      name: .kmdGotoEditorPosition,
      object: nil,
      userInfo: ["position": heading.startUTF16]
    )
  }

  private func scheduleOutlineRefresh() {
    outlineTask?.cancel()
    outlineTask = Task { @MainActor [weak self] in
      try? await Task.sleep(for: .milliseconds(120))
      guard !Task.isCancelled else { return }
      self?.refreshOutline(immediately: true)
    }
  }

  private func refreshOutline(immediately: Bool) {
    outline = MarkdownOutlineParser.parse(text)
  }

  private func scheduleDraftSave() {
    draftTask?.cancel()
    let snapshot = MarkdownDraftSnapshot(
      text: text,
      displayName: displayName,
      sourcePath: fileURL?.path
    )
    draftTask = Task { [draftRepository] in
      try? await Task.sleep(for: .milliseconds(500))
      guard !Task.isCancelled else { return }
      try? await draftRepository.save(snapshot)
    }
  }

  private func releaseSecurityScope() {
    securityScopedURL?.stopAccessingSecurityScopedResource()
    securityScopedURL = nil
  }

  private func show(_ error: Error) {
    presentedError = PresentedError(message: error.localizedDescription)
  }

  private var suggestedFilename: String {
    let firstHeading = outline.headings.first?.title
      .replacingOccurrences(of: "/", with: "-")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return (firstHeading?.isEmpty == false ? firstHeading! : String(localized: "Untitled")) + ".md"
  }

  private static var draftRootURL: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appending(path: "KMD/Drafts", directoryHint: .isDirectory)
  }

  private static var inboxRootURL: URL {
    let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
    ) ?? draftRootURL.deletingLastPathComponent()
    return container.appending(path: "SharedInbox", directoryHint: .isDirectory)
  }
}

struct PresentedError: Identifiable {
  let id = UUID()
  let message: String
}

struct MarkdownExportRequest: Identifiable {
  let id = UUID()
  let text: String
  let filename: String
}

struct MarkdownFileDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.kmdMarkdown, .plainText] }
  var text: String

  init(text: String) {
    self.text = text
  }

  init(configuration: ReadConfiguration) throws {
    guard let data = configuration.file.regularFileContents,
          let text = String(data: data, encoding: .utf8) else {
      throw CocoaError(.fileReadCorruptFile)
    }
    self.text = text
  }

  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
    FileWrapper(regularFileWithContents: Data(text.utf8))
  }
}

extension Notification.Name {
  static let kmdGotoEditorPosition = Notification.Name("art.apuch.kmd.goto-editor-position")
}

extension UTType {
  static let kmdMarkdown = UTType(importedAs: "net.daringfireball.markdown")
}
