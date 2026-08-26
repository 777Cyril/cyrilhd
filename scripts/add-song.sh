#!/usr/bin/env bash
#
# add-song.sh — publish audio files you dropped into the local folders.
#
#   1. drag an mp3 into assets/audio/favorites/  (avatar playlist)
#                    or assets/audio/produced/   (produced playlist)
#   2. run: npm run add-song
#
# Stages the new audio, commits, pushes. From there the sync-audio workflow
# registers each track in its playlist JSON and Vercel deploys.
#
# Only touches the two audio folders — never picks up unrelated edits.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FAVORITES="assets/audio/favorites"
PRODUCED="assets/audio/produced"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "error: not a git repository" >&2
    exit 1
fi

# What's new or changed in the audio folders?
PENDING="$(git status --porcelain -- "$FAVORITES" "$PRODUCED")"

if [ -z "$PENDING" ]; then
    echo "Nothing new in $FAVORITES or $PRODUCED."
    echo "Drop an audio file into one of them, then run this again."
    exit 0
fi

echo "Pending audio changes:"
echo "$PENDING" | sed 's/^/  /'
echo

COUNT="$(printf '%s\n' "$PENDING" | grep -c '^' || true)"

read -r -p "Commit and push these ${COUNT} change(s)? [y/N] " reply
case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted — nothing committed."; exit 0 ;;
esac

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# ── Step 1: sync with GitHub BEFORE touching anything ────────────────────────
#
# Order matters here, for correctness and not just convenience:
#
#   * Songs uploaded through the site panel are committed straight to GitHub by
#     the browser and never land on this machine, so this clone is often behind.
#     Pushing without rebasing would be rejected as non-fast-forward.
#
#   * More importantly, the reconciler below PRUNES playlist entries whose audio
#     file is missing from the folder. If we reconciled while still behind, a
#     panel-uploaded track we haven't pulled yet would look like a dead entry
#     and get deleted. Rebasing first brings those files down, so the reconciler
#     always sees the complete picture.
#
# New audio files are untracked at this point, and untracked files don't block
# a rebase — so this is safe to do before staging.
echo
echo "Syncing with GitHub…"
git fetch origin "$BRANCH"

BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH")"
if [ "$BEHIND" -gt 0 ]; then
    echo "  $BEHIND commit(s) on GitHub not here yet (site-panel uploads land there directly)."
    BEFORE_PULL="$(git rev-parse HEAD)"
    if ! git pull --rebase origin "$BRANCH"; then
        echo
        echo "error: rebase hit a conflict. Nothing has been committed. Resolve, then:" >&2
        echo "  git rebase --continue   (or 'git rebase --abort' to back out)" >&2
        exit 1
    fi
    NEW_AUDIO="$(git diff --name-only "$BEFORE_PULL" HEAD -- "$FAVORITES" "$PRODUCED" | wc -l | tr -d ' ')"
    [ "$NEW_AUDIO" -gt 0 ] && echo "  pulled down $NEW_AUDIO audio file(s) that were uploaded via the site."
else
    echo "  already up to date."
fi

# ── Step 2: register the tracks locally ──────────────────────────────────────
#
# Run the same reconciler the GitHub Action runs, but here, now. This is what
# keeps the local folder and the local playlist mirrored: the mp3 and the
# playlist entry that references it go into ONE commit, instead of the entry
# being added later by the bot and leaving this clone stale until it pulls.
#
# The Action still runs afterwards as a safety net (it's what catches panel
# uploads), but because reconcile is idempotent it will find nothing to do and
# make no commit — so there is nothing left to pull.
echo
echo "Registering track(s) in the playlists…"
if ! node "$REPO_ROOT/scripts/sync-audio.js"; then
    echo "error: playlist registration failed — nothing committed." >&2
    exit 1
fi

# ── Step 3: commit the audio and its registration together ───────────────────
git add -- "$FAVORITES" "$PRODUCED" \
           "assets/songs/schedule.json" "assets/songs/produced.json"

if git diff --cached --quiet; then
    echo "Nothing staged after all — aborting."
    exit 0
fi

git commit -m "upload: add ${COUNT} audio file(s) from local folder"

git push origin "$BRANCH"

echo
echo "Pushed to $BRANCH."
echo "The sync-audio workflow will register the track(s) and Vercel will deploy."
echo "Watch it: https://github.com/777Cyril/cyrilhd/actions"
