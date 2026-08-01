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
}
