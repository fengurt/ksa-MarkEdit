//
//  WebBridgeTableOfContents.swift
//
//  Generated using https://github.com/microsoft/ts-gyb
//
//  Don't modify this file manually, it's auto generated.
//
//  To make changes, edit template files under /CoreEditor/src/@codegen

import WebKit
import MarkEditCore

@MainActor
public final class WebBridgeTableOfContents {
  private weak var webView: WKWebView?

  init(webView: WKWebView) {
    self.webView = webView
  }

  public func getTableOfContents() async throws -> [HeadingInfo] {
    guard let webView else {
      throw WKWebView.InvokeError.unexpectedNil
    }

    return try await webView.invoke(path: "webModules.toc.getTableOfContents")
  }

  public func selectPreviousSection(completion: ((Result<Void, WKWebView.InvokeError>) -> Void)? = nil) {
    webView?.invoke(path: "webModules.toc.selectPreviousSection", completion: completion)
  }

  public func selectNextSection(completion: ((Result<Void, WKWebView.InvokeError>) -> Void)? = nil) {
    webView?.invoke(path: "webModules.toc.selectNextSection", completion: completion)
  }

  public func gotoHeader(headingInfo: HeadingInfo, completion: ((Result<Void, WKWebView.InvokeError>) -> Void)? = nil) {
    struct Message: Encodable {
      let headingInfo: HeadingInfo
    }

    let message = Message(
      headingInfo: headingInfo
    )

    webView?.invoke(path: "webModules.toc.gotoHeader", message: message, completion: completion)
  }
}

public struct HeadingInfo: Codable, Equatable, Sendable {
  public var title: String
  public var level: Int
  public var from: Int
  public var to: Int
  public var selected: Bool
  public var sectionEnd: Int
  public var sectionWordCount: Int
  public var documentWordCount: Int
  public var lineStart: Int
  public var lineEnd: Int
  public var directChildCount: Int

  public init(title: String, level: Int, from: Int, to: Int, selected: Bool, sectionEnd: Int, sectionWordCount: Int, documentWordCount: Int, lineStart: Int, lineEnd: Int, directChildCount: Int) {
    self.title = title
    self.level = level
    self.from = from
    self.to = to
    self.selected = selected
    self.sectionEnd = sectionEnd
    self.sectionWordCount = sectionWordCount
    self.documentWordCount = documentWordCount
    self.lineStart = lineStart
    self.lineEnd = lineEnd
    self.directChildCount = directChildCount
  }
}
