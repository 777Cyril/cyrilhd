#!/usr/bin/env bash
#
# status.sh — show the three places a track can exist, side by side.
#
#   local folder   what's on this Mac
#   GitHub         what's committed (the source of truth)
#   live site      what visitors actually hear
#
# Use it as a checkpoint when testing an upload: run before, run after.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SITE="https://cyrilhd.vercel.app"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

count_dir() { ls -1 "$1" 2>/dev/null | grep -Ei '\.(mp3|wav|m4a)$' | wc -l | tr -d ' '; }

LOCAL_FAV=$(count_dir assets/audio/favorites)
LOCAL_PROD=$(count_dir assets/audio/produced)

git fetch origin "$BRANCH" --quiet 2>/dev/null
BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo '?')
AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo '?')

# core.quotePath=false + -z: without them git wraps non-ASCII filenames in
# quotes and octal-escapes them ("Billi0n - \303\230N THE ROAD...".mp3"), so the
# extension match fails and the count silently comes up short.
count_tree() {
    git -c core.quotePath=false ls-tree -r -z --name-only "origin/$BRANCH" "$1" 2>/dev/null \
        | tr '\0' '\n' | grep -Eic '\.(mp3|wav|m4a)$' || echo 0
}
GH_FAV=$(count_tree assets/audio/favorites/)
GH_PROD=$(count_tree assets/audio/produced/)

# Playlist ENTRY counts, which are not the same thing as file counts — an audio
# file can sit in the folder without being registered in the playlist, and that
# is exactly the state you are in between pushing and pulling the bot's
# auto-register commit. Showing only files hid that.
count_entries_local()  { python3 -c "import json;print(len(json.load(open('$1'))['$2']))" 2>/dev/null || echo '?'; }
count_entries_gh()     { git show "origin/$BRANCH:$1" 2>/dev/null | python3 -c "import json,sys;print(len(json.load(sys.stdin)['$2']))" 2>/dev/null || echo '?'; }
count_entries_live()   { curl -fsS --max-time 10 "$SITE/$1" 2>/dev/null | python3 -c "import json,sys;print(len(json.load(sys.stdin)['$2']))" 2>/dev/null || echo '?'; }

SCHED=assets/songs/schedule.json
PROD=assets/songs/produced.json

L_FAV_E=$(count_entries_local  "$SCHED" favorites);  L_PROD_E=$(count_entries_local  "$PROD" produced)
G_FAV_E=$(count_entries_gh     "$SCHED" favorites);  G_PROD_E=$(count_entries_gh     "$PROD" produced)
V_FAV_E=$(count_entries_live   "$SCHED" favorites);  V_PROD_E=$(count_entries_live   "$PROD" produced)

printf '\n                 favorites        produced\n'
printf '                files  playlist   files  playlist\n'
printf '  local        %5s  %8s   %5s  %8s\n' "$LOCAL_FAV" "$L_FAV_E" "$LOCAL_PROD" "$L_PROD_E"
printf '  GitHub       %5s  %8s   %5s  %8s\n' "$GH_FAV"    "$G_FAV_E" "$GH_PROD"    "$G_PROD_E"
printf '  live site    %5s  %8s   %5s  %8s\n' "-"          "$V_FAV_E" "-"           "$V_PROD_E"
printf '\n'

# A file present locally but absent from the local playlist is the normal state
# after add-song and before pulling — call it out so the numbers make sense.
if [ "$LOCAL_FAV" != "$L_FAV_E" ] || [ "$LOCAL_PROD" != "$L_PROD_E" ]; then
    printf '  note: local files > local playlist — the auto-register commit is still on GitHub\n'
fi

if [ "$BEHIND" != "0" ] && [ "$BEHIND" != "?" ]; then
    printf '  ⬇  %s commit(s) on GitHub not here yet — run: npm run pull-songs\n' "$BEHIND"
fi
if [ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ]; then
    printf '  ⬆  %s commit(s) here not on GitHub yet — run: npm run add-song\n' "$AHEAD"
fi
if [ "$BEHIND" = "0" ] && [ "$AHEAD" = "0" ]; then
    printf '  ✓  local and GitHub in sync (%s)\n' "$(git rev-parse --short HEAD)"
fi

PENDING=$(git status --porcelain -- assets/audio/favorites assets/audio/produced | wc -l | tr -d ' ')
[ "$PENDING" -gt 0 ] && printf '  ●  %s uncommitted audio file(s) in the folders — run: npm run add-song\n' "$PENDING"
printf '\n'
