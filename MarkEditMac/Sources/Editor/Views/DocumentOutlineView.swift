//
//  DocumentOutlineView.swift
//  MarkEditMac
//
//  Created by ksamint on 8/3/26.
//

import AppKit
import MarkEditKit

@MainActor
final class DocumentOutlineView: NSView {
  var onSelect: ((HeadingInfo) -> Void)?

  private let titleLabel = NSTextField(labelWithString: Localized.Toolbar.tableOfContents)
  private let emptyLabel = NSTextField(wrappingLabelWithString: String(
    localized: "Add a heading to build the document outline."
  ))
  private let scrollView = NSScrollView()
  private let tableView = NSTableView()
  private var headings = [HeadingInfo]()

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    setUp()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func update(headings: [HeadingInfo]) {
    self.headings = headings
    tableView.reloadData()
    emptyLabel.isHidden = !headings.isEmpty
    scrollView.isHidden = headings.isEmpty

    if let selectedIndex = headings.firstIndex(where: \.selected) {
      tableView.selectRowIndexes(IndexSet(integer: selectedIndex), byExtendingSelection: false)
      tableView.scrollRowToVisible(selectedIndex)
    } else {
      tableView.deselectAll(nil)
    }
  }
}

private extension DocumentOutlineView {
  func setUp() {
    wantsLayer = true
    layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

    titleLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize, weight: .semibold)
    titleLabel.textColor = .secondaryLabelColor

    emptyLabel.alignment = .center
    emptyLabel.textColor = .tertiaryLabelColor

    let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("DocumentHeading"))
    column.resizingMask = .autoresizingMask
    tableView.addTableColumn(column)
    tableView.headerView = nil
    tableView.rowHeight = 28
    tableView.delegate = self
    tableView.dataSource = self
    tableView.target = self
    tableView.action = #selector(selectHeading(_:))
    tableView.setAccessibilityLabel(Localized.Toolbar.tableOfContents)

    scrollView.documentView = tableView
    scrollView.hasVerticalScroller = true
    scrollView.drawsBackground = false

    [titleLabel, scrollView, emptyLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }

    NSLayoutConstraint.activate([
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),

      scrollView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
      scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
      scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
      scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),

      emptyLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
      emptyLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
      emptyLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -18),
    ])

    update(headings: [])
  }

  @objc func selectHeading(_ sender: NSTableView) {
    guard headings.indices.contains(sender.selectedRow) else {
      return
    }
    onSelect?(headings[sender.selectedRow])
  }
}

extension DocumentOutlineView: NSTableViewDataSource, NSTableViewDelegate {
  func numberOfRows(in tableView: NSTableView) -> Int {
    headings.count
  }

  func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
    guard headings.indices.contains(row) else {
      return nil
    }

    let heading = headings[row]
    let identifier = NSUserInterfaceItemIdentifier("DocumentHeadingCell")
    let cell = (tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTableCellView)
      ?? NSTableCellView()
    cell.identifier = identifier

    let label: NSTextField
    if let existing = cell.textField {
      label = existing
    } else {
      label = NSTextField(labelWithString: "")
      label.translatesAutoresizingMaskIntoConstraints = false
      cell.addSubview(label)
      cell.textField = label
      NSLayoutConstraint.activate([
        label.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        label.leadingAnchor.constraint(equalTo: cell.leadingAnchor),
        label.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -8),
      ])
    }

    let baseLevel = headings.map(\.level).min() ?? 1
    label.stringValue = String(repeating: "  ", count: max(0, heading.level - baseLevel)) + heading.title
    label.font = .systemFont(ofSize: 13, weight: heading.level == baseLevel ? .semibold : .regular)
    label.textColor = heading.selected ? .controlAccentColor : .labelColor
    label.lineBreakMode = .byTruncatingTail
    label.setAccessibilityLabel(heading.title)
    return cell
  }
}
