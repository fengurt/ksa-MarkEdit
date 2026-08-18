import KMDIOSCore
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @EnvironmentObject private var session: DocumentSession
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @State private var importsDocument = false
  @State private var selectedPane: CompactPane = .editor

  var body: some View {
    NavigationSplitView {
      OutlineSidebar()
        .navigationTitle("Outline")
    } detail: {
      VStack(spacing: 0) {
        if horizontalSizeClass == .compact, session.showsPreview {
          Picker("View", selection: $selectedPane) {
            Text("Editor").tag(CompactPane.editor)
            Text("Preview").tag(CompactPane.preview)
          }
          .pickerStyle(.segmented)
          .padding(.horizontal)
          .padding(.vertical, 8)
        }

        if horizontalSizeClass == .compact {
          if selectedPane == .editor || !session.showsPreview {
            EditorHostView(session: session)
          } else {
            MarkdownPreview(text: session.text)
          }
        } else {
          HStack(spacing: 0) {
            EditorHostView(session: session)
            if session.showsPreview {
              Divider()
              MarkdownPreview(text: session.text)
                .frame(minWidth: 280, idealWidth: 390)
            }
          }
        }
      }
      .navigationTitle(session.displayName)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { toolbarContent }
    }
    .fileImporter(
      isPresented: $importsDocument,
      allowedContentTypes: [.markdown, .plainText],
      allowsMultipleSelection: false
    ) { result in
      guard case .success(let urls) = result, let url = urls.first else {
        if case .failure(let error) = result { session.presentedError = .init(message: error.localizedDescription) }
        return
      }
      Task { await session.open(url) }
    }
    .fileExporter(
      isPresented: Binding(
        get: { session.exportRequest != nil },
        set: { if !$0 { session.exportRequest = nil } }
      ),
      document: session.exportRequest.map { MarkdownFileDocument(text: $0.text) },
      contentType: .markdown,
      defaultFilename: session.exportRequest?.filename ?? "Untitled.md"
    ) { result in
      guard case .success(let url) = result else {
        if case .failure(let error) = result { session.presentedError = .init(message: error.localizedDescription) }
        return
      }
      Task { await session.didExport(to: url) }
    }
    .sheet(isPresented: $session.showsInbox) {
      SharedInboxView()
        .environmentObject(session)
    }
    .alert(item: $session.presentedError) { error in
      Alert(title: Text("Unable to complete the action"), message: Text(error.message))
    }
  }

  @ToolbarContentBuilder
  private var toolbarContent: some ToolbarContent {
    ToolbarItemGroup(placement: .topBarLeading) {
      Button("New", systemImage: "square.and.pencil") { session.newDocument() }
      Button("Open", systemImage: "folder") { importsDocument = true }
    }
    ToolbarItemGroup(placement: .topBarTrailing) {
      Button("Inbox", systemImage: "tray") { session.showsInbox = true }
        .overlay(alignment: .topTrailing) {
          if !session.pendingShares.isEmpty {
            Text("\(min(session.pendingShares.count, 99))")
              .font(.caption2.bold())
              .foregroundStyle(.white)
              .padding(3)
              .background(.red, in: Circle())
              .offset(x: 7, y: -7)
          }
        }
      Button("Preview", systemImage: session.showsPreview ? "eye.slash" : "eye") {
        session.showsPreview.toggle()
      }
      Button("Save", systemImage: "square.and.arrow.down") {
        Task { _ = await session.save() }
      }
    }
  }
}

private enum CompactPane: Hashable {
  case editor
  case preview
}

private struct OutlineSidebar: View {
  @EnvironmentObject private var session: DocumentSession

  var body: some View {
    List {
      Section {
        LabeledContent("Words", value: session.outline.totalWordCount.formatted())
        LabeledContent("Sections", value: session.outline.headings.count.formatted())
      }
      Section("Document structure") {
        if session.outline.headings.isEmpty {
          ContentUnavailableView(
            "No headings yet",
            systemImage: "list.bullet.indent",
            description: Text("Add Markdown headings to build the live outline.")
          )
        } else {
          ForEach(session.outline.headings) { heading in
            Button {
              session.gotoHeading(heading)
            } label: {
              VStack(alignment: .leading, spacing: 4) {
                Text(heading.title)
                  .font(.body.weight(heading.level == 1 ? .semibold : .regular))
                  .lineLimit(2)
                HStack(spacing: 6) {
                  Text("H\(heading.level)")
                  Text("\(heading.contentWordCount) words")
                  Text(heading.documentRatio, format: .percent.precision(.fractionLength(1)))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
              }
              .padding(.leading, CGFloat(max(0, heading.level - 1)) * 12)
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
  }
}

private struct MarkdownPreview: View {
  let text: String

  var body: some View {
    ScrollView {
      if text.isEmpty {
        ContentUnavailableView(
          "Preview",
          systemImage: "doc.richtext",
          description: Text("Start writing to see the rendered document.")
        )
        .frame(maxWidth: .infinity, minHeight: 260)
      } else {
        Text(renderedText)
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(20)
      }
    }
    .background(Color(uiColor: .secondarySystemBackground))
  }

  private var renderedText: AttributedString {
    (try? AttributedString(
      markdown: text,
      options: .init(interpretedSyntax: .full, failurePolicy: .returnPartiallyParsedIfPossible)
    )) ?? AttributedString(text)
  }
}

private struct SharedInboxView: View {
  @EnvironmentObject private var session: DocumentSession
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      List(session.pendingShares) { envelope in
        Button {
          Task {
            await session.importShare(envelope)
            if session.pendingShares.isEmpty { dismiss() }
          }
        } label: {
          VStack(alignment: .leading, spacing: 6) {
            Text(envelope.text)
              .lineLimit(4)
              .foregroundStyle(.primary)
            HStack {
              Text(envelope.kind.rawValue.uppercased())
              Spacer()
              Text(envelope.createdAt, style: .relative)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
          }
        }
      }
      .overlay {
        if session.pendingShares.isEmpty {
          ContentUnavailableView("Inbox is empty", systemImage: "tray")
        }
      }
      .navigationTitle("Shared with kmd")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }
        }
      }
    }
  }
}

