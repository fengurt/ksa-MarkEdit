//
//  AppHacks.swift
//  MarkEditMac
//
//  Created by cyan on 12/12/23.
//

import AppKit
import MarkEditKit

// [macOS 14] Performance regression, there's a good chance to hang at launch
extension NSObject {
  /**
   Loading this bundle is extremely slow, move it to background thread with method swizzling.
   */
  static let swizzleAccessibilityBundlesOnce: () = {
    guard let axbbmClass else {
      return Logger.assertFail("Failed to get the class to swizzle")
    }

    let originalSelector = sel_getUid("loadAXBundles")
    let swizzledSelector = #selector(swizzled_loadAXBundles)

    guard let originalMethod = class_getInstanceMethod(axbbmClass, originalSelector), let swizzledMethod = class_getInstanceMethod(NSObject.self, swizzledSelector) else {
      return Logger.assertFail("Failed to get the method to swizzle")
    }

    safelyExchangeMethods(
      type: axbbmClass,
      originalSelector: originalSelector,
      originalMethod: originalMethod,
      swizzledSelector: swizzledSelector,
      swizzledMethod: swizzledMethod
    )
  }()
}

// MARK: - Private

private extension NSObject {
  enum States {
    static let loadGate = AccessibilityBundleLoadGate()
  }

  @objc func swizzled_loadAXBundles() -> Bool {
    guard States.loadGate.beginLoading() else {
      return false
    }

    guard !NSWorkspace.shared.isVoiceOverEnabled else {
      return self.swizzled_loadAXBundles()
    }

    let loader = AccessibilityBundleLoader(object: self)
    DispatchQueue.global(qos: .userInitiated).async {
      loader.load()
    }

    return true
  }
}

private final class AccessibilityBundleLoadGate: @unchecked Sendable {
  private let lock = NSLock()
  private var loaded = false

  func beginLoading() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    guard !loaded else { return false }
    loaded = true
    return true
  }
}

private final class AccessibilityBundleLoader: @unchecked Sendable {
  private let object: NSObject

  init(object: NSObject) {
    self.object = object
  }

  func load() {
    _ = object.swizzled_loadAXBundles()
  }
}
