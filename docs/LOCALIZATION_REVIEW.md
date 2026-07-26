# Localization release review

The localization validator proves structural completeness and placeholder
safety. Human review is still required for natural language, terminology, and
layout.

## Release status

| Locale | Catalog status | Native approval |
| --- | --- | --- |
| Simplified Chinese (`zh-Hans`) | Complete | Existing production locale |
| Traditional Chinese (`zh-Hant`) | Complete | Existing production locale |
| Japanese (`ja`) | Complete draft | Required before public release |
| French (`fr`) | Complete draft | Required before public release |

## Reviewer checklist

Launch the locale-specific `MarkEditMac (ja)` or `MarkEditMac (fr)` scheme and
review:

- Main, context, formatting, spelling, window, and help menus
- General, Editor, Window, and Assistant settings
- Open, save, reopen-with-encoding, find, replace, and statistics surfaces
- Extension install, management, update, and failure dialogs
- Finder commands, Quick Look, and Shortcuts phrases
- Placeholder output for counts, versions, filenames, and extension names
- Text clipping, awkward wrapping, and untranslated English
- Japanese IME composition or French dead-key/diacritic input

Run:

```sh
node Scripts/validate-localizations.mjs
```

Approve by leaving one of these exact comments on the release pull request:

```text
Native Japanese review approved for v1.0.0.
Native French review approved for v1.0.0.
```

The release environment must not be approved until both comments are present.
