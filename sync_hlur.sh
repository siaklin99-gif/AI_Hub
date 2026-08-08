#!/usr/bin/env bash
# ============================================================
# Sync AI Hub into the Hlur website (hlur.ai/hub).
#   ./sync_hlur.sh              copy only  (then deploy by hand)
#   ./sync_hlur.sh --deploy     copy + verify + deploy + commit
#
# THIS repo is the single source of truth. The copy inside
# Hlur_Website/hub/ is a build artifact — never edit it there.
# This script refuses to sync unless the local guard passes, so a
# broken build cannot reach hlur.ai.
#
# --deploy runs the whole chain and STOPS at the first red
# (set -e), so a broken build can never reach the live site:
#   selfcheck -> copy -> host-site harnesses -> netlify deploy
#
# Deliberately mirrors AI_Technology/sync_hlur.sh, which does the
# same job for hlur.ai/baseline. If you change one, read the other.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

# DEST is overridable so CI runs THIS script rather than a duplicate in YAML.
DEST="${DEST:-<resolved at runtime>/hub}"
SITE="$(dirname "$DEST")"
DEPLOY=0
[[ "${1:-}" == "--deploy" ]] && DEPLOY=1

if [[ ! -d "$SITE" ]]; then
  echo "✗ host site not found at $SITE"
  echo "  Set DEST=/path/to/Hlur_Website/hub and re-run."
  exit 1
fi

echo "▶ guard first — only a green build may ship"
# The offline harnesses are the gate. The rendered pass needs Playwright, so it
# is required for --deploy and merely encouraged for a plain copy.
./selfcheck
if [[ $DEPLOY -eq 1 ]]; then
  echo
  echo "▶ rendered pass (required before anything reaches hlur.ai)"
  ./selfcheck --full
fi

echo
echo "▶ the built pages must match the source"
node build.js --check

echo
echo "▶ copy into $DEST"
mkdir -p "$DEST/assets"
cp index.html map.html trust.html leverage.html tools.html further.html "$DEST/"
cp assets/style.css assets/app.js assets/favicon.svg assets/og.png "$DEST/assets/"
echo "  ✓ 6 pages + 4 assets -> $DEST"

# Nothing else may travel. The host's build_dist.js rejects stray .js by design,
# but catching it here names the file instead of failing later inside a deploy.
STRAY="$(find "$DEST" -type f \
          ! -name '*.html' ! -name 'style.css' ! -name 'app.js' \
          ! -name 'favicon.svg' ! -name 'og.png' | head -5)"
if [[ -n "$STRAY" ]]; then
  echo "✗ unexpected files in $DEST — remove them before shipping:"
  echo "$STRAY" | sed 's/^/    /'
  exit 1
fi

echo
echo "▶ host-site harnesses — the hub must not break hlur.ai"
run_harness() {  # run_harness <file>
  local out
  out="$(cd "$SITE" && node "$1" 2>&1)" && { echo "  ✓ $1"; return 0; }
  echo "  ✗ $1 FAILED:"
  echo "$out" | grep -aE '^FAIL|CHECK\(S\) FAILED|Error' | head -12 | sed 's/^/      /'
  return 1
}
run_harness verify_home.js

if [[ $DEPLOY -eq 0 ]]; then
  echo
  echo "✓ synced, not deployed."
  echo "  Deploy from the host repo so BOTH sub-sites go out through one gate:"
  echo "     cd $SITE && ./deploy.sh"
  exit 0
fi

echo
echo "▶ deploy hlur.ai"
# Publish _dist, NEVER the repo root — _dist is the public web root and the
# only thing build_dist.js has vetted.
( cd "$SITE" && node build_dist.js | tail -1 )
( cd "$SITE" && netlify deploy --prod --dir _dist --functions netlify/functions \
    ${NETLIFY_SITE_ID:+--site "$NETLIFY_SITE_ID"} \
    | grep -E 'Production URL|Website URL' )

echo
echo "✓ deployed. Verify the live copy:  cd $SITE && node crosscheck_live.js"
