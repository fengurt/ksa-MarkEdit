//
//  VaultObjectCipherTests.swift
//
//  Created by ksamint on 7/29/26.
//

import CryptoKit
import Foundation
@testable import SharedUI
import XCTest

final class VaultObjectCipherTests: XCTestCase {
  func testRustVectorMatchesSwiftCryptoKit() throws {
    let key = Data(repeating: 7, count: 32)
    let nonce = Data(repeating: 3, count: 12)
    let plaintext = Data("中文 Café 日本語".utf8)
    let fileID = try XCTUnwrap(
      UUID(uuidString: "00000000-0000-0000-0000-000000000001")
    )
    let versionID = try XCTUnwrap(
      UUID(uuidString: "00000000-0000-0000-0000-000000000002")
    )
    let sealed = try VaultObjectCipher.seal(
      plaintext: plaintext,
      masterKey: key,
      fileID: fileID,
      versionID: versionID,
      nonce: nonce
    )
    XCTAssertEqual(sealed.paddedSize, 4_096)
    XCTAssertEqual(
      SHA256.hash(data: sealed.ciphertext).hex,
      "d0081da7a5e15a18bf654858879491fe44d3dd9d0344598236c2d31f8bab2f75"
    )
    XCTAssertEqual(
      sealed.authenticationTag.hex,
      "31cbb902385b28f1e7e462ef7a254f05"
    )
    XCTAssertEqual(
      VaultObjectCipher.authenticatedData(
        fileID: fileID,
        versionID: versionID,
        parentVersionID: nil,
        authentication: VaultObjectAuthentication(
          kind: "markdown",
          mimeType: "text/markdown",
          paddedSize: 4_096
        )
      ).hex,
      "8897186b18731861186d1869186e1874182f187618611875186c1874182d186f1862186a186518631874182f187618310150000000000000000000000000000000015000000000000000000000000000000002f6686d61726b646f776e6d746578742f6d61726b646f776e191000"
    )
    XCTAssertEqual(
      try VaultObjectCipher.open(
        sealed,
        plaintextSize: plaintext.count,
        masterKey: key,
        fileID: fileID,
        versionID: versionID
      ),
      plaintext
    )
  }
}

private extension Sequence where Element == UInt8 {
  var hex: String {
    map { String(format: "%02x", $0) }.joined()
  }
}

private extension Data {
  var hex: String {
    map { String(format: "%02x", $0) }.joined()
  }
}
