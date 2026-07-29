//
//  VaultObjectCipher.swift
//
//  Swift implementation of the VaultObjectV1 cryptographic core.
//

import CryptoKit
import Foundation
import Security

public struct VaultObjectCiphertext: Sendable, Equatable {
  public let nonce: Data
  public let ciphertext: Data
  public let authenticationTag: Data
  public let paddedSize: Int

  public init(
    nonce: Data,
    ciphertext: Data,
    authenticationTag: Data,
    paddedSize: Int
  ) {
    self.nonce = nonce
    self.ciphertext = ciphertext
    self.authenticationTag = authenticationTag
    self.paddedSize = paddedSize
  }
}

public struct VaultObjectAuthentication: Sendable, Equatable {
  public let kind: String
  public let mimeType: String
  public let paddedSize: Int

  public init(kind: String, mimeType: String, paddedSize: Int) {
    self.kind = kind
    self.mimeType = mimeType
    self.paddedSize = paddedSize
  }
}

public enum VaultObjectCipher {
  public static let paddingBlockSize = 4_096

  public static func seal(
    plaintext: Data,
    masterKey: Data,
    fileID: UUID,
    versionID: UUID,
    parentVersionID: UUID? = nil,
    kind: String = "markdown",
    mimeType: String = "text/markdown",
    nonce: Data? = nil
  ) throws -> VaultObjectCiphertext {
    guard masterKey.count == 32 else {
      throw VaultCipherError.invalidKey
    }
    let paddedSize = max(
      paddingBlockSize,
      ((plaintext.count + paddingBlockSize - 1) / paddingBlockSize) * paddingBlockSize
    )
    var padded = plaintext
    padded.append(Data(repeating: 0, count: paddedSize - plaintext.count))
    let nonce = try nonce ?? randomData(count: 12)
    let sealed = try AES.GCM.seal(
      padded,
      using: objectKey(masterKey: masterKey, fileID: fileID, versionID: versionID),
      nonce: AES.GCM.Nonce(data: nonce),
      authenticating: authenticatedData(
        fileID: fileID,
        versionID: versionID,
        parentVersionID: parentVersionID,
        authentication: VaultObjectAuthentication(
          kind: kind,
          mimeType: mimeType,
          paddedSize: paddedSize
        )
      )
    )
    return VaultObjectCiphertext(
      nonce: nonce,
      ciphertext: sealed.ciphertext,
      authenticationTag: sealed.tag,
      paddedSize: paddedSize
    )
  }

  public static func open(
    _ value: VaultObjectCiphertext,
    plaintextSize: Int,
    masterKey: Data,
    fileID: UUID,
    versionID: UUID,
    parentVersionID: UUID? = nil,
    kind: String = "markdown",
    mimeType: String = "text/markdown"
  ) throws -> Data {
    guard masterKey.count == 32,
          value.nonce.count == 12,
          value.authenticationTag.count == 16,
          value.paddedSize == value.ciphertext.count,
          value.paddedSize >= paddingBlockSize,
          value.paddedSize.isMultiple(of: paddingBlockSize),
          plaintextSize >= 0,
          plaintextSize <= value.ciphertext.count
    else {
      throw VaultCipherError.invalidCiphertext
    }
    let box = try AES.GCM.SealedBox(
      nonce: AES.GCM.Nonce(data: value.nonce),
      ciphertext: value.ciphertext,
      tag: value.authenticationTag
    )
    let plaintext = try AES.GCM.open(
      box,
      using: objectKey(masterKey: masterKey, fileID: fileID, versionID: versionID),
      authenticating: authenticatedData(
        fileID: fileID,
        versionID: versionID,
        parentVersionID: parentVersionID,
        authentication: VaultObjectAuthentication(
          kind: kind,
          mimeType: mimeType,
          paddedSize: value.paddedSize
        )
      )
    )
    return plaintext.prefix(plaintextSize)
  }

  public static func authenticatedData(
    fileID: UUID,
    versionID: UUID,
    parentVersionID: UUID?,
    authentication: VaultObjectAuthentication
  ) -> Data {
    var encoder = VaultCBOR()
    encoder.array(8)
    // serde serializes a plain &[u8] as an array of unsigned integers.
    let domain = Data("ksamint/vault-object/v1".utf8)
    encoder.array(domain.count)
    domain.forEach { encoder.unsigned(UInt64($0)) }
    encoder.unsigned(1)
    encoder.bytes(fileID.vaultBytes)
    encoder.bytes(versionID.vaultBytes)
    if let parentVersionID {
      encoder.bytes(parentVersionID.vaultBytes)
    } else {
      encoder.null()
    }
    encoder.text(authentication.kind)
    encoder.text(authentication.mimeType)
    encoder.unsigned(UInt64(authentication.paddedSize))
    return encoder.data
  }

