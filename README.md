# ksamint MarkEdit

[![macOS 15+](https://img.shields.io/badge/macOS-15%2B-0F4B42)](https://github.com/fengurt/ksa-MarkEdit/releases/latest)
[![Build and test](https://github.com/fengurt/ksa-MarkEdit/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/fengurt/ksa-MarkEdit/actions/workflows/build-and-test.yml)

ksamint MarkEdit is a fast, native Markdown editor for macOS with first-class
Simplified Chinese, Traditional Chinese, Japanese, and French interfaces.
It is an independent localization-focused fork of
[MarkEdit](https://github.com/MarkEdit-app/MarkEdit).

The editor remains small and responsive because localization is compiled into
Apple string catalogs and macOS supplies language selection, spellchecking,
tokenization, and input methods. The CodeMirror editing engine and extension
API stay compatible with upstream MarkEdit.

## Features

- Native AppKit and SwiftUI interface
- Automatic macOS and per-app language selection
- Chinese and Japanese IME-aware editing
- UTF-8, GB 18030, Big 5, EUC-JP, Shift JIS, and other native encodings
- GFM-compatible Markdown powered by CodeMirror 6
- Finder and Quick Look extensions
- Shortcuts, AppleScript, and JavaScript extension support
- Universal Intel and Apple silicon build

## Installation

The signed and notarized release supports macOS 15 or later:

```sh
brew install --cask fengurt/ksamint/ksamint-markedit
open -a "ksamint MarkEdit"
```

Alternatively, download `ksamint-MarkEdit-<version>.dmg` from the
[latest GitHub release](https://github.com/fengurt/ksa-MarkEdit/releases/latest).

Pull requests also produce a universal, ad-hoc-signed development artifact.
Download `ksamint-MarkEdit-development` from the successful GitHub Actions run,
unzip it, and copy `ksamint MarkEdit.app` into `~/Applications`.

## Language review

Every translatable catalog entry is validated for completeness and placeholder
safety in CI. Japanese and French translations are published only after an
explicit native-language review. Translation corrections are welcome through
the [issue tracker](https://github.com/fengurt/ksa-MarkEdit/issues).

## Compatibility

- Deep links use `ksamint-markedit://` so the fork can coexist with MarkEdit.
- Bundle IDs, exported UTIs, containers, and preferences use the
  `art.apuch.ksamint.markedit` namespace.
- The `MarkEdit` JavaScript API, extension registry, AppleScript commands, and
  supported Markdown formats remain compatible with the upstream ecosystem.

Upstream customization and usage documentation remains applicable:
[manual](https://github.com/MarkEdit-app/MarkEdit/wiki/Manual),
[customization](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization),
and [extensions](https://markedit-app.github.io/extensions/).

## Development

The project contains:

- `CoreEditor`: TypeScript, CodeMirror 6, Lezer, Vite, and Jest
- `MarkEditCore` and `MarkEditKit`: shared Swift packages
- `MarkEditMac`: the native macOS app and feature modules
- `FinderExtension` and `PreviewExtension`: native system integrations

Use Node.js 22 and Xcode 26.5:

```sh
cd CoreEditor
corepack enable
yarn install --immutable
yarn build
yarn test
cd ..
node Scripts/validate-localizations.mjs
xcodebuild build -project MarkEdit.xcodeproj -scheme MarkEditMac -destination 'platform=macOS'
```

## Branding and license

The ksamint / 查明 identity and mint/deep-green theme follow the current
[APUCH brand directory](https://apuch.art/brand?brand=ksamint). No unpublished
logo has been invented.

ksamint MarkEdit is distributed under the MIT License. The fork is based on
MarkEdit by Ying Zhong and its contributors; upstream copyright and license
notices are preserved. Built with
[CodeMirror 6](https://codemirror.net/) and
[ts-gyb](https://github.com/microsoft/ts-gyb).
