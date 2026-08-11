import Foundation
@testable import SharedUI
import XCTest

final class WorkspaceDeepSearchTests: XCTestCase {
  func testPortableBinary16Storage() {
    let values: [Float] = [
      0,
      -Float.zero,
      1,
      -2,
      0.33325,
      65_504,
      Float.leastNonzeroMagnitude,
      .infinity,
      -.infinity,
      .nan,
    ]
    let data = WorkspaceDeepSearch.encodeBinary16(values)
    let decoded = WorkspaceDeepSearch.decodeBinary16(data)

    XCTAssertEqual(data.count, values.count * 2)
    XCTAssertEqual(decoded[0].bitPattern, values[0].bitPattern)
    XCTAssertEqual(decoded[1].bitPattern, values[1].bitPattern)
    XCTAssertEqual(decoded[2], 1)
    XCTAssertEqual(decoded[3], -2)
    XCTAssertEqual(decoded[4], 0.333251953125)
    XCTAssertEqual(decoded[5], 65_504)
    XCTAssertEqual(decoded[6], 0)
    XCTAssertEqual(decoded[7], Float.infinity)
    XCTAssertEqual(decoded[8], -Float.infinity)
    XCTAssertTrue(decoded[9].isNaN)
  }

  func testBinary16StorageUsesStableLittleEndianBytes() {
    XCTAssertEqual(
      WorkspaceDeepSearch.encodeBinary16([1, -2]),
      Data([0x00, 0x3c, 0x00, 0xc0])
    )
  }

  func testCorruptOddLengthEmbeddingIsRejected() {
    XCTAssertTrue(
      WorkspaceDeepSearch.decodeBinary16(Data([0x00])).isEmpty
    )
  }
}
