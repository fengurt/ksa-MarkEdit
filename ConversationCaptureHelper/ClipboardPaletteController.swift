import AppKit
import ApplicationServices
import Carbon.HIToolbox

@MainActor
final class ClipboardPaletteController: NSObject {
  typealias CommitHandler = (ClipboardHistoryItem, NSRunningApplication?) -> Void

  private let store: ClipboardHistoryStore
  private let onCommit: CommitHandler
  private let onDismiss: () -> Void
  private let panel = NSPanel(
    contentRect: NSRect(x: 0, y: 0, width: 520, height: 390),
    styleMask: [.titled, .fullSizeContentView],
    backing: .buffered,
    defer: false
  )
  private let searchField = NSSearchField()
  private let categoryControl = NSSegmentedControl(
    labels: [
      String(localized: "Recent"),
      String(localized: "Text"),
      String(localized: "Links"),
      String(localized: "Code"),
      String(localized: "Files"),
    ],
    trackingMode: .selectOne,
    target: nil,
    action: nil
  )
  private let tableView = NSTableView()
  private let scrollView = NSScrollView()
  private let hintLabel = NSTextField(labelWithString: "")
  private var filteredItems = [ClipboardHistoryItem]()
  private var previousApplication: NSRunningApplication?
  private var eventMonitor: Any?

  init(
    store: ClipboardHistoryStore,
    onCommit: @escaping CommitHandler,
    onDismiss: @escaping () -> Void
  ) {
    self.store = store
    self.onCommit = onCommit
    self.onDismiss = onDismiss
    super.init()
    setUp()
  }

  var isVisible: Bool { panel.isVisible }

  func toggle() {
    if panel.isVisible {
      close()
    } else {
      show()
    }
  }

  func reload() {
    applyFilter()
  }

  func close() {
    panel.orderOut(nil)
    removeEventMonitor()
    previousApplication?.activate(options: [.activateAllWindows])
    onDismiss()
  }
}

private extension ClipboardPaletteController {
  func setUp() {
    panel.title = String(localized: "Clipboard History")
    panel.titleVisibility = .hidden
    panel.titlebarAppearsTransparent = true
    panel.isMovableByWindowBackground = true
    panel.isReleasedWhenClosed = false
    panel.hidesOnDeactivate = false
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    panel.backgroundColor = .windowBackgroundColor
    panel.delegate = self

    searchField.placeholderString = String(localized: "Search recent clipboard content")
    searchField.delegate = self

    categoryControl.selectedSegment = 0
    categoryControl.target = self
    categoryControl.action = #selector(categoryChanged(_:))
    categoryControl.segmentStyle = .rounded

    let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ClipboardItem"))
    column.resizingMask = .autoresizingMask
    tableView.addTableColumn(column)
    tableView.headerView = nil
    tableView.rowHeight = 58
    tableView.intercellSpacing = NSSize(width: 0, height: 1)
    tableView.dataSource = self
    tableView.delegate = self
    tableView.target = self
    tableView.doubleAction = #selector(commitSelection)
    tableView.setAccessibilityLabel(String(localized: "Recent clipboard content"))

    scrollView.documentView = tableView
    scrollView.hasVerticalScroller = true
    scrollView.drawsBackground = false

    hintLabel.stringValue = accessibilityTrusted
      ? String(localized: "↑↓ Select · Return Paste · Esc Close")
      : String(localized: "↑↓ Select · Return Copy · Esc Close")
    hintLabel.font = .systemFont(ofSize: 10)
    hintLabel.textColor = .tertiaryLabelColor
    hintLabel.alignment = .center

    let contentView = NSView()
    panel.contentView = contentView
    [searchField, categoryControl, scrollView, hintLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      contentView.addSubview($0)
    }
    NSLayoutConstraint.activate([
      searchField.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 18),
      searchField.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      searchField.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

      categoryControl.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 10),
      categoryControl.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
      categoryControl.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

      scrollView.topAnchor.constraint(equalTo: categoryControl.bottomAnchor, constant: 10),
      scrollView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: hintLabel.topAnchor, constant: -6),

      hintLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 12),
      hintLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -12),
      hintLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
      hintLabel.heightAnchor.constraint(equalToConstant: 16),
    ])
    applyFilter()
  }

  func show() {
    let helperBundleID = Bundle.main.bundleIdentifier
    let frontmost = NSWorkspace.shared.frontmostApplication
    previousApplication = frontmost?.bundleIdentifier == helperBundleID ? nil : frontmost
    searchField.stringValue = ""
    categoryControl.selectedSegment = 0
    updateHint()
    applyFilter()
    positionPanel()
    installEventMonitor()
    panel.makeKeyAndOrderFront(nil)
    panel.orderFrontRegardless()
    NSRunningApplication(
      processIdentifier: ProcessInfo.processInfo.processIdentifier
    )?.activate(options: [.activateAllWindows])
    panel.makeKey()
    panel.makeFirstResponder(searchField)
  }

  func updateHint() {
    hintLabel.stringValue = accessibilityTrusted
      ? String(localized: "↑↓ Select · Return Paste · Esc Close")
      : String(localized: "↑↓ Select · Return Copy · Esc Close")
  }

  func positionPanel() {
    let mouseLocation = NSEvent.mouseLocation
    let screen = NSScreen.screens.first { $0.frame.contains(mouseLocation) } ?? NSScreen.main
    guard let visibleFrame = screen?.visibleFrame else {
      panel.center()
      return
    }
    let origin = NSPoint(
      x: min(max(mouseLocation.x - panel.frame.width / 2, visibleFrame.minX), visibleFrame.maxX - panel.frame.width),
      y: min(max(mouseLocation.y - panel.frame.height / 2, visibleFrame.minY), visibleFrame.maxY - panel.frame.height)
    )
    panel.setFrameOrigin(origin)
  }

  func installEventMonitor() {
    removeEventMonitor()
    eventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
      guard let self else { return event }
      switch event.keyCode {
      case UInt16(kVK_UpArrow):
        moveSelection(by: -1)
        return nil
      case UInt16(kVK_DownArrow):
        moveSelection(by: 1)
        return nil
      case UInt16(kVK_Return), UInt16(kVK_ANSI_KeypadEnter):
        commitSelection()
        return nil
      case UInt16(kVK_Escape):
        close()
        return nil
      default:
        return event
      }
    }
  }

  func removeEventMonitor() {
    if let eventMonitor {
      NSEvent.removeMonitor(eventMonitor)
      self.eventMonitor = nil
    }
  }

  func moveSelection(by offset: Int) {
    guard !filteredItems.isEmpty else { return }
    let current = tableView.selectedRow < 0 ? 0 : tableView.selectedRow
    let next = min(max(current + offset, 0), filteredItems.count - 1)
    tableView.selectRowIndexes(IndexSet(integer: next), byExtendingSelection: false)
    tableView.scrollRowToVisible(next)
  }

  @objc func commitSelection() {
    guard filteredItems.indices.contains(tableView.selectedRow) else { return }
    let item = filteredItems[tableView.selectedRow]
    panel.orderOut(nil)
    removeEventMonitor()
    onCommit(item, previousApplication)
    onDismiss()
  }

  @objc func categoryChanged(_ sender: NSSegmentedControl) {
    applyFilter()
  }

  func applyFilter() {
    let category: ClipboardContentCategory? = switch categoryControl.selectedSegment {
    case 1: .text
    case 2: .link
    case 3: .code
    case 4: .file
    default: nil
    }
    let query = searchField.stringValue
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .precomposedStringWithCompatibilityMapping
    filteredItems = store.items.filter { item in
      (category == nil || item.category == category)
        && (query.isEmpty || item.content.localizedStandardContains(query))
    }
    tableView.reloadData()
    if !filteredItems.isEmpty {
      tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
    }
  }

  var accessibilityTrusted: Bool {
    AXIsProcessTrusted()
  }
}

extension ClipboardPaletteController: NSWindowDelegate {
  func windowWillClose(_ notification: Notification) {
    removeEventMonitor()
    onDismiss()
  }
}

extension ClipboardPaletteController: NSSearchFieldDelegate {
  func controlTextDidChange(_ obj: Notification) {
    applyFilter()
  }
}

extension ClipboardPaletteController: NSTableViewDataSource, NSTableViewDelegate {
  func numberOfRows(in tableView: NSTableView) -> Int {
    filteredItems.count
  }

