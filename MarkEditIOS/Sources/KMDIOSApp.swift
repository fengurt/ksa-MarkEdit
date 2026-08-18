import SwiftUI

@main
struct KMDIOSApp: App {
  @StateObject private var session = DocumentSession()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(session)
        .task {
          await session.restoreDraftAndInbox()
        }
        .onOpenURL { url in
          Task { await session.open(url) }
        }
    }
  }
}

