//
//  WorkspaceMetadata.swift
//
//  Created by ksamint on 7/29/26.
//

import Foundation

public struct WorkspaceDocumentMetadata: Sendable, Equatable {
  public var category: String?
  public var tags: [String]

  public init(category: String? = nil, tags: [String] = []) {
    self.category = category?.trimmingCharacters(in: .whitespacesAndNewlines)
    self.tags = Self.uniqueDisplayTags(tags)
  }

  public static func parse(_ source: String) -> Self {
    guard let frontMatter = FrontMatter(source: source) else {
      return Self()
    }

    var category: String?
    var tags = [String]()
    var index = frontMatter.contentRange.lowerBound

    while index < frontMatter.contentRange.upperBound {
      let line = frontMatter.lines[index]
      guard let field = YAMLField(line: line) else {
        index += 1
        continue
      }

      if field.key == "category" {
        category = decodeScalar(field.value)
      } else if field.key == "tags" {
        if field.value.trimmingCharacters(in: .whitespaces).hasPrefix("[") {
          tags.append(contentsOf: decodeInlineList(field.value))
        } else {
          var childIndex = index + 1
          while childIndex < frontMatter.contentRange.upperBound {
            let child = frontMatter.lines[childIndex]
            guard child.first?.isWhitespace == true else {
              break
            }

            let trimmed = child.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("-") {
              tags.append(decodeScalar(String(trimmed.dropFirst())) ?? "")
            }
            childIndex += 1
          }
          index = childIndex - 1
        }
      }

      index += 1
    }

    return Self(category: category, tags: tags)
  }

  public func applying(to source: String) -> String {
    let lineEnding = source.contains("\r\n") ? "\r\n" : "\n"
    let frontMatter = FrontMatter(source: source)

    if frontMatter == nil {
      guard category != nil || !tags.isEmpty else {
        return source
      }

      let prefix = [
        "---",
        category.map { "category: \(Self.encodeScalar($0))" },
        tags.isEmpty ? nil : "tags: \(Self.encodeInlineList(tags))",
        "---",
        "",
      ]
      .compactMap(\.self)
      .joined(separator: lineEnding)
      return prefix + source
    }

    guard var frontMatter else {
      return source
    }

    Self.replaceField(
      "category",
      replacement: category.map { "category: \(Self.encodeScalar($0))" },
      in: &frontMatter
    )
    Self.replaceField(
      "tags",
      replacement: tags.isEmpty ? nil : "tags: \(Self.encodeInlineList(tags))",
      in: &frontMatter
    )

    return frontMatter.lines.joined(separator: lineEnding)
  }

  public static func canonicalTagIdentity(_ value: String) -> String {
    value
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .precomposedStringWithCompatibilityMapping
      .folding(
        options: [.caseInsensitive],
        locale: Locale(identifier: "en_US_POSIX")
      )
  }
}

public enum WorkspaceMetadataFile {
  public enum FileError: LocalizedError {
    case unreadable
    case unencodable

    public var errorDescription: String? {
      switch self {
      case .unreadable:
        return "The Markdown file’s text encoding could not be read safely."
      case .unencodable:
        return "The updated metadata cannot be represented in the file’s current text encoding."
      }
    }
  }

  public static func update(
    at url: URL,
    transform: (WorkspaceDocumentMetadata) -> WorkspaceDocumentMetadata
  ) throws {
    let data = try Data(contentsOf: url, options: [.mappedIfSafe])
    guard let decoded = decode(data) else {
      throw FileError.unreadable
    }

    let metadata = WorkspaceDocumentMetadata.parse(decoded.text)
    let updated = transform(metadata).applying(to: decoded.text)
    guard updated != decoded.text else {
      return
    }
    guard let updatedData = updated.data(using: decoded.encoding) else {
      throw FileError.unencodable
    }

    try updatedData.write(to: url, options: .atomic)
  }

  public static func read(at url: URL) throws -> WorkspaceDocumentMetadata {
    let data = try Data(contentsOf: url, options: [.mappedIfSafe])
    guard let decoded = decode(data) else {
      throw FileError.unreadable
    }
    return WorkspaceDocumentMetadata.parse(decoded.text)
  }
}

private extension WorkspaceMetadataFile {
  struct DecodedFile {
    let text: String
    let encoding: String.Encoding
  }

  static func decode(_ data: Data) -> DecodedFile? {
    let encodings: [String.Encoding] = [
      .utf8,
      .utf16,
      .utf16LittleEndian,
      .utf16BigEndian,
      .windowsCP1252,
      .shiftJIS,
      .japaneseEUC,
    ]

    for encoding in encodings {
      if let text = String(data: data, encoding: encoding) {
        return DecodedFile(text: text, encoding: encoding)
      }
    }
    return nil
  }
}

private extension WorkspaceDocumentMetadata {
  struct FrontMatter {
    var lines: [String]
    var contentRange: Range<Int>

    init?(source: String) {
      let lineEnding = source.contains("\r\n") ? "\r\n" : "\n"
      let lines = source.components(separatedBy: lineEnding)
      guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else {
        return nil
      }

      guard let closingIndex = lines.dropFirst().firstIndex(where: {
        let value = $0.trimmingCharacters(in: .whitespaces)
        return value == "---" || value == "..."
      }) else {
        return nil
      }

      self.lines = lines
      self.contentRange = 1..<closingIndex
    }
  }

  struct YAMLField {
    let key: String
    let value: String

