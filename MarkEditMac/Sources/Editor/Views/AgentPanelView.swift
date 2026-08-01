//
//  AgentPanelView.swift
//
//  Created by ksamint on 8/1/26.
//

import AppKit
import SharedUI

final class AgentPanelView: NSView {
  var onClose: (() -> Void)?
  var onProviderChanged: ((LocalAgentProviderID) -> Void)?
  var onSubmit: ((String) -> Void)?
  var onCancel: (() -> Void)?
  var onApproval: ((UUID, Bool) -> Void)?
  var onInsert: (() -> Void)?
  var onSaveMarkdown: (() -> Void)?
  var onSaveReference: (() -> Void)?
  var onResize: ((Double) -> Void)?

  private let divider = AgentPanelResizeHandle()
  private let providerControl = NSSegmentedControl(
    labels: LocalAgentProviderID.allCases.map(\.displayName),
    trackingMode: .selectOne,
    target: nil,
    action: nil
  )
  private let closeButton = NSButton()
  private let statusLabel = NSTextField(wrappingLabelWithString: "")
  private let transcriptScroll = NSScrollView()
  private let transcriptView = NSTextView()
  private let approvalBox = NSBox()
  private let approvalTitle = NSTextField(wrappingLabelWithString: "")
  private let approvalDetail = NSTextField(wrappingLabelWithString: "")
  private let allowButton = NSButton()
  private let denyButton = NSButton()
  private let promptScroll = NSScrollView()
  private let promptView = AgentPromptTextView()
  private let sendButton = NSButton()
  private let cancelButton = NSButton()
  private let insertButton = NSButton()
  private let saveButton = NSButton()
  private let referenceButton = NSButton()
  private var approvalID: UUID?
  private var draftBuffer = ""

  var selectedProvider: LocalAgentProviderID {
    get {
      LocalAgentProviderID.allCases[safe: providerControl.selectedSegment] ?? .codex
    }
    set {
      providerControl.selectedSegment = LocalAgentProviderID.allCases.firstIndex(of: newValue) ?? 0
    }
  }

  var outputText: String {
    draftBuffer
  }

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
    setAccessibilityRole(.group)
    setAccessibilityLabel(Localized.Agent.panel)
    configureViews()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layout() {
    super.layout()
    let padding = 12.0
    let headerHeight = 28.0
    let statusHeight = 38.0
    let actionHeight = 30.0
    let promptHeight = 82.0
    let approvalHeight = approvalBox.isHidden ? 0.0 : 126.0
    let bottom = padding

    divider.frame = CGRect(x: 0, y: 0, width: 7, height: bounds.height)
    providerControl.frame = CGRect(x: padding, y: bounds.height - padding - headerHeight, width: min(230, bounds.width - 70), height: headerHeight)
    closeButton.frame = CGRect(x: bounds.width - padding - 28, y: bounds.height - padding - headerHeight, width: 28, height: headerHeight)
    statusLabel.frame = CGRect(x: padding, y: providerControl.frame.minY - statusHeight - 5, width: bounds.width - padding * 2, height: statusHeight)

    referenceButton.frame = CGRect(x: bounds.width - padding - 104, y: bottom, width: 104, height: actionHeight)
    saveButton.frame = CGRect(x: referenceButton.frame.minX - 92, y: bottom, width: 84, height: actionHeight)
    insertButton.frame = CGRect(x: padding, y: bottom, width: max(80, saveButton.frame.minX - padding - 8), height: actionHeight)

    let promptY = bottom + actionHeight + 8
    cancelButton.frame = CGRect(x: bounds.width - padding - 72, y: promptY, width: 72, height: 30)
    sendButton.frame = CGRect(x: cancelButton.frame.minX, y: promptY + 36, width: 72, height: 30)
    promptScroll.frame = CGRect(x: padding, y: promptY, width: max(120, sendButton.frame.minX - padding - 8), height: promptHeight)

    let approvalY = promptY + promptHeight + 8
    approvalBox.frame = CGRect(x: padding, y: approvalY, width: bounds.width - padding * 2, height: approvalHeight)
    if !approvalBox.isHidden {
      approvalTitle.frame = CGRect(x: 10, y: approvalHeight - 34, width: approvalBox.bounds.width - 20, height: 22)
      approvalDetail.frame = CGRect(x: 10, y: 40, width: approvalBox.bounds.width - 20, height: approvalHeight - 72)
      denyButton.frame = CGRect(x: approvalBox.bounds.width - 82, y: 8, width: 72, height: 26)
      allowButton.frame = CGRect(x: denyButton.frame.minX - 82, y: 8, width: 74, height: 26)
    }

    let transcriptTop = statusLabel.frame.minY - 8
    transcriptScroll.frame = CGRect(
      x: padding,
      y: approvalY + approvalHeight + (approvalHeight > 0 ? 8 : 0),
      width: bounds.width - padding * 2,
      height: max(80, transcriptTop - approvalY - approvalHeight - (approvalHeight > 0 ? 8 : 0))
    )
  }

