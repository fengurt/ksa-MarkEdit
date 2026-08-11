import MarkEditKit
import XCTest

final class EditorTextEncodingTests: XCTestCase {
  func testLocalizedLanguageRoundTrips() throws {
    let fixtures: [(EditorTextEncoding, String)] = [
      (.utf8, "Café déjà vu — été"),
      (.windowsLatin1, "Café déjà vu — été"),
      (.gb18030, "简体中文测试"),
      (.big5, "繁體中文測試"),
      (.japaneseEUC, "日本語の文章です。"),
      (.shiftJIS, "日本語の文章です。"),
    ]

    for (encoding, source) in fixtures {
      let data = try XCTUnwrap(encoding.encode(string: source), "Failed to encode using \(encoding)")
      XCTAssertEqual(encoding.decode(data: data), source, "Failed to round-trip using \(encoding)")
    }
  }
}