  private static func objectKey(
    masterKey: Data,
    fileID: UUID,
    versionID: UUID
  ) -> SymmetricKey {
    let info = Data("object".utf8) + fileID.vaultBytes + versionID.vaultBytes
    return HKDF<SHA256>.deriveKey(
      inputKeyMaterial: SymmetricKey(data: masterKey),
      salt: Data("ksamint/vault/v1".utf8),
      info: info,
      outputByteCount: 32
    )
  }

  private static func randomData(count: Int) throws -> Data {
    var bytes = [UInt8](repeating: 0, count: count)
    guard SecRandomCopyBytes(kSecRandomDefault, count, &bytes) == errSecSuccess else {
      throw VaultCipherError.randomnessUnavailable
    }
    return Data(bytes)
  }
}

public actor VaultKeychain {
  private let service: String

  public init(service: String = "art.apuch.ksamint.markedit.vault") {
    self.service = service
  }

  public func createMasterKey(vaultID: UUID) throws -> Data {
    if let existing = try masterKey(vaultID: vaultID) {
      return existing
    }
    var value = [UInt8](repeating: 0, count: 32)
    guard SecRandomCopyBytes(kSecRandomDefault, value.count, &value) == errSecSuccess else {
      throw VaultCipherError.randomnessUnavailable
    }
    let data = Data(value)
    let status = SecItemAdd(
      [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: vaultID.uuidString,
        kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecValueData: data,
      ] as CFDictionary,
      nil
    )
    guard status == errSecSuccess else {
      throw VaultCipherError.keychain(status)
    }
    return data
  }

  public func masterKey(vaultID: UUID) throws -> Data? {
    var result: CFTypeRef?
    let status = SecItemCopyMatching(
      [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: vaultID.uuidString,
        kSecReturnData: true,
        kSecMatchLimit: kSecMatchLimitOne,
      ] as CFDictionary,
      &result
    )
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = result as? Data, data.count == 32 else {
      throw VaultCipherError.keychain(status)
    }
    return data
  }

  public func deleteMasterKey(vaultID: UUID) throws {
    let status = SecItemDelete(
      [
        kSecClass: kSecClassGenericPassword,
        kSecAttrService: service,
        kSecAttrAccount: vaultID.uuidString,
      ] as CFDictionary
    )
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw VaultCipherError.keychain(status)
    }
  }
}

public enum VaultCipherError: LocalizedError {
  case invalidKey
  case invalidCiphertext
  case randomnessUnavailable
  case keychain(OSStatus)

  public var errorDescription: String? {
    switch self {
    case .invalidKey:
      "The Vault Master Key must contain 256 bits."
    case .invalidCiphertext:
      "The encrypted Vault object is invalid."
    case .randomnessUnavailable:
      "Secure randomness is unavailable."
    case let .keychain(status):
      "Keychain operation failed (\(status))."
    }
  }
}

private struct VaultCBOR {
  private(set) var data = Data()

  mutating func unsigned(_ value: UInt64) {
    major(0, value: value)
  }

  mutating func bytes(_ value: Data) {
    major(2, value: UInt64(value.count))
    data.append(value)
  }

  mutating func text(_ value: String) {
    let bytes = Data(value.utf8)
    major(3, value: UInt64(bytes.count))
    data.append(bytes)
  }

  mutating func array(_ count: Int) {
    major(4, value: UInt64(count))
  }

  mutating func null() {
    data.append(0xf6)
  }

  private mutating func major(_ type: UInt8, value: UInt64) {
    let prefix = type << 5
    switch value {
    case 0..<24:
      data.append(prefix | UInt8(value))
    case 24...UInt64(UInt8.max):
      data.append(prefix | 24)
      data.append(UInt8(value))
    case 256...UInt64(UInt16.max):
      data.append(prefix | 25)
      appendBigEndian(UInt16(value))
    case 65_536...UInt64(UInt32.max):
      data.append(prefix | 26)
      appendBigEndian(UInt32(value))
    default:
      data.append(prefix | 27)
      appendBigEndian(value)
    }
  }

  private mutating func appendBigEndian<T: FixedWidthInteger>(_ value: T) {
    var value = value.bigEndian
    withUnsafeBytes(of: &value) {
      data.append(contentsOf: $0)
    }
  }
}

private extension UUID {
  var vaultBytes: Data {
    withUnsafeBytes(of: uuid) { Data($0) }
  }
}
