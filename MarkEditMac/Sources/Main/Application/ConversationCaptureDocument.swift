import CryptoKit
import Foundation

/// Converts an untrusted clipboard transcript into the canonical Markdown form.
/// It owns normalization and message-boundary rules so capture transports do not.
struct ConversationCaptureDocument {
  func normalize(_ value: String) -> String {
    value
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: "\r", with: "\n")
      .precomposedStringWithCompatibilityMapping
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  func digest(_ value: String) -> String {
    SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  func isHighConfidenceConversation(_ text: String) -> Bool {
    guard text.precomposedStringWithCompatibilityMapping.count >= 200 else { return false }
    let roles = turns(in: text).map(\.role)
    return roles.count >= 2 && roles.contains("user") && roles.contains("assistant")
  }

  func markdown(
    for text: String,
    digest: String,
    sourceName: String?,
    sourceBundleID: String?
  ) -> String {
    let now = ISO8601DateFormatter().string(from: Date())
    let source = sourceName ?? "Clipboard"
    let capturedTurns = turns(in: text)
    var output = """
    ---
    type: Conversation
    source: "clipboard"
    imported_at: \(now)
    message_count: \(capturedTurns.count)
    content_digest: \(digest)
    category: "Conversations/Clipboard"
    tags: ["conversation", "clipboard"]
    captured_from: \(jsonString(source))
    """
    if let sourceBundleID {
      output += "\ncaptured_bundle_id: \(jsonString(sourceBundleID))"
    }
    output += "\n---\n\n# \(source) conversation\n\n"
    if capturedTurns.isEmpty {
      output += messageMarkdown(role: "unknown", content: text)
    } else {
      output += capturedTurns
        .map { messageMarkdown(role: $0.role, content: $0.content) }
        .joined()
    }
    return output + "\n"
  }

  private func messageMarkdown(role: String, content: String) -> String {
    let messageDigest = digest("\(role)\n\(normalize(content))")
    let marker = ["id": messageDigest, "digest": messageDigest, "role": role]
    let markerData = try? JSONSerialization.data(withJSONObject: marker, options: [.sortedKeys])
    let encoded = markerData?.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "") ?? ""
    let body = content.trimmingCharacters(in: .whitespacesAndNewlines)
    return "<!-- ksamint-message-v1 \(encoded) -->\n## \(role.capitalized)\n\n\(body)\n\n"
  }

  private func turns(in text: String) -> [CapturedTurn] {
    let pattern = #"(?im)^(?:#{1,4}\s*)?(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)\s*(?:(?:·|said)[^\n:]*)?:\s*|^(?:#{1,4}\s+)(User|Human|You|Assistant|Claude|ChatGPT|System|Tool)(?:\s*(?:·|said)[^\n]*)?\s*$"#
    guard let expression = try? NSRegularExpression(pattern: pattern) else { return [] }
    let range = NSRange(text.startIndex..<text.endIndex, in: text)
    let matches = expression.matches(in: text, range: range)
    return matches.enumerated().compactMap { index, match in
      let roleRange = match.range(at: 1).location != NSNotFound ? match.range(at: 1) : match.range(at: 2)
      guard let roleStringRange = Range(roleRange, in: text) else { return nil }
      let contentEnd = index + 1 < matches.count ? matches[index + 1].range.location : range.length
      let contentStart = match.range.location + match.range.length
      let contentRange = NSRange(location: contentStart, length: contentEnd - contentStart)
      guard let stringContentRange = Range(contentRange, in: text) else { return nil }
      let content = String(text[stringContentRange]).trimmingCharacters(in: .whitespacesAndNewlines)
      return content.isEmpty
        ? nil
        : CapturedTurn(role: canonicalRole(String(text[roleStringRange])), content: content)
    }
  }

  private func canonicalRole(_ value: String) -> String {
    switch value.lowercased() {
    case "user", "human", "you": "user"
    case "assistant", "claude", "chatgpt": "assistant"
    case "system": "system"
    case "tool": "tool"
    default: "unknown"
    }
  }

  private func jsonString(_ value: String) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: [value]),
          let array = String(data: data, encoding: .utf8) else { return "\"\"" }
    return String(array.dropFirst().dropLast())
  }
}

private struct CapturedTurn {
  let role: String
  let content: String
}