  func setProviders(_ statuses: [LocalAgentProviderStatus]) {
    for (index, provider) in LocalAgentProviderID.allCases.enumerated() {
      providerControl.setEnabled(
        statuses.first { $0.provider == provider }?.isInstalled == true,
        forSegment: index
      )
      let version = statuses.first { $0.provider == provider }?.version
      providerControl.setToolTip(version ?? Localized.Agent.notInstalled, forSegment: index)
    }
    if !providerControl.isEnabled(forSegment: providerControl.selectedSegment),
       let first = LocalAgentProviderID.allCases.indices.first(where: { providerControl.isEnabled(forSegment: $0) }) {
      providerControl.selectedSegment = first
    }
  }

  func setStatus(_ value: String) {
    statusLabel.stringValue = value
  }

  func beginRequest(_ prompt: String) {
    draftBuffer = ""
    appendTranscript("\n\n› \(prompt)\n\n", color: .secondaryLabelColor)
    updateActionState()
  }

  func appendOutput(_ value: String) {
    draftBuffer.append(value)
    appendTranscript(value, color: .textColor)
    updateActionState()
  }

  func appendTranscript(_ value: String, color: NSColor) {
    transcriptView.textStorage?.append(NSAttributedString(string: value, attributes: [
      .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
      .foregroundColor: color,
    ]))
    transcriptView.scrollToEndOfDocument(nil)
  }

  func clearOutput() {
    transcriptView.string = ""
    draftBuffer = ""
    updateActionState()
  }

  func setBusy(_ busy: Bool) {
    sendButton.isEnabled = !busy
    cancelButton.isEnabled = busy
    providerControl.isEnabled = !busy
  }

  func showApproval(_ approval: LocalAgentApproval) {
    approvalID = approval.id
    approvalTitle.stringValue = approval.title
    approvalDetail.stringValue = approval.detail
    allowButton.isHidden = !approval.canApprove
    approvalBox.isHidden = false
    needsLayout = true
  }

  func dismissApproval() {
    approvalID = nil
    approvalBox.isHidden = true
    needsLayout = true
  }
}

private extension AgentPanelView {
  func configureViews() {
    layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
    divider.onDrag = { [weak self] delta in self?.onResize?(delta) }

    providerControl.selectedSegment = 0
    providerControl.target = self
    providerControl.action = #selector(providerChanged(_:))

    closeButton.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: Localized.Agent.close)
    closeButton.bezelStyle = .accessoryBarAction
    closeButton.target = self
    closeButton.action = #selector(close(_:))

    statusLabel.textColor = .secondaryLabelColor
    statusLabel.font = .systemFont(ofSize: 11)

    transcriptView.isEditable = false
    transcriptView.isRichText = true
    transcriptView.drawsBackground = false
    transcriptView.textContainerInset = NSSize(width: 8, height: 8)
    transcriptScroll.documentView = transcriptView
    transcriptScroll.hasVerticalScroller = true
    transcriptScroll.borderType = .bezelBorder

    approvalBox.boxType = .custom
    approvalBox.cornerRadius = 8
    approvalBox.borderColor = .systemOrange
    approvalBox.fillColor = .controlBackgroundColor
    approvalBox.isHidden = true
    approvalTitle.font = .systemFont(ofSize: 13, weight: .semibold)
    approvalDetail.font = .systemFont(ofSize: 11)
    approvalDetail.textColor = .secondaryLabelColor
    allowButton.title = Localized.Agent.allow
    allowButton.bezelStyle = .rounded
    allowButton.target = self
    allowButton.action = #selector(approve(_:))
    denyButton.title = Localized.Agent.deny
    denyButton.bezelStyle = .rounded
    denyButton.target = self
    denyButton.action = #selector(deny(_:))
    for child in [approvalTitle, approvalDetail, allowButton, denyButton] {
      approvalBox.addSubview(child)
    }

