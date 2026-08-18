import KMDIOSCore
import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @EnvironmentObject private var session: DocumentSession
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @State private var importsDocument = false
  @State private var selectedPane: CompactPane = .editor
  @State private var showsCompactOutline = false

  var body: some View {
    Group {
      if horizontalSizeClass == .compact {
        NavigationStack {
          documentView
        }
      } else {
        NavigationSplitView {
          OutlineSidebar()
            .navigationTitle("Outline")
        } detail: {
          documentView
        }
      }
    }
    .fileImporter(
      isPresented: $importsDocument,
      allowedContentTypes: [.kmdMarkdown, .plainText],
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
      contentType: .kmdMarkdown,
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
    .sheet(isPresented: $showsCompactOutline) {
      NavigationStack {
        OutlineSidebar()
          .navigationTitle("Outline")
          .toolbar {
            ToolbarItem(placement: .confirmationAction) {
              Button("Done") { showsCompactOutline = false }
            }
          }
      }
      .environmentObject(session)
    }
    .alert(item: $session.presentedError) { error in
      Alert(title: Text("Unable to complete the action"), message: Text(error.message))
    }
  }

  private var documentView: some View {
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
        if !session.hasRestored {
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if selectedPane == .editor || !session.showsPreview {
          EditorHostView(session: session)
        } else {
          MarkdownPreview(text: session.text)
        }
      } else {
        HStack(spacing: 0) {
          if session.hasRestored {
            EditorHostView(session: session)
          } else {
            ProgressView()
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
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

  @ToolbarContentBuilder
  private var toolbarContent: some ToolbarContent {
    ToolbarItemGroup(placement: .topBarLeading) {
      if horizontalSizeClass == .compact {
        Button("Outline", systemImage: "list.bullet.indent") { showsCompactOutline = true }
      }
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
        LazyVStack(alignment: .leading, spacing: 14) {
          ForEach(MarkdownPreviewBlock.parse(text)) { block in
            preview(block)
          }
        }
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
      }
    }
    .background(Color(uiColor: .secondarySystemBackground))
  }

  @ViewBuilder
  private func preview(_ block: MarkdownPreviewBlock) -> some View {
    switch block.kind {
    case .heading(let level, let source):
      inlineText(source)
        .font(headingFont(level))
        .fontWeight(level <= 2 ? .bold : .semibold)
        .padding(.top, level == 1 ? 6 : 2)
    case .paragraph(let source):
      inlineText(source)
        .font(.body)
    case .unordered(let source):
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text("•")
        inlineText(source)
      }
      .font(.body)
      .padding(.leading, 8)
    case .ordered(let number, let source):
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text("\(number).")
          .foregroundStyle(.secondary)
        inlineText(source)
      }
      .font(.body)
      .padding(.leading, 8)
    case .quote(let source):
      HStack(alignment: .top, spacing: 10) {
        RoundedRectangle(cornerRadius: 2)
          .fill(.tertiary)
          .frame(width: 4)
        inlineText(source)
          .foregroundStyle(.secondary)
      }
    case .code(let source):
      ScrollView(.horizontal) {
        Text(source)
          .font(.system(.callout, design: .monospaced))
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(12)
      }
      .background(.background.opacity(0.75), in: RoundedRectangle(cornerRadius: 10))
    case .rule:
      Divider()
    }
  }

  private func inlineText(_ source: String) -> Text {
    let rendered = (try? AttributedString(
      markdown: source,
      options: .init(interpretedSyntax: .full, failurePolicy: .returnPartiallyParsedIfPossible)
    )) ?? AttributedString(source)
    return Text(rendered)
  }

  private func headingFont(_ level: Int) -> Font {
    switch level {
    case 1: .largeTitle
    case 2: .title2
    case 3: .title3
    default: .headline
    }
  }
}

private struct MarkdownPreviewBlock: Identifiable {
  enum Kind {
    case heading(Int, String)
    case paragraph(String)
    case unordered(String)
    case ordered(Int, String)
    case quote(String)
    case code(String)
    case rule
  }

  let id: Int
  let kind: Kind

  static func parse(_ source: String) -> [Self] {
    let lines = source.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var blocks: [Self] = []
    var paragraph: [String] = []
    var code: [String] = []
    var isCode = false

    func append(_ kind: Kind) {
      blocks.append(Self(id: blocks.count, kind: kind))
    }
    func flushParagraph() {
      guard !paragraph.isEmpty else { return }
      append(.paragraph(paragraph.joined(separator: " ")))
      paragraph.removeAll(keepingCapacity: true)
    }

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") {
        flushParagraph()
        if isCode {
          append(.code(code.joined(separator: "\n")))
          code.removeAll(keepingCapacity: true)
        }
        isCode.toggle()
        continue
      }
      if isCode {
        code.append(line)
        continue
      }
      if trimmed.isEmpty {
        flushParagraph()
        continue
      }

      if let heading = heading(in: trimmed) {
        flushParagraph()
        append(.heading(heading.level, heading.text))
      } else if trimmed == "---" || trimmed == "***" || trimmed == "___" {
        flushParagraph()
        append(.rule)
      } else if let item = unorderedItem(in: trimmed) {
        flushParagraph()
        append(.unordered(item))
      } else if let item = orderedItem(in: trimmed) {
        flushParagraph()
        append(.ordered(item.number, item.text))
      } else if trimmed.hasPrefix(">") {
        flushParagraph()
        append(.quote(String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces)))
      } else {
        paragraph.append(trimmed)
      }
    }
    flushParagraph()
    if isCode, !code.isEmpty { append(.code(code.joined(separator: "\n"))) }
    return blocks
  }

  private static func heading(in line: String) -> (level: Int, text: String)? {
    let level = line.prefix(while: { $0 == "#" }).count
    guard (1...6).contains(level), line.dropFirst(level).first == " " else { return nil }
    return (level, String(line.dropFirst(level + 1)))
  }

  private static func unorderedItem(in line: String) -> String? {
    guard line.count > 2, ["- ", "* ", "+ "].contains(String(line.prefix(2))) else { return nil }
    return String(line.dropFirst(2))
  }

  private static func orderedItem(in line: String) -> (number: Int, text: String)? {
    let digits = line.prefix(while: { $0.isNumber })
    guard !digits.isEmpty,
          let number = Int(digits),
          line.dropFirst(digits.count).hasPrefix(". ") else { return nil }
    return (number, String(line.dropFirst(digits.count + 2)))
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
