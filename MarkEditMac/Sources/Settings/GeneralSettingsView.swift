//
//  GeneralSettingsView.swift
//  MarkEditMac
//
//  Created by cyan on 1/26/23.
//

import SwiftUI
import SettingsUI
import MarkEditKit
import SharedUI

@MainActor
struct GeneralSettingsView: View {
  @State private var appearance = AppPreferences.General.appearance
  @State private var newWindowBehavior = AppPreferences.General.newWindowBehavior
  @State private var quitAlwaysKeepsWindows = AppPreferences.General.quitAlwaysKeepsWindows
  @State private var newFilenameExtension = AppPreferences.General.newFilenameExtension
  @State private var defaultTextEncoding = AppPreferences.General.defaultTextEncoding
  @State private var defaultLineEndings = AppPreferences.General.defaultLineEndings
  @State private var conversationCaptureEnabled = AppPreferences.General.conversationCaptureEnabled
  @State private var conversationCaptureSyncInterval =
    AppPreferences.General.conversationCaptureSyncInterval
  @State private var captureServiceState = ConversationCaptureCoordinator.shared.serviceState

  var body: some View {
    SettingsForm {
      Section {
        Picker(Localized.Settings.appearance, selection: $appearance) {
          Text(Localized.Settings.system).tag(Appearance.system)
          Divider()
          Text(Localized.Settings.light).tag(Appearance.light)
          Text(Localized.Settings.dark).tag(Appearance.dark)
        }
        .onChange(of: appearance) {
          NSApp.appearance = appearance.resolved()
          AppPreferences.General.appearance = appearance
        }
        .formMenuPicker()

        Picker(Localized.Settings.newWindowBehavior, selection: $newWindowBehavior) {
          Text(Localized.Document.openDocument).tag(NewWindowBehavior.openDocument)
          Text(Localized.Document.newDocument).tag(NewWindowBehavior.newDocument)
        }
        .onChange(of: newWindowBehavior) {
          AppPreferences.General.newWindowBehavior = newWindowBehavior
        }
        .formMenuPicker()

        Toggle(Localized.Settings.quitAlwaysKeepsWindows, isOn: $quitAlwaysKeepsWindows)
          .onChange(of: quitAlwaysKeepsWindows) {
            AppPreferences.General.quitAlwaysKeepsWindows = quitAlwaysKeepsWindows
          }
          .formLabel(Localized.Settings.windowRestoration)
          .formBreathingInset()
      }

      Section {
        Picker(Localized.Settings.newFilenameExtension, selection: $newFilenameExtension) {
          ForEach(NewFilenameExtension.allCases, id: \.self) {
            Text($0.rawValue).tag($0)
          }
        }
        .onChange(of: newFilenameExtension) {
          AppPreferences.General.newFilenameExtension = newFilenameExtension
        }
        .formMenuPicker()

        Picker(Localized.Settings.defaultTextEncoding, selection: $defaultTextEncoding) {
          ForEach(EditorTextEncoding.allCases, id: \.self) {
            Text($0.localizedDescription)

            if EditorTextEncoding.groupingCases.contains($0) {
              Divider()
            }
          }
        }
        .onChange(of: defaultTextEncoding) {
          AppPreferences.General.defaultTextEncoding = defaultTextEncoding
        }
        .formMenuPicker()

        Picker(Localized.Settings.defaultLineEndings, selection: $defaultLineEndings) {
          Text(Localized.Settings.macOSLineEndings).tag(LineEndings.lf)
          Text(Localized.Settings.windowsLineEndings).tag(LineEndings.crlf)
          Text(Localized.Settings.classicMacLineEndings).tag(LineEndings.cr)
        }
        .onChange(of: defaultLineEndings) {
          AppPreferences.General.defaultLineEndings = defaultLineEndings
        }
        .formMenuPicker()
      }

      Section {
        VStack(alignment: .leading, spacing: 8) {
          Toggle("Capture conversations from clipboard", isOn: $conversationCaptureEnabled)
            .onChange(of: conversationCaptureEnabled) {
              ConversationCaptureCoordinator.shared.setEnabled(conversationCaptureEnabled)
              refreshCaptureServiceState()
            }

          Label(
            captureServiceState.localizedDescription,
            systemImage: captureServiceState.systemImage
          )
            .font(.caption)
            .foregroundStyle(Color(nsColor: captureServiceState.color))

          if captureServiceState == .approvalRequired {
            Button("Open Login Item Settings…") {
              ConversationCaptureCoordinator.shared.openPermissionSettings()
            }
          }

          HStack {
            Button("Open Capture History") {
              ConversationCaptureCoordinator.shared.openCaptureHistory()
            }
            Button("Search Captures") {
              ConversationCaptureCoordinator.shared.searchCaptureHistory()
            }
          }

          Text("High-confidence Claude and ChatGPT transcripts are saved locally to Conversations. Other text stays encrypted for 30 days until reviewed. Clipboard capture does not request Accessibility, Screen Recording, or keyboard access.")
            .formDescription()
            .frame(width: 360, alignment: .leading)
        }
        .formLabel(alignment: .top, String(localized: "Conversation Inbox"))

        Picker("Encrypted cloud sync", selection: $conversationCaptureSyncInterval) {
          ForEach(ConversationCaptureSyncInterval.allCases) { interval in
            Text(interval.localizedTitle).tag(interval)
          }
        }
        .onChange(of: conversationCaptureSyncInterval) {
          AppPreferences.General.conversationCaptureSyncInterval = conversationCaptureSyncInterval
          ConversationCaptureCoordinator.shared.synchronizeHelperConfiguration()
        }
        .formMenuPicker()

        Text("Captured conversations are always saved locally immediately. This interval applies only after end-to-end encrypted cloud sync is enabled.")
          .font(.caption)
          .foregroundStyle(.secondary)
          .frame(width: 360, alignment: .leading)
      }
    }
    .onAppear(perform: refreshCaptureServiceState)
    .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
      refreshCaptureServiceState()
    }
  }

  private func refreshCaptureServiceState() {
    captureServiceState = ConversationCaptureCoordinator.shared.serviceState
  }
}
