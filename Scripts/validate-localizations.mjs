#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";

const catalogs = [
  "MarkEditMac/Resources/Localizable.xcstrings",
  "MarkEditMac/mul.lproj/Main.xcstrings",
  "MarkEditMac/AppShortcuts.xcstrings",
  "FinderExtension/Localizable.xcstrings",
  "ConversationCaptureHelper/Localizable.xcstrings",
  "QuickActionExtension/Localizable.xcstrings",
];
const locales = ["zh-Hans", "zh-Hant", "ja", "fr"];
const failures = [];
let checkedEntries = 0;
let localizableCatalog;

function fail(path, key, message) {
  failures.push(`${path}: ${JSON.stringify(key)}: ${message}`);
}

function placeholders(value) {
  const formats = value.match(/%(?:\d+\$)?(?:lld|ld|d|@|f|s)/g) ?? [];
  const substitutions = value.match(/\$\{[^}]+\}/g) ?? [];
  return [...formats.map((item) => item.replace(/^%\d+\$/, "%")), ...substitutions].sort();
}

function assertPlaceholders(path, key, locale, source, target) {
  const expected = placeholders(source);
  const actual = placeholders(target);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(path, key, `${locale} placeholders ${JSON.stringify(actual)} do not match ${JSON.stringify(expected)}`);
  }
}

function sourceLocalization(entry, key) {
  return entry.localizations?.en ?? {
    stringUnit: {
      state: "new",
      value: key,
    },
  };
}

function validatePayload(path, key, locale, source, target) {
  if (target.stringUnit) {
    if (target.stringUnit.state !== "translated") {
      fail(path, key, `${locale} stringUnit state is ${JSON.stringify(target.stringUnit.state)}`);
    }
    if (!target.stringUnit.value.trim()) {
      fail(path, key, `${locale} stringUnit is empty`);
    }
    const sourceValue = source.stringUnit?.value ?? key;
    assertPlaceholders(path, key, locale, sourceValue, target.stringUnit.value);
    return;
  }

  if (target.stringSet) {
    if (target.stringSet.state !== "translated") {
      fail(path, key, `${locale} stringSet state is ${JSON.stringify(target.stringSet.state)}`);
    }
    const sourceValues = source.stringSet?.values ?? [key];
    if (target.stringSet.values.length !== sourceValues.length) {
      fail(path, key, `${locale} stringSet length does not match source`);
      return;
    }
    target.stringSet.values.forEach((value, index) => {
      if (!value.trim()) {
        fail(path, key, `${locale} stringSet value ${index} is empty`);
      }
      assertPlaceholders(path, key, locale, sourceValues[index], value);
    });
    return;
  }

  if (target.variations?.plural) {
    const sourcePlural = source.variations?.plural;
    const requiredCategories = locale === "fr" ? ["one", "other"] : ["other"];
    for (const category of requiredCategories) {
      const targetCategory = target.variations.plural[category];
      if (!targetCategory) {
        fail(path, key, `${locale} is missing plural category ${category}`);
        continue;
      }
      const sourceCategory = sourcePlural?.[category] ?? sourcePlural?.other ?? sourcePlural?.one;
      validatePayload(path, key, locale, sourceCategory ?? source, targetCategory);
    }
    return;
  }

  fail(path, key, `${locale} has an unsupported localization payload`);
}

for (const path of catalogs) {
  const catalog = JSON.parse(await readFile(path, "utf8"));
  if (path === "MarkEditMac/Resources/Localizable.xcstrings") {
    localizableCatalog = catalog;
  }
  if (catalog.sourceLanguage !== "en") {
    failures.push(`${path}: sourceLanguage must be en`);
  }

  for (const [key, entry] of Object.entries(catalog.strings)) {
    if (entry.shouldTranslate === false) {
      continue;
    }
    if (entry.extractionState === "stale") {
      fail(path, key, "entry is stale");
    }

    const source = sourceLocalization(entry, key);
    for (const locale of locales) {
      const target = entry.localizations?.[locale];
      if (!target) {
        fail(path, key, `missing ${locale} localization`);
        continue;
      }
      validatePayload(path, key, locale, source, target);
      checkedEntries += 1;
    }
  }
}

async function swiftFiles(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${item.name}`;
    if (item.isDirectory()) {
      result.push(...await swiftFiles(path));
    } else if (item.name.endsWith(".swift")) {
      result.push(path);
    }
  }
  return result;
}

for (const path of await swiftFiles("MarkEditMac/Sources")) {
  const source = await readFile(path, "utf8");
  const pattern = /String\(localized:\s*"((?:\\.|[^"])*)"/g;
  for (const match of source.matchAll(pattern)) {
    const key = JSON.parse(`"${match[1]}"`);
    if (!localizableCatalog.strings[key]) {
      failures.push(`${path}: localized source key ${JSON.stringify(key)} is missing from Localizable.xcstrings`);
    }
  }
}

const project = await readFile("MarkEdit.xcodeproj/project.pbxproj", "utf8");
for (const locale of locales) {
  if (!project.includes(locale)) {
    failures.push(`MarkEdit.xcodeproj/project.pbxproj: missing known region ${locale}`);
  }
  const infoPath = `MarkEditMac/${locale}.lproj/InfoPlist.strings`;
  const info = await readFile(infoPath, "utf8");
  for (const key of ["CFBundleDisplayName", "CFBundleName"]) {
    if (!info.includes(`"${key}"`)) {
      failures.push(`${infoPath}: missing ${key}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`Localization validation failed with ${failures.length} error(s).`);
  process.exit(1);
}

console.log(`Localization validation passed for ${checkedEntries} localized catalog entries.`);
