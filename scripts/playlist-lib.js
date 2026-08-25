'use strict';

/*
 * playlist-lib.js — the single definition of what a playlist entry is.
 *
 * Shared by scripts/sync-audio.js (GitHub Action) and the api/* Vercel
 * functions so every writer agrees on one shape. Previously each writer had
 * its own idea: rename.js read both shapes and wrote objects, while
 * sync-audio.js, upload.js and delete.js assumed plain strings. Their string
 * comparisons silently missed object entries, which duplicated tracks on every
 * sync and left deleted tracks behind as broken references.
 *
 * Canonical shape is { title, src } — what produced.json already used, and the
 * reason produced.json never rotted the way schedule.json did.
 *
 * Legacy plain-string entries are still READ (old commits contain them), but
 * are never written back out.
 */

const path = require('path');

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a']);

// ── Shape handling ───────────────────────────────────────────────────────────

// Accepts either shape. Mirrors the client's own normalization in
// scripts.js (`typeof track === 'object' ? track.src : track`).
function srcOf(entry) {
    if (!entry) return null;
    return typeof entry === 'object' ? (entry.src || null) : entry;
}

// Title for a favorites track: the filename, minus extension, untouched.
// Must stay byte-identical to how the client rendered legacy string entries
// (getAviDisplayName in scripts.js) so converting those entries to objects
// doesn't visibly change a single title. Favorites are named by hand and
// already read well — anything cleverer only destroys information.
function deriveTitleSimple(filename) {
    return path.basename(filename, path.extname(filename));
}

// Title for a produced track. These filenames carry studio cruft
// ("All the way (so crazy) v2 @lifecrzy.mp3") so they get scrubbed.
// Conservative — when uncertain, keep text rather than silently drop it:
//   1. Strip extension                     5. Strip "pitched up/down"
//   2. Strip @mention tokens               6. Collapse whitespace, lowercase
//   3. Strip standalone version tags       7. Strip trailing orphaned " -"
//   4. Strip standalone BPM annotations
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

// Coerce any entry into canonical { title, src }.
// `titleFn` decides how a legacy string entry earns a title; entries that
// already carry one keep it verbatim.
function normalize(entry, titleFn) {
    const src = srcOf(entry);
    if (!src) return null;
    const derive = titleFn || deriveTitleSimple;
    const title = (typeof entry === 'object' && entry.title)
        ? entry.title
        : derive(src);
    return { title, src };
}

// True when the title is one a person typed rather than one we'd derive anyway.
// Used to decide which of two duplicates to keep — a hand-written title always
// wins over a machine-derived one.
function hasCustomTitle(entry, titleFn) {
    if (!entry || typeof entry !== 'object' || !entry.title) return false;
    const src = srcOf(entry);
    if (!src) return false;
    const derive = titleFn || deriveTitleSimple;
    return entry.title !== deriveTitleSimple(src) && entry.title !== derive(src);
}

// ── Shape-agnostic list operations ───────────────────────────────────────────
// These are the functions whose absence caused the rot: every writer must
// compare by src, never by identity against a raw string.

function hasSrc(list, src) {
    return list.some(e => srcOf(e) === src);
}

function removeSrc(list, src) {
    return list.filter(e => srcOf(e) !== src);
}

// Add if absent; never create a second copy of the same src.
function upsert(list, entry, titleFn) {
    const normalized = normalize(entry, titleFn);
    if (!normalized) return list;
    if (hasSrc(list, normalized.src)) return list;
    return list.concat([normalized]);
}

// ── Reconciliation ───────────────────────────────────────────────────────────

function readAudioFiles(fs, dir) {
    return fs.readdirSync(dir)
        .filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
        .sort();
}

/*
 * Converge a playlist onto the actual contents of its audio folder.
 *
 * - de-duplicates by src, preferring the copy carrying a hand-written title
 * - drops entries whose audio file is gone (the broken-reference class)
 * - appends files present on disk but missing from the list
 * - normalizes every survivor to { title, src }
 *
 * Idempotent: running it twice produces no further change. That property is
 * what makes the list structurally unable to drift again.
 *
 * Returns { list, added, removed, deduped }.
 */
function reconcile(list, diskFiles, dirPrefix, titleFn) {
    const derive = titleFn || deriveTitleSimple;
    const onDisk = new Set(diskFiles);
    const bySrc = new Map();
    const removed = [];
    let deduped = 0;

    for (const entry of list) {
        const src = srcOf(entry);
        if (!src) continue;

        const filename = src.split('/').pop();
        if (!onDisk.has(filename)) {
            removed.push(src);
            continue;
        }

        const existing = bySrc.get(src);
        if (!existing) {
            bySrc.set(src, entry);
            continue;
        }

        deduped++;
        // Keep whichever copy carries a real, hand-written title.
        if (!hasCustomTitle(existing, derive) && hasCustomTitle(entry, derive)) {
            bySrc.set(src, entry);
        }
    }

    const result = Array.from(bySrc.values()).map(e => normalize(e, derive));

    const added = [];
    for (const filename of diskFiles) {
        const src = `${dirPrefix}/${filename}`;
        if (!bySrc.has(src)) {
            result.push({ title: derive(filename), src });
            added.push(src);
        }
    }

    return { list: result, added, removed, deduped };
}

module.exports = {
    AUDIO_EXTS,
    srcOf,
    deriveTitle,
    deriveTitleSimple,
    normalize,
    hasCustomTitle,
    hasSrc,
    removeSrc,
    upsert,
    readAudioFiles,
    reconcile,
};
