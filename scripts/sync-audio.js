#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT     = path.resolve(__dirname, '..');
const SCRIPTS_JS    = path.join(REPO_ROOT, 'scripts.js');
const SCHEDULE_JSON = path.join(REPO_ROOT, 'assets', 'songs', 'schedule.json');
const PRODUCED_DIR  = path.join(REPO_ROOT, 'assets', 'audio', 'produced');
const FAVORITES_DIR = path.join(REPO_ROOT, 'assets', 'audio', 'favorites');

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readAudioFiles(dir) {
  return fs.readdirSync(dir)
    .filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
    .sort();
}

// Derive a human-readable title from a produced filename.
// Strategy (conservative — when uncertain, keep text rather than silently drop):
//   1. Strip file extension
//   2. Strip @mention tokens  (e.g. "@lifecrzy", "@jlitt @fggy")
//   3. Strip standalone version tags  (v2, v3, v10)
//   4. Strip standalone BPM annotations  (87 bpm, 120bpm)
//   5. Strip "pitched up / down"
//   6. Collapse whitespace, trim, lowercase
//   7. Strip trailing orphaned " -" or " –"
//
// Titles auto-derived here can always be manually cleaned up in scripts.js
// after the auto-commit — the script matches by src path, never re-processes
// existing entries.
function deriveTitle(filename) {
  let name = path.basename(filename, path.extname(filename));

  name = name.replace(/@\S+/g, '');                       // @mentions
  name = name.replace(/\bv\d+\b/gi, '');                  // v2, v3, v10
  name = name.replace(/\b\d+\s*bpm\b/gi, '');             // 87 bpm
  name = name.replace(/\bpitched\s+(?:up|down)\b/gi, ''); // pitched up/down
  name = name.replace(/\s+/g, ' ').trim().toLowerCase();
  name = name.replace(/\s[-–]+\s*$/, '').trim();          // trailing " -"

  return name;
}

// ── produced: read existing src values from mcTracks ─────────────────────────
//
// Safe strategy: targeted regex on raw file text — no eval, no AST parser.
// Matches every mcTracks entry object and captures the src string.
function getRegisteredSrcs(fileText) {
  const srcRegex = /\{\s*title\s*:\s*'[^']*'\s*,\s*src\s*:\s*'([^']*)'\s*\}/g;
  const srcs = new Set();
  let match;
  while ((match = srcRegex.exec(fileText)) !== null) {
    srcs.add(match[1]);
  }
  return srcs;
}

// Append new entries to the mcTracks array in scripts.js.
// Uses lastIndexOf('\n    ];') to anchor on the unique closing bracket
// of the mcTracks array (4-space indent + ];). Throws if not found
// rather than silently corrupting the file.
function appendToMcTracks(fileText, newEntries) {
  if (newEntries.length === 0) return fileText;

  const newLines = newEntries
    .map(e => `        { title: '${e.title}', src: '${e.src}' }`)
    .join(',\n');

  const CLOSING = '\n    ];';
  const closingIndex = fileText.lastIndexOf(CLOSING);

  if (closingIndex === -1) {
    throw new Error(
      'Could not locate mcTracks closing bracket "\\n    ];" in scripts.js. ' +
      'The file may have been reformatted. Aborting to avoid corruption.'
    );
  }

  const before = fileText.slice(0, closingIndex);
  const after  = fileText.slice(closingIndex); // starts with "\n    ];"

  return before + ',\n' + newLines + after;
}

// ── Sync favorites → schedule.json ───────────────────────────────────────────

function syncFavorites() {
  const raw      = fs.readFileSync(SCHEDULE_JSON, 'utf8');
  const data     = JSON.parse(raw);
  const existing = new Set(data.favorites);

  const diskFiles = readAudioFiles(FAVORITES_DIR);
  const added = [];

  for (const filename of diskFiles) {
    const filePath = `assets/audio/favorites/${filename}`;
    if (!existing.has(filePath)) {
      data.favorites.push(filePath);
      added.push(filePath);
    }
  }

  if (added.length > 0) {
    fs.writeFileSync(SCHEDULE_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`schedule.json: added ${added.length} favorite(s):`);
    added.forEach(p => console.log(`  + ${p}`));
  } else {
    console.log('schedule.json: no new favorites to add.');
  }
}

// ── Sync produced → mcTracks in scripts.js ───────────────────────────────────

function syncProduced() {
  let fileText   = fs.readFileSync(SCRIPTS_JS, 'utf8');
  const existing = getRegisteredSrcs(fileText);

  const diskFiles = readAudioFiles(PRODUCED_DIR);
  const toAdd = [];

  for (const filename of diskFiles) {
    const src = `assets/audio/produced/${filename}`;
    if (!existing.has(src)) {
      const title = deriveTitle(filename);
      toAdd.push({ title, src });
    }
  }

  if (toAdd.length > 0) {
    fileText = appendToMcTracks(fileText, toAdd);
    fs.writeFileSync(SCRIPTS_JS, fileText, 'utf8');
    console.log(`scripts.js: added ${toAdd.length} produced track(s):`);
    toAdd.forEach(e => console.log(`  + "${e.title}" <- ${e.src}`));
  } else {
    console.log('scripts.js: no new produced tracks to add.');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
  syncProduced();
  syncFavorites();
  console.log('Audio sync complete.');
} catch (err) {
  console.error('Audio sync failed:', err.message);
  process.exit(1);
}
