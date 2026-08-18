import KMDIOSCore
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let previewLabel = UILabel()
  private let saveButton = UIButton(type: .system)
  private var envelope: SharedInboxEnvelope?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground

    let titleLabel = UILabel()
    titleLabel.text = String(localized: "Share with kmd")
    titleLabel.font = .preferredFont(forTextStyle: .title2)

    previewLabel.numberOfLines = 12
    previewLabel.textColor = .secondaryLabel
    previewLabel.text = String(localized: "Reading shared content…")

    saveButton.configuration = .filled()
    saveButton.setTitle(String(localized: "Save to Inbox"), for: .normal)
    saveButton.isEnabled = false
    saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)

    let cancelButton = UIButton(type: .system)
    cancelButton.setTitle(String(localized: "Cancel"), for: .normal)
    cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

    let buttons = UIStackView(arrangedSubviews: [cancelButton, saveButton])
    buttons.axis = .horizontal
    buttons.spacing = 12
    buttons.distribution = .fillEqually

    let stack = UIStackView(arrangedSubviews: [titleLabel, previewLabel, buttons])
    stack.axis = .vertical
    stack.spacing = 20
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
      stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
    ])

    Task { await loadSharedContent() }
  }

  private func loadSharedContent() async {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      return fail(String(localized: "No supported content was shared."))
    }

    for item in items {
      for provider in item.attachments ?? [] {
        if let value = await content(from: provider) {
          envelope = value
          previewLabel.text = String(value.text.prefix(1_000))
          saveButton.isEnabled = true
          return
        }
      }
    }

    fail(String(localized: "No supported content was shared."))
  }

  private func content(from provider: NSItemProvider) async -> SharedInboxEnvelope? {
    let candidates: [(UTType, SharedInboxEnvelope.Kind)] = [
      (.markdown, .markdown),
      (.html, .html),
      (.plainText, .text),
      (.url, .url),
    ]

    for (type, kind) in candidates where provider.hasItemConformingToTypeIdentifier(type.identifier) {
      guard let data = try? await provider.loadDataRepresentation(for: type) else { continue }
      let text = String(data: data, encoding: .utf8)
        ?? String(data: data, encoding: .utf16)
      guard let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
      return SharedInboxEnvelope(
        kind: kind,
        text: text,
        sourceURL: kind == .url ? text.trimmingCharacters(in: .whitespacesAndNewlines) : nil
      )
    }
    return nil
  }

  @objc private func save() {
    guard let envelope else { return }
    saveButton.isEnabled = false
    Task {
      do {
        try await repository.append(envelope)
        extensionContext?.completeRequest(returningItems: nil)
      } catch {
        fail(error.localizedDescription)
      }
    }
  }

  @objc private func cancel() {
    extensionContext?.cancelRequest(withError: CocoaError(.userCancelled))
  }

  private func fail(_ message: String) {
    previewLabel.text = message
    saveButton.isEnabled = false
  }

  private var repository: SharedInboxRepository {
    let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: "group.art.apuch.ksamint-markedit"
    ) ?? FileManager.default.temporaryDirectory
    return SharedInboxRepository(rootURL: container.appending(path: "SharedInbox", directoryHint: .isDirectory))
  }
}