    promptView.font = .systemFont(ofSize: 13)
    promptView.placeholder = Localized.Agent.prompt
    promptView.onSubmit = { [weak self] in self?.submit(nil) }
    promptScroll.documentView = promptView
    promptScroll.hasVerticalScroller = true
    promptScroll.borderType = .bezelBorder

    sendButton.title = Localized.Agent.send
    sendButton.keyEquivalent = "\r"
    sendButton.bezelStyle = .rounded
    sendButton.target = self
    sendButton.action = #selector(submit(_:))
    cancelButton.title = Localized.General.cancel
    cancelButton.bezelStyle = .rounded
    cancelButton.target = self
    cancelButton.action = #selector(cancel(_:))
    cancelButton.isEnabled = false

    insertButton.title = Localized.Agent.insert
    saveButton.title = Localized.Agent.saveMarkdown
    referenceButton.title = Localized.Agent.saveReference
    for button in [insertButton, saveButton, referenceButton] {
      button.bezelStyle = .rounded
      button.controlSize = .small
      button.isEnabled = false
    }
    insertButton.target = self
    insertButton.action = #selector(insert(_:))
    saveButton.target = self
    saveButton.action = #selector(save(_:))
    referenceButton.target = self
    referenceButton.action = #selector(saveReference(_:))

    for child in [
      divider, providerControl, closeButton, statusLabel, transcriptScroll, approvalBox,
      promptScroll, sendButton, cancelButton, insertButton, saveButton, referenceButton,
    ] {
      addSubview(child)
    }
  }

  func updateActionState() {
    let enabled = !outputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    insertButton.isEnabled = enabled
    saveButton.isEnabled = enabled
    referenceButton.isEnabled = enabled
  }

  @objc func providerChanged(_ sender: Any?) {
    onProviderChanged?(selectedProvider)
  }

  @objc func close(_ sender: Any?) {
    onClose?()
  }

  @objc func submit(_ sender: Any?) {
    let prompt = promptView.string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !prompt.isEmpty else {
      return
    }
    promptView.string = ""
    onSubmit?(prompt)
  }

  @objc func cancel(_ sender: Any?) {
    onCancel?()
  }

  @objc func approve(_ sender: Any?) {
    guard let approvalID else { return }
    dismissApproval()
    onApproval?(approvalID, true)
  }

  @objc func deny(_ sender: Any?) {
    guard let approvalID else { return }
    dismissApproval()
    onApproval?(approvalID, false)
  }

  @objc func insert(_ sender: Any?) {
    onInsert?()
  }

  @objc func save(_ sender: Any?) {
    onSaveMarkdown?()
  }

  @objc func saveReference(_ sender: Any?) {
    onSaveReference?()
  }
}

private final class AgentPromptTextView: NSTextView {
  var placeholder = ""
  var onSubmit: (() -> Void)?

  override func keyDown(with event: NSEvent) {
    if event.keyCode == 36, event.modifierFlags.contains(.command) {
      onSubmit?()
      return
    }
    super.keyDown(with: event)
  }

  override func draw(_ dirtyRect: NSRect) {
    super.draw(dirtyRect)
    guard string.isEmpty, window?.firstResponder !== self else {
      return
    }
    (placeholder as NSString).draw(
      at: NSPoint(x: textContainerInset.width + 4, y: textContainerInset.height),
      withAttributes: [
        .font: font ?? NSFont.systemFont(ofSize: 13),
        .foregroundColor: NSColor.placeholderTextColor,
      ]
    )
  }
}

private final class AgentPanelResizeHandle: NSView {
  var onDrag: ((Double) -> Void)?
  private var lastX = 0.0

  override func resetCursorRects() {
    addCursorRect(bounds, cursor: .resizeLeftRight)
  }

  override func mouseDown(with event: NSEvent) {
    lastX = event.locationInWindow.x
  }

  override func mouseDragged(with event: NSEvent) {
    let current = event.locationInWindow.x
    onDrag?(lastX - current)
    lastX = current
  }

  override func draw(_ dirtyRect: NSRect) {
    NSColor.separatorColor.setFill()
    NSRect(x: 0, y: 0, width: 1, height: bounds.height).fill()
  }
}

private extension Array {
  subscript(safe index: Int) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
