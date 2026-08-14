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
  private let summaryLabel = NSTextField(labelWithString: "")
  private let structureView = DocumentStructureOverviewView()
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
    structureView.update(headings: headings)

    let isEmpty = headings.isEmpty
    emptyLabel.isHidden = !isEmpty
    scrollView.isHidden = isEmpty
    structureView.isHidden = isEmpty
    summaryLabel.isHidden = isEmpty

    if let first = headings.first {
      summaryLabel.stringValue = String(
        format: String(localized: "%lld headings · %lld document words"),
        locale: .current,
        Int64(headings.count),
        Int64(first.documentWordCount)
      )
    } else {
      summaryLabel.stringValue = ""
    }

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

    summaryLabel.alignment = .right
    summaryLabel.font = .systemFont(ofSize: 10)
    summaryLabel.textColor = .tertiaryLabelColor
    summaryLabel.lineBreakMode = .byTruncatingTail

    emptyLabel.alignment = .center
    emptyLabel.textColor = .tertiaryLabelColor

    let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("DocumentHeading"))
    column.resizingMask = .autoresizingMask
    tableView.addTableColumn(column)
    tableView.headerView = nil
    tableView.rowHeight = 46
    tableView.intercellSpacing = NSSize(width: 0, height: 1)
    tableView.delegate = self
    tableView.dataSource = self
    tableView.target = self
    tableView.action = #selector(selectHeading(_:))
    tableView.setAccessibilityLabel(Localized.Toolbar.tableOfContents)

    scrollView.documentView = tableView
    scrollView.hasVerticalScroller = true
    scrollView.drawsBackground = false

    [titleLabel, summaryLabel, structureView, scrollView, emptyLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }

    NSLayoutConstraint.activate([
      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),

      summaryLabel.firstBaselineAnchor.constraint(equalTo: titleLabel.firstBaselineAnchor),
      summaryLabel.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 8),
      summaryLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),

      structureView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 7),
      structureView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
      structureView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
      structureView.heightAnchor.constraint(equalToConstant: 52),

      scrollView.topAnchor.constraint(equalTo: structureView.bottomAnchor, constant: 5),
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

  func metadata(for heading: HeadingInfo) -> String {
    let percentage = heading.documentWordCount > 0
      ? Double(heading.sectionWordCount) / Double(heading.documentWordCount)
      : 0
    let percentageText = percentage.formatted(.percent.precision(.fractionLength(0...1)))
    var result = String(
      format: String(localized: "%lld words · %@ · lines %lld–%lld"),
      locale: .current,
      Int64(heading.sectionWordCount),
      percentageText,
      Int64(heading.lineStart),
      Int64(heading.lineEnd)
    )
    if heading.directChildCount > 0 {
      result += " · " + String(
        format: String(localized: "%lld child sections"),
        locale: .current,
        Int64(heading.directChildCount)
      )
    }
    return result
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
    let cell = (tableView.makeView(withIdentifier: identifier, owner: nil) as? DocumentHeadingCellView)
      ?? DocumentHeadingCellView()
    cell.identifier = identifier
    cell.configure(
      heading: heading,
      baseLevel: headings.map(\.level).min() ?? 1,
      metadata: metadata(for: heading)
    )
    return cell
  }
}