    init?(line: String) {
      guard line.first?.isWhitespace != true,
            !line.hasPrefix("#"),
            let separator = line.firstIndex(of: ":") else {
        return nil
      }

      let key = line[..<separator].trimmingCharacters(in: .whitespaces)
      guard !key.isEmpty else {
        return nil
      }

      self.key = key
      self.value = String(line[line.index(after: separator)...])
    }
  }

  static func replaceField(
    _ key: String,
    replacement: String?,
    in frontMatter: inout FrontMatter
  ) {
    var fieldRange: Range<Int>?

    for index in frontMatter.contentRange {
      guard let field = YAMLField(line: frontMatter.lines[index]), field.key == key else {
        continue
      }

      var endIndex = index + 1
      while endIndex < frontMatter.contentRange.upperBound,
            frontMatter.lines[endIndex].first?.isWhitespace == true {
        endIndex += 1
      }
      fieldRange = index..<endIndex
      break
    }

    if let fieldRange {
      let comment = inlineCommentSuffix(frontMatter.lines[fieldRange.lowerBound])
      if let replacement {
        frontMatter.lines.replaceSubrange(fieldRange, with: [replacement + comment])
        let delta = 1 - fieldRange.count
        let lowerBound = frontMatter.contentRange.lowerBound
        let upperBound = frontMatter.contentRange.upperBound + delta
        frontMatter.contentRange = lowerBound..<upperBound
      } else {
        frontMatter.lines.removeSubrange(fieldRange)
        let lowerBound = frontMatter.contentRange.lowerBound
        let upperBound = frontMatter.contentRange.upperBound - fieldRange.count
        frontMatter.contentRange = lowerBound..<upperBound
      }
      return
    }

    guard let replacement else {
      return
    }

    frontMatter.lines.insert(replacement, at: frontMatter.contentRange.upperBound)
    let lowerBound = frontMatter.contentRange.lowerBound
    let upperBound = frontMatter.contentRange.upperBound + 1
    frontMatter.contentRange = lowerBound..<upperBound
  }

  static func inlineCommentSuffix(_ line: String) -> String {
    var quote: Character?
    var previous: Character?

    for index in line.indices {
      let character = line[index]
      if (character == "\"" || character == "'") && previous != "\\" {
        quote = quote == character ? nil : (quote ?? character)
      } else if character == "#", quote == nil {
        let prefix = line[..<index]
        guard prefix.last?.isWhitespace == true else {
          break
        }
        return " " + line[index...].trimmingCharacters(in: .whitespaces)
      }
      previous = character
    }

    return ""
  }

  static func decodeInlineList(_ value: String) -> [String] {
    let trimmed = value.trimmingCharacters(in: .whitespaces)
    guard trimmed.hasPrefix("["), let closingIndex = trimmed.lastIndex(of: "]") else {
      return []
    }

    let content = trimmed[trimmed.index(after: trimmed.startIndex)..<closingIndex]
    var values = [String]()
    var buffer = ""
    var quote: Character?
    var previous: Character?

    for character in content {
      if (character == "\"" || character == "'") && previous != "\\" {
        quote = quote == character ? nil : (quote ?? character)
        buffer.append(character)
      } else if character == ",", quote == nil {
        if let value = decodeScalar(buffer) {
          values.append(value)
        }
        buffer = ""
      } else {
        buffer.append(character)
      }
      previous = character
    }

    if let value = decodeScalar(buffer) {
      values.append(value)
    }
    return values
  }

  static func decodeScalar(_ value: String) -> String? {
    var value = value.trimmingCharacters(in: .whitespaces)
    guard !value.isEmpty, value != "null", value != "~" else {
      return nil
    }

    if let commentIndex = value.firstIndex(of: "#"),
       value[..<commentIndex].last?.isWhitespace == true {
      value = value[..<commentIndex].trimmingCharacters(in: .whitespaces)
    }

    if value.count >= 2,
       let first = value.first,
       let last = value.last,
       (first == "\"" && last == "\"") || (first == "'" && last == "'") {
      value.removeFirst()
      value.removeLast()
      if first == "\"" {
        value = value
          .replacingOccurrences(of: "\\\"", with: "\"")
          .replacingOccurrences(of: "\\\\", with: "\\")
      } else {
        value = value.replacingOccurrences(of: "''", with: "'")
      }
    }

    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  static func encodeScalar(_ value: String) -> String {
    let unsafeCharacters = CharacterSet.whitespacesAndNewlines
      .union(CharacterSet(charactersIn: ":#[]{}&,*!|>'\"%@`"))
    let needsQuotes = value.isEmpty
      || value.rangeOfCharacter(from: unsafeCharacters) != nil
      || ["null", "true", "false", "~"].contains(value.lowercased())

    guard needsQuotes else {
      return value
    }

    let escaped = value
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
    return "\"\(escaped)\""
  }

  static func encodeInlineList(_ tags: [String]) -> String {
    "[\(uniqueDisplayTags(tags).map(encodeScalar).joined(separator: ", "))]"
  }

  static func uniqueDisplayTags(_ tags: [String]) -> [String] {
    var identities = Set<String>()
    return tags.compactMap {
      let display = $0.trimmingCharacters(in: .whitespacesAndNewlines)
      let identity = canonicalTagIdentity(display)
      guard !display.isEmpty, identities.insert(identity).inserted else {
        return nil
      }
      return display
    }
  }
}
