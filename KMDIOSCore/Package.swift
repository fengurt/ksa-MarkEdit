// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "KMDIOSCore",
  platforms: [
    .iOS(.v18),
    .macOS(.v15),
  ],
  products: [
    .library(name: "KMDIOSCore", targets: ["KMDIOSCore"]),
  ],
  targets: [
    .target(name: "KMDIOSCore"),
    .testTarget(name: "KMDIOSCoreTests", dependencies: ["KMDIOSCore"]),
  ],
  swiftLanguageModes: [.v6]
)
