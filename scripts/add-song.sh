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

git add -- "$FAVORITES" "$PRODUCED"

if git diff --cached --quiet; then
    echo "Nothing staged after all — aborting."
    exit 0
fi

git commit -m "upload: add ${COUNT} audio file(s) from local folder"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Songs uploaded through the site panel are committed straight to GitHub by the
# browser, so they never land on this machine. Whenever that has happened this
# clone is behind, and a plain push would be rejected as non-fast-forward —
# after we already made a commit. Rebase onto origin first: it makes the push
# succeed AND pulls those panel-uploaded tracks down into the local folders.
echo
echo "Syncing with GitHub…"
git fetch origin "$BRANCH"

BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH")"
if [ "$BEHIND" -gt 0 ]; then
    echo "  $BEHIND commit(s) on GitHub not here yet (site-panel uploads land there directly)."
    BEFORE_PULL="$(git rev-parse HEAD)"
    if ! git pull --rebase origin "$BRANCH"; then
        echo
        echo "error: rebase hit a conflict. Your commit is safe — resolve, then:" >&2
        echo "  git rebase --continue && git push origin $BRANCH" >&2
        echo "  (or 'git rebase --abort' to back out)" >&2
        exit 1
    fi
    NEW_AUDIO="$(git diff --name-only "$BEFORE_PULL" HEAD -- "$FAVORITES" "$PRODUCED" | wc -l | tr -d ' ')"
    [ "$NEW_AUDIO" -gt 0 ] && echo "  pulled down $NEW_AUDIO audio file(s) that were uploaded via the site."
else
    echo "  already up to date."
fi

git push origin "$BRANCH"

echo
echo "Pushed to $BRANCH."
echo "The sync-audio workflow will register the track(s) and Vercel will deploy."
echo "Watch it: https://github.com/777Cyril/cyrilhd/actions"