  func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
    guard filteredItems.indices.contains(row) else { return nil }
    let identifier = NSUserInterfaceItemIdentifier("ClipboardHistoryCell")
    let cell = (tableView.makeView(withIdentifier: identifier, owner: nil) as? ClipboardHistoryCellView)
      ?? ClipboardHistoryCellView()
    cell.identifier = identifier
    cell.configure(with: filteredItems[row])
    return cell
  }
}

@MainActor
private final class ClipboardHistoryCellView: NSTableCellView {
  private let iconView = NSImageView()
  private let contentLabel = NSTextField(labelWithString: "")
  private let metadataLabel = NSTextField(labelWithString: "")

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    iconView.contentTintColor = .secondaryLabelColor
    contentLabel.font = .systemFont(ofSize: 13, weight: .medium)
    contentLabel.lineBreakMode = .byTruncatingTail
    metadataLabel.font = .systemFont(ofSize: 10)
    metadataLabel.textColor = .tertiaryLabelColor
    metadataLabel.lineBreakMode = .byTruncatingTail

    [iconView, contentLabel, metadataLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }
    textField = contentLabel
    NSLayoutConstraint.activate([
      iconView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
      iconView.centerYAnchor.constraint(equalTo: centerYAnchor),
      iconView.widthAnchor.constraint(equalToConstant: 18),
      iconView.heightAnchor.constraint(equalToConstant: 18),

      contentLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      contentLabel.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 10),
      contentLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),

      metadataLabel.topAnchor.constraint(equalTo: contentLabel.bottomAnchor, constant: 5),
      metadataLabel.leadingAnchor.constraint(equalTo: contentLabel.leadingAnchor),
      metadataLabel.trailingAnchor.constraint(equalTo: contentLabel.trailingAnchor),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(with item: ClipboardHistoryItem) {
    let preview = item.content
      .replacingOccurrences(of: "\n", with: "  ")
      .replacingOccurrences(of: "\t", with: " ")
    contentLabel.stringValue = String(preview.prefix(180))
    iconView.image = NSImage(
      systemSymbolName: item.category.systemImage,
      accessibilityDescription: item.category.localizedTitle
    )
    let source = item.sourceName ?? String(localized: "Unknown application")
    metadataLabel.stringValue = "\(item.category.localizedTitle) · \(source) · \(relativeDate(item.capturedAt))"
    setAccessibilityLabel("\(item.category.localizedTitle), \(contentLabel.stringValue)")
  }

  private func relativeDate(_ date: Date) -> String {
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .short
    return formatter.localizedString(for: date, relativeTo: Date())
  }
}

@MainActor
final class ClipboardPaletteHotKey {
  private static let signature: UInt32 = 0x4B4D4456 // KMDV
  private let action: () -> Void
  private var hotKeyRef: EventHotKeyRef?
  private var handlerRef: EventHandlerRef?

  init(action: @escaping () -> Void) {
    self.action = action
  }

  @discardableResult
  func register() -> Bool {
    guard hotKeyRef == nil,
          let target = GetApplicationEventTarget() else { return hotKeyRef != nil }
    let eventTypes = [
      EventTypeSpec(
        eventClass: OSType(kEventClassKeyboard),
        eventKind: UInt32(kEventHotKeyPressed)
      ),
    ]
    let installStatus = InstallEventHandler(
      target,
      { _, event, userData in
        guard let event,
              GetEventKind(event) == UInt32(kEventHotKeyPressed),
              let userData else { return OSStatus(eventNotHandledErr) }
        let instance = Unmanaged<ClipboardPaletteHotKey>.fromOpaque(userData).takeUnretainedValue()
        Task { @MainActor in instance.action() }
        return noErr
      },
      eventTypes.count,
      eventTypes,
      Unmanaged.passUnretained(self).toOpaque(),
      &handlerRef
    )
    guard installStatus == noErr else { return false }

    let registrationStatus = RegisterEventHotKey(
      UInt32(kVK_ANSI_V),
      UInt32(controlKey | shiftKey),
      EventHotKeyID(signature: Self.signature, id: 1),
      target,
      0,
      &hotKeyRef
    )
    guard registrationStatus == noErr else {
      if let handlerRef {
        RemoveEventHandler(handlerRef)
        self.handlerRef = nil
      }
      return false
    }
    return true
  }
}
