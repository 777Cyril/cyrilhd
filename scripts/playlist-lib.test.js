#!/usr/bin/env node
'use strict';

/*
 * Regression tests for scripts/playlist-lib.js.
 *
 * Each test in the first block corresponds to a real defect that silently
 * corrupted assets/songs/schedule.json — it grew to 196 entries for 108 tracks,
 * with 10 references to files that no longer existed. Run with: npm test
 */

const lib = require('./playlist-lib.js');

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log(`  PASS  ${name}`); }
    else { fail++; console.log(`  FAIL  ${name}${detail ? '\n          ' + detail : ''}`); }
}

const FAV = 'assets/audio/favorites';

console.log('\n— Regression: the three bugs that produced the mess —');

// Bug 1: sync-audio.js used `new Set(list).has(pathString)`, which never matched
// an object entry, so every renamed track was re-added as a string duplicate.
const afterRename = [{ title: 'Cash Cow by Pradabagshawty', src: `${FAV}/Cash Cow.mp3` }];
const r1 = lib.reconcile(afterRename, ['Cash Cow.mp3'], FAV, lib.deriveTitleSimple);
check('sync does not duplicate a renamed entry', r1.list.length === 1, `got ${r1.list.length}`);
check('sync preserves the hand-written title', r1.list[0].title === 'Cash Cow by Pradabagshawty');

// Bug 2: upload.js used `Array.includes(pathString)` — same blind spot.
const up = lib.upsert(afterRename, { title: 'Cash Cow', src: `${FAV}/Cash Cow.mp3` }, lib.deriveTitleSimple);
check('upload does not duplicate an object-shaped entry', up.length === 1, `got ${up.length}`);

// Bug 3: delete.js filtered with `entry !== pathString`, which could never match
// an object entry — so deleting a renamed track stranded a broken reference.
check('delete removes an object-shaped entry',
      lib.removeSrc(afterRename, `${FAV}/Cash Cow.mp3`).length === 0);
check('delete still removes a legacy string entry',
      lib.removeSrc([`${FAV}/x.mp3`], `${FAV}/x.mp3`).length === 0);

console.log('\n— Reconcile semantics —');
const messy = [
    { title: 'Real Title', src: `${FAV}/a.mp3` },  // renamed
    `${FAV}/a.mp3`,                                 // string duplicate of the same track
    { title: 'gone', src: `${FAV}/missing.mp3` },   // file no longer exists
    `${FAV}/b.mp3`,                                 // legacy string, file present
];
const disk = ['a.mp3', 'b.mp3', 'c.mp3'];           // c.mp3 present but unlisted
const r2 = lib.reconcile(messy, disk, FAV, lib.deriveTitleSimple);

check('collapses dict+string duplicate', r2.list.filter(e => e.src.endsWith('a.mp3')).length === 1);
check('custom title wins over derived', r2.list.find(e => e.src.endsWith('a.mp3')).title === 'Real Title');
check('drops entry whose file is gone', !r2.list.some(e => e.src.endsWith('missing.mp3')));
check('adds file present on disk but unlisted', r2.list.some(e => e.src.endsWith('c.mp3')));
check('every output entry is an object', r2.list.every(e => typeof e === 'object' && e.title && e.src));
check('reports accurate counts',
      r2.removed.length === 1 && r2.added.length === 1 && r2.deduped === 1,
      JSON.stringify({ removed: r2.removed.length, added: r2.added.length, deduped: r2.deduped }));

// The property whose absence let the list grow without bound.
const r3 = lib.reconcile(r2.list, disk, FAV, lib.deriveTitleSimple);
check('reconcile is idempotent', JSON.stringify(r3.list) === JSON.stringify(r2.list));

console.log('\n— Title strategies —');
// Favorites must render byte-identically to the client's old string rendering
// (getAviDisplayName in scripts.js), or converting entries would rewrite titles.
check('favorites keep original case and punctuation',
      lib.deriveTitleSimple('Johnny Cinco - How Many Times.mp3') === 'Johnny Cinco - How Many Times');
check('produced scrubs @mentions and version tags',
      lib.deriveTitle('All the way (so crazy) v2 @lifecrzy.mp3') === 'all the way (so crazy)',
      `got ${JSON.stringify(lib.deriveTitle('All the way (so crazy) v2 @lifecrzy.mp3'))}`);
check('srcOf handles both shapes',
      lib.srcOf('a/b.mp3') === 'a/b.mp3' && lib.srcOf({ src: 'a/b.mp3' }) === 'a/b.mp3');
check('srcOf tolerates junk', lib.srcOf(null) === null && lib.srcOf({}) === null);

console.log('\n— Serialization —');
const doc = { favorites: [
    { title: 'a "quoted" title', src: `${FAV}/a.mp3` },
    { title: 'Billi0n - ØN THE ROAD', src: `${FAV}/b.mp3` },
]};
const out = lib.stringify(doc, 'favorites');
check('round-trips through JSON.parse', JSON.stringify(JSON.parse(out)) === JSON.stringify(doc));
check('one line per track', out.split('\n').filter(l => l.includes('"src"')).length === 2);
check('ends with a trailing newline', out.endsWith('}\n'));
check('escapes quotes in titles', JSON.parse(out).favorites[0].title === 'a "quoted" title');
check('preserves non-ASCII titles', JSON.parse(out).favorites[1].title === 'Billi0n - ØN THE ROAD');
check('handles an empty list', JSON.parse(lib.stringify({ favorites: [] }, 'favorites')).favorites.length === 0);
check('preserves other top-level keys',
      JSON.parse(lib.stringify({ favorites: [], note: 'keep me' }, 'favorites')).note === 'keep me');
// Adding one track must produce a one-line diff, not a whole-file rewrite.
const grown = lib.stringify({ favorites: doc.favorites.concat([{ title: 'c', src: `${FAV}/c.mp3` }]) }, 'favorites');
const added = grown.split('\n').length - out.split('\n').length;
check('adding a track changes exactly one line', added === 1, `line delta was ${added}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
