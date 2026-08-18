import Foundation

public struct MarkdownHeading: Identifiable, Equatable, Sendable {
  public var id: Int { startUTF16 }
  public let level: Int
  public let title: String
  public let startUTF16: Int
  public let contentWordCount: Int
  public let documentRatio: Double

  public init(
    level: Int,
    title: String,
    startUTF16: Int,
    contentWordCount: Int,
    documentRatio: Double
  ) {
    self.level = level
    self.title = title
    self.startUTF16 = startUTF16
    self.contentWordCount = contentWordCount
    self.documentRatio = documentRatio
  }
}

public struct MarkdownOutlineNode: Identifiable, Equatable, Sendable {
  public var id: Int { heading.id }
  public let heading: MarkdownHeading
  public let children: [MarkdownOutlineNode]

  public init(heading: MarkdownHeading, children: [MarkdownOutlineNode]) {
    self.heading = heading
    self.children = children
  }
}

public struct MarkdownOutline: Equatable, Sendable {
  public let totalWordCount: Int
  public let headings: [MarkdownHeading]
  public let roots: [MarkdownOutlineNode]

  public init(totalWordCount: Int, headings: [MarkdownHeading], roots: [MarkdownOutlineNode]) {
    self.totalWordCount = totalWordCount
    self.headings = headings
    self.roots = roots
  }
}

public enum MarkdownOutlineParser {
  public static func parse(_ text: String) -> MarkdownOutline {
    let rawHeadings = collectHeadings(text)
    let source = text as NSString
    let totalWordCount = TextMetrics.wordCount(in: text)

    let headings = rawHeadings.enumerated().map { index, raw in
      let end = rawHeadings[(index + 1)...].first(where: { $0.level <= raw.level })?.startUTF16
        ?? source.length
      let contentRange = NSRange(
        location: min(raw.contentStartUTF16, end),
        length: max(0, end - raw.contentStartUTF16)
      )
      let wordCount = TextMetrics.wordCount(in: source.substring(with: contentRange))
      return MarkdownHeading(
        level: raw.level,
        title: raw.title,
        startUTF16: raw.startUTF16,
        contentWordCount: wordCount,
        documentRatio: totalWordCount == 0 ? 0 : Double(wordCount) / Double(totalWordCount)
      )
    }

    var index = 0
    let roots = buildNodes(headings, index: &index, parentLevel: 0)
    return MarkdownOutline(totalWordCount: totalWordCount, headings: headings, roots: roots)
  }
}

public enum TextMetrics {
  public static func wordCount(in text: String) -> Int {
    var count = 0
    var inLatinWord = false

    for scalar in text.unicodeScalars {
      if isCJK(scalar) {
        if inLatinWord {
          count += 1
          inLatinWord = false
        }
        count += 1
      } else if CharacterSet.alphanumerics.contains(scalar) || scalar == "_" {
        inLatinWord = true
      } else if inLatinWord {
        count += 1
        inLatinWord = false
      }
    }

    return count + (inLatinWord ? 1 : 0)
  }

  private static func isCJK(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x2E80...0x2FFF,
         0x3040...0x30FF,
         0x31F0...0x31FF,
         0x3400...0x4DBF,
         0x4E00...0x9FFF,
         0xAC00...0xD7AF,
         0xF900...0xFAFF,
         0x20000...0x2FA1F:
      return true
    default:
      return false
    }
  }
}

private struct RawHeading {
  let level: Int
  let title: String
  let startUTF16: Int
  let contentStartUTF16: Int
}

private struct MarkdownLine {
  let text: String
  let startUTF16: Int
  let endUTF16: Int
}

private extension MarkdownOutlineParser {
  static let atxExpression = try! NSRegularExpression(
    pattern: #"^ {0,3}(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$"#
  )
  static let setextExpression = try! NSRegularExpression(pattern: #"^ {0,3}(=+|-+)[\t ]*$"#)

  static func collectHeadings(_ text: String) -> [RawHeading] {
    let lines = splitLines(text)
    var results = [RawHeading]()
    var fenceMarker: Character?
    var fenceLength = 0

    for (index, line) in lines.enumerated() {
      let trimmed = line.text.trimmingCharacters(in: .whitespaces)
      if let fence = fencePrefix(trimmed) {
        if fenceMarker == nil {
          fenceMarker = fence.marker
          fenceLength = fence.length
        } else if fence.marker == fenceMarker, fence.length >= fenceLength {
          fenceMarker = nil
          fenceLength = 0
        }
        continue
      }

      guard fenceMarker == nil else { continue }

      let range = NSRange(location: 0, length: (line.text as NSString).length)
      if let match = atxExpression.firstMatch(in: line.text, range: range) {
        let source = line.text as NSString
        let hashes = source.substring(with: match.range(at: 1))
        let title = source.substring(with: match.range(at: 2)).trimmingCharacters(in: .whitespaces)
        if !title.isEmpty {
          results.append(RawHeading(
            level: hashes.count,
            title: title,
            startUTF16: line.startUTF16,
            contentStartUTF16: line.endUTF16
          ))
        }
        continue
      }

      guard index > 0,
            !lines[index - 1].text.trimmingCharacters(in: .whitespaces).isEmpty,
            let match = setextExpression.firstMatch(in: line.text, range: range) else {
        continue
      }

      let marker = (line.text as NSString).substring(with: match.range(at: 1))
      let previous = lines[index - 1]
      results.append(RawHeading(
        level: marker.first == "=" ? 1 : 2,
        title: previous.text.trimmingCharacters(in: .whitespaces),
        startUTF16: previous.startUTF16,
        contentStartUTF16: line.endUTF16
      ))
    }

    return results
  }

  static func splitLines(_ text: String) -> [MarkdownLine] {
    let source = text as NSString
    guard source.length > 0 else { return [] }

    var lines = [MarkdownLine]()
    var location = 0
    while location < source.length {
      let lineRange = source.lineRange(for: NSRange(location: location, length: 0))
      var contentLength = lineRange.length
      while contentLength > 0 {
        let scalar = source.character(at: lineRange.location + contentLength - 1)
        guard scalar == 10 || scalar == 13 else { break }
        contentLength -= 1
      }
      lines.append(MarkdownLine(
        text: source.substring(with: NSRange(location: lineRange.location, length: contentLength)),
        startUTF16: lineRange.location,
        endUTF16: NSMaxRange(lineRange)
      ))
      location = NSMaxRange(lineRange)
    }
    return lines
  }

  static func fencePrefix(_ text: String) -> (marker: Character, length: Int)? {
    guard let first = text.first, first == "`" || first == "~" else { return nil }
    let count = text.prefix(while: { $0 == first }).count
    return count >= 3 ? (first, count) : nil
  }

  static func buildNodes(
    _ headings: [MarkdownHeading],
    index: inout Int,
    parentLevel: Int
  ) -> [MarkdownOutlineNode] {
    var nodes = [MarkdownOutlineNode]()
    while index < headings.count {
      let heading = headings[index]
      guard heading.level > parentLevel else { break }
      index += 1
      let children = buildNodes(headings, index: &index, parentLevel: heading.level)
      nodes.append(MarkdownOutlineNode(heading: heading, children: children))
    }
    return nodes
  }
}
