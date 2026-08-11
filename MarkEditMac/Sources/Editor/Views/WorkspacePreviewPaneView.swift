//
//  WorkspacePreviewPaneView.swift
//  MarkEditMac
//
//  Created by ksamint on 8/3/26.
//

import AppKit

@MainActor
final class WorkspacePreviewPaneView: NSView {
  var onClose: (() -> Void)?
  var onResize: ((Double) -> Void)?
  var onSyncChanged: ((Bool) -> Void)?

  private let resizeHandle = PreviewPaneResizeHandle()
  private let titleLabel = NSTextField(labelWithString: Localized.Editor.previewButtonTitle)
  private let syncButton = NSButton()
  private let closeButton = NSButton()
  private let contentView = NSView()

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    setUp()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func setPreviewView(_ previewView: NSView) {
    contentView.subviews.forEach { $0.removeFromSuperview() }
    previewView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(previewView)
    NSLayoutConstraint.activate([
      previewView.topAnchor.constraint(equalTo: contentView.topAnchor),
      previewView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      previewView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      previewView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
    ])
  }

  func setSyncEnabled(_ enabled: Bool) {
    syncButton.state = enabled ? .on : .off
  }
}

private extension WorkspacePreviewPaneView {
  func setUp() {
    wantsLayer = true
    layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

    titleLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize, weight: .semibold)
    titleLabel.textColor = .secondaryLabelColor

    syncButton.setButtonType(.switch)
    syncButton.title = Localized.Workspace.syncPreview
    syncButton.controlSize = .small
    syncButton.target = self
    syncButton.action = #selector(toggleSync(_:))

    closeButton.image = NSImage(systemSymbolName: "sidebar.right", accessibilityDescription: String(
      localized: "Hide Preview"
    ))
    closeButton.bezelStyle = .accessoryBarAction
    closeButton.target = self
    closeButton.action = #selector(close(_:))

    resizeHandle.onDrag = { [weak self] delta in self?.onResize?(delta) }

    [resizeHandle, titleLabel, syncButton, closeButton, contentView].forEach {
      $0.translatesAutoresizingMaskIntoConstraints = false
      addSubview($0)
    }

    NSLayoutConstraint.activate([
      resizeHandle.topAnchor.constraint(equalTo: topAnchor),
      resizeHandle.leadingAnchor.constraint(equalTo: leadingAnchor),
      resizeHandle.bottomAnchor.constraint(equalTo: bottomAnchor),
      resizeHandle.widthAnchor.constraint(equalToConstant: 5),

      titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      titleLabel.leadingAnchor.constraint(equalTo: resizeHandle.trailingAnchor, constant: 8),
      syncButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
      syncButton.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 8),
      closeButton.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
      closeButton.leadingAnchor.constraint(equalTo: syncButton.trailingAnchor, constant: 5),
      closeButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -7),

      contentView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 7),
      contentView.leadingAnchor.constraint(equalTo: resizeHandle.trailingAnchor),
      contentView.trailingAnchor.constraint(equalTo: trailingAnchor),
      contentView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    setSyncEnabled(AppPreferences.Window.workspacePreviewSync)
  }

  @objc func toggleSync(_ sender: NSButton) {
    onSyncChanged?(sender.state == .on)
  }

  @objc func close(_ sender: Any?) {
    onClose?()
  }
}

private final class PreviewPaneResizeHandle: NSView {
  var onDrag: ((Double) -> Void)?
  private var previousX: Double?

  override func resetCursorRects() {
    addCursorRect(bounds, cursor: .resizeLeftRight)
  }

  override func mouseDown(with event: NSEvent) {
    previousX = event.locationInWindow.x
  }

  override func mouseDragged(with event: NSEvent) {
    guard let previousX else { return }
    let x = event.locationInWindow.x
    onDrag?(x - previousX)
    self.previousX = x
  }

  override func mouseUp(with event: NSEvent) {
    previousX = nil
  }

  override func draw(_ dirtyRect: NSRect) {
    NSColor.separatorColor.setFill()
    NSRect(x: bounds.midX, y: bounds.minY, width: 1, height: bounds.height).fill()
  }
}
