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
- Local workspace tree, global Unicode search, tags, categories, backlinks, and graph
- Optional on-device Deep Search with a separately downloaded multilingual model
- Offline Web PWA workspace using OPFS with an IndexedDB fallback
- Opt-in local MCP tools constrained to one authorized workspace
- Optional Passkey account and zero-knowledge encrypted backup protocol
- Tencent COS disaster recovery and private GitHub encrypted history
- Independent universal `ksamint-vault` recovery CLI
- Shared TypeScript vault protocol and expiring read-only Agent SDK
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

## Local MCP

The Mac app can serve its current local-first knowledge tools over stdio without
starting the GUI. MCP is disabled unless the executable is explicitly launched
with `--mcp-stdio`, and writes require the separate `--allow-write` opt-in.

```json
{
  "mcpServers": {
    "ksamint-markedit": {
      "command": "/Applications/ksamint MarkEdit.app/Contents/MacOS/ksamint MarkEdit",
      "args": ["--mcp-stdio", "--workspace", "/absolute/path/to/notes"]
    }
  }
}
```

`set_tags`, `set_category`, and `move_to_trash` additionally require
`confirmed: true` on each call. Paths and symlinks cannot escape the selected
workspace, and writes append to `.ksamint/audit.log`.

## Private cloud and recovery

Cloud features are optional and default to off. The Mac app remains fully
functional without an account. When enabled, Markdown, paths, attachments,
vector shards, and manifests are encrypted on the device before upload; the
service receives only ciphertext and synchronization metadata.

The versioned Rust protocol, Passkey/Axum API, Tencent STS integration,
GitHub App token broker, deployment files, and independent recovery CLI live in
[`Cloud`](Cloud/README.md). Permanent provider credentials are never embedded
in the app or Web PWA.

The Web PWA encrypts files and paths before direct upload. On a remote head
change it verifies and decrypts the new snapshot locally, performs a three-way
Markdown merge, and creates timestamped conflict copies for overlapping edits
or delete/edit races instead of silently overwriting either side. The shared
`@ksamint/vault-protocol` package keeps deterministic CBOR and cryptographic
test vectors aligned with Rust. `@ksamint/agent-sdk` verifies signed manifests
and decrypts an explicit, expiring read-only capability inside the Agent
process; the server never receives plaintext searches or keys.

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
- `WebApp`: the shared React/Vite offline knowledge workspace
- `VaultProtocolTS`: shared TypeScript deterministic-CBOR and vault crypto
- `AgentSDK`: remote read-only, client-side-decrypting Agent SDK
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
