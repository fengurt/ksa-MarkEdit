//
//  ResourceModuleCatalog.swift
//
//  Created by ksamint on 8/1/26.
//

import Foundation

public enum ResourceModuleCatalogClient {
  public static func fetch(from url: URL) async throws -> ResourceModuleCatalogV1 {
    guard url.scheme?.lowercased() == "https" else {
      throw ResourceModuleError.invalidURL
    }
    var request = URLRequest(url: url)
    request.cachePolicy = .returnCacheDataElseLoad
    request.timeoutInterval = 15
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let response = response as? HTTPURLResponse,
          response.statusCode == 200,
          data.count <= 512 * 1024 else {
      throw ResourceModuleError.invalidURL
    }
    let catalog = try JSONDecoder().decode(ResourceModuleCatalogV1.self, from: data)
    guard catalog.isSupported else {
      throw ResourceModuleError.unsupportedSchema(catalog.schemaVersion)
    }
    try catalog.modules.forEach { try $0.validate() }
    return catalog
  }

  public static func fetchModules(
    from url: URL,
    trustStore: ResourceModuleTrustStore
  ) async throws -> [ResourceModuleCatalogEntryV1] {
    let data = try await fetchData(from: url)
    let schema = try JSONDecoder().decode(CatalogSchema.self, from: data)
    switch schema.schemaVersion {
    case ResourceModuleCatalogV2.supportedSchemaVersion:
      let catalog = try JSONDecoder().decode(ResourceModuleCatalogV2.self, from: data)
      try catalog.verifySignature(using: trustStore)
      return catalog.modules
    case ResourceModuleCatalogV1.supportedSchemaVersion:
      // Legacy catalogs remain decodable through fetch(from:) for compatibility,
      // but the install path requires the signed V2 envelope.
      throw ResourceModuleError.unsupportedSchema(schema.schemaVersion)
    default:
      throw ResourceModuleError.unsupportedSchema(schema.schemaVersion)
    }
  }
}

private extension ResourceModuleCatalogClient {
  struct CatalogSchema: Decodable {
    let schemaVersion: Int
  }

  static func fetchData(from url: URL) async throws -> Data {
    guard url.scheme?.lowercased() == "https" else {
      throw ResourceModuleError.invalidURL
    }
    var request = URLRequest(url: url)
    request.cachePolicy = .returnCacheDataElseLoad
    request.timeoutInterval = 15
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let response = response as? HTTPURLResponse,
          response.statusCode == 200,
          data.count <= 512 * 1024 else {
      throw ResourceModuleError.invalidURL
    }
    return data
  }
}
