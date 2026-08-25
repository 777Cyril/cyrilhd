#!/usr/bin/env node
'use strict';

/*
 * sync-audio.js — reconcile the playlist JSON files with the audio folders.
 *
 * Run by .github/workflows/sync-audio.yml on every push that touches
 * assets/audio/**. Both playlists converge on "the JSON matches the folder":
 * new files are registered, entries whose file is gone are dropped, and
 * duplicates are collapsed.
 *
 * All entry handling lives in scripts/playlist-lib.js so this script, the
 * upload/delete/rename API functions and the client all agree on one shape.
 *
 * Idempotent by construction — a second run reports no changes.
 */

const fs   = require('fs');
const path = require('path');

const lib = require('./playlist-lib.js');

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT     = path.resolve(__dirname, '..');
const SCHEDULE_JSON = path.join(REPO_ROOT, 'assets', 'songs', 'schedule.json');
const PRODUCED_JSON = path.join(REPO_ROOT, 'assets', 'songs', 'produced.json');
const PRODUCED_DIR  = path.join(REPO_ROOT, 'assets', 'audio', 'produced');
const FAVORITES_DIR = path.join(REPO_ROOT, 'assets', 'audio', 'favorites');

// ── Sync one playlist file against one audio folder ──────────────────────────

function syncPlaylist(opts) {
    const { label, jsonPath, listKey, audioDir, dirPrefix, titleFn } = opts;

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(data[listKey])) {
        throw new Error(`${path.basename(jsonPath)}: expected "${listKey}" to be an array`);
    }

    const diskFiles = lib.readAudioFiles(fs, audioDir);
    const before    = JSON.stringify(data[listKey]);

    const { list, added, removed, deduped } = lib.reconcile(
        data[listKey], diskFiles, dirPrefix, titleFn
    );

    if (JSON.stringify(list) === before) {
        console.log(`${label}: already in sync (${list.length} tracks).`);
        return false;
    }

    data[listKey] = list;
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    console.log(`${label}: now ${list.length} tracks.`);
    if (added.length)   { console.log(`  + added ${added.length}:`);   added.forEach(p => console.log(`      + ${p}`)); }
    if (removed.length) { console.log(`  - removed ${removed.length} with no audio file:`); removed.forEach(p => console.log(`      - ${p}`)); }
    if (deduped)        { console.log(`  ~ collapsed ${deduped} duplicate entr${deduped === 1 ? 'y' : 'ies'}`); }

    return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
    // produced filenames carry studio cruft (@mentions, v2, bpm) → scrub them.
    const producedChanged = syncPlaylist({
        label:     'produced.json',
        jsonPath:  PRODUCED_JSON,
        listKey:   'produced',
        audioDir:  PRODUCED_DIR,
        dirPrefix: 'assets/audio/produced',
        titleFn:   lib.deriveTitle,
    });

    // favorites are named by hand — keep the filename verbatim so titles match
    // exactly what the client showed before these entries became objects.
    const favoritesChanged = syncPlaylist({
        label:     'schedule.json',
        jsonPath:  SCHEDULE_JSON,
        listKey:   'favorites',
        audioDir:  FAVORITES_DIR,
        dirPrefix: 'assets/audio/favorites',
        titleFn:   lib.deriveTitleSimple,
    });

    if (!producedChanged && !favoritesChanged) {
        console.log('Audio sync complete — nothing to do.');
    } else {
        console.log('Audio sync complete.');
    }
} catch (err) {
    console.error('Audio sync failed:', err.message);
    process.exit(1);
}