@MainActor
private final class DocumentHeadingCellView: NSTableCellView {
  private let levelLabel = NSTextField(labelWithString: "")
  private let titleLabel = NSTextField(labelWithString: "")
  private let metadataLabel = NSTextField(labelWithString: "")
  private var levelLeadingConstraint: NSLayoutConstraint?

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)

    levelLabel.alignment = .center
    levelLabel.font = .monospacedSystemFont(ofSize: 9, weight: .semibold)
    levelLabel.textColor = .secondaryLabelColor
    levelLabel.wantsLayer = true
    levelLabel.layer?.cornerRadius = 4
    levelLabel.layer?.backgroundColor = NSColor.quaternaryLabelColor.withAlphaComponent(0.18).cgColor

    titleLabel.lineBreakMode = .byTruncatingTail
    metadataLabel.font = .systemFont(ofSize: 9.5)
    metadataLabel.textColor = .tertiaryLabelColor
    metadataLabel.lineBreakMode = .byTruncatingTail

    [levelLabel, titleLabel, metadataLabel].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }
    textField = titleLabel

    let leading = levelLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8)
    levelLeadingConstraint = leading
    NSLayoutConstraint.activate([
      leading,
      levelLabel.topAnchor.constraint(equalTo: topAnchor, constant: 6),
      levelLabel.widthAnchor.constraint(equalToConstant: 24),
      levelLabel.heightAnchor.constraint(equalToConstant: 16),

      titleLabel.firstBaselineAnchor.constraint(equalTo: levelLabel.firstBaselineAnchor),
      titleLabel.leadingAnchor.constraint(equalTo: levelLabel.trailingAnchor, constant: 6),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),

      metadataLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 3),
      metadataLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
      metadataLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
    ])
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func configure(heading: HeadingInfo, baseLevel: Int, metadata: String) {
    let depth = max(0, heading.level - baseLevel)
    levelLeadingConstraint?.constant = 8 + CGFloat(depth * 14)
    levelLabel.stringValue = "H\(heading.level)"
    titleLabel.stringValue = heading.title
    titleLabel.font = .systemFont(ofSize: 12.5, weight: depth == 0 ? .semibold : .regular)
    titleLabel.textColor = heading.selected ? .controlAccentColor : .labelColor
    metadataLabel.stringValue = metadata
    setAccessibilityLabel("H\(heading.level), \(heading.title), \(metadata)")
  }
}

@MainActor
private final class DocumentStructureOverviewView: NSView {
  private var headings = [HeadingInfo]()

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
    setAccessibilityElement(true)
    setAccessibilityRole(.group)
    setAccessibilityLabel(String(localized: "Document structure overview"))
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func update(headings: [HeadingInfo]) {
    self.headings = headings
    needsDisplay = true
  }

  override func draw(_ dirtyRect: NSRect) {
    super.draw(dirtyRect)

    let background = NSBezierPath(roundedRect: bounds, xRadius: 7, yRadius: 7)
    NSColor.controlBackgroundColor.withAlphaComponent(0.65).setFill()
    background.fill()

    guard let documentEnd = headings.map(\.sectionEnd).max(), documentEnd > 0 else {
      return
    }

    let labelWidth: CGFloat = 20
    let trackRect = bounds.insetBy(dx: 7, dy: 5)
    let drawableWidth = max(1, trackRect.width - labelWidth - 3)
    let laneHeight = trackRect.height / 3
    let accent = NSColor.controlAccentColor

    for level in 1...3 {
      let laneY = trackRect.maxY - CGFloat(level) * laneHeight
      let labelRect = NSRect(x: trackRect.minX, y: laneY, width: labelWidth, height: laneHeight)
      let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 8, weight: .medium),
        .foregroundColor: NSColor.tertiaryLabelColor,
      ]
      ("H\(level)" as NSString).draw(in: labelRect.insetBy(dx: 0, dy: 1), withAttributes: attributes)

      let baseline = NSBezierPath()
      baseline.move(to: NSPoint(x: trackRect.minX + labelWidth, y: laneY + laneHeight / 2))
      baseline.line(to: NSPoint(x: trackRect.maxX, y: laneY + laneHeight / 2))
      NSColor.separatorColor.withAlphaComponent(0.45).setStroke()
      baseline.lineWidth = 1
      baseline.stroke()

      for heading in headings where heading.level == level {
        let start = CGFloat(heading.from) / CGFloat(documentEnd)
        let end = CGFloat(heading.sectionEnd) / CGFloat(documentEnd)
        let segment = NSRect(
          x: trackRect.minX + labelWidth + start * drawableWidth,
          y: laneY + 2,
          width: max(2, (end - start) * drawableWidth),
          height: max(3, laneHeight - 4)
        )
        let path = NSBezierPath(roundedRect: segment, xRadius: 2.5, yRadius: 2.5)
        accent.withAlphaComponent(heading.selected ? 0.9 : 0.28 + CGFloat(4 - level) * 0.08).setFill()
        path.fill()
      }
    }
  }
}
