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
# Resolved, never hard-coded: an absolute path here publishes the author's home
# directory and the name of a private project to every reader of a public repo.
# Order: explicit override, then the host repo as a sibling checkout.
DEST="${DEST:-$(cd "$(dirname "$0")/../LLC/Hlur_Website" 2>/dev/null && pwd)/hub}"
SITE="$(dirname "$DEST")"
DEPLOY=0
[[ "${1:-}" == "--deploy" ]] && DEPLOY=1

if [[ ! -d "$SITE" ]]; then
  echo "✗ host site not found at $SITE"
  echo "  Set DEST=/path/to/Hlur_Website/hub and re-run."
  exit 1
fi

echo "▶ guard first — only a green build may ship"
GUARD_OUT="$(mktemp)"; trap 'rm -f "$GUARD_OUT"' EXIT
# Run the guard exactly ONCE and keep its output. Running it twice — offline
# then --full — appended both reports to the same file and the claim gate summed
# the offline harnesses twice: it reported 3118 checks where the repo runs 2190.
# A gate that miscounts is worse than none; it fails builds for a lie.
FULL_OK=1
if ./selfcheck --full 2>&1 | tee "$GUARD_OUT"; then
  :
else
  FULL_OK=0
  if [[ $DEPLOY -eq 1 ]]; then
    echo "✗ the rendered pass must be green before anything reaches hlur.ai"
    exit 1
  fi
  # Plain sync with no Playwright: fall back to the offline gate, which still
  # has to pass, but the check TOTAL is now incomplete — the claim gate says so
  # rather than comparing against a number it knows is short.
  : > "$GUARD_OUT"
  ./selfcheck | tee "$GUARD_OUT"
fi

# ------------------------------------------------------------------
# CLAIM GATE
# The hlur.ai homepage advertises this repo's check count ("Ships behind N
# automated checks"). That number goes stale the moment a check is added, and a
# stale claim on a card whose whole pitch is verification is the worst possible
# place to have one. Compare it to what selfcheck just reported: WARN on a plain
# sync, FAIL on --deploy, because an untrue claim must not go live.
#
# `|| true` on every extraction: under `set -euo pipefail` a grep that matches
# nothing exits 1, pipefail propagates it, and set -e kills the script ON THE
# ASSIGNMENT — no message, no verdict. Let it yield empty and be judged below.
#
# The strings are ANSI-coloured, so colour codes are stripped before parsing.
# The homepage carries TWO such receipts — Baseline's and this one — so the
# match is anchored on this card's distinguishing wording, not the shared prefix.
# ------------------------------------------------------------------
CHECKS="$(sed 's/\x1b\[[0-9;]*m//g' "$GUARD_OUT" \
          | grep -oE '^PASS +[0-9]+ (adversarial tests|checks|rendered checks)' \
          | grep -oE '[0-9]+' | awk '{s+=$1} END{print s+0}' || true)"
CLAIMED="$(grep -oE 'Ships behind [0-9,]+ automated checks; every page is generated' \
            "$SITE/index.html" 2>/dev/null | grep -oE '[0-9,]+' | tr -d ',' || true)"

echo
echo "▶ claim gate — the homepage says what this repo ships behind"
if [[ $FULL_OK -eq 0 ]]; then
  echo "  ⚠ the rendered pass did not run, so the total is incomplete."
  echo "    Claim not verified. Run ./selfcheck --full before deploying."
elif [[ -z "$CHECKS" || "$CHECKS" == "0" ]]; then
  # A COUNT OF ZERO IS NOT AGREEMENT. Unparseable selfcheck output must never
  # read as "the claim is fine" — that is the failure mode this gate exists for.
  echo "  ✗ could not parse a check count from selfcheck output."
  echo "    The gate cannot verify the homepage claim, so it is not verified."
  [[ $DEPLOY -eq 1 ]] && exit 1
elif [[ -z "$CLAIMED" ]]; then
  echo "  ✗ no AI Hub receipt found on $SITE/index.html"
  echo "    Expected: 'Ships behind N automated checks; every page is generated'"
  [[ $DEPLOY -eq 1 ]] && exit 1
elif [[ "$CHECKS" != "$CLAIMED" ]]; then
  echo "  ✗ the homepage claims $CLAIMED checks; this repo runs $CHECKS."
  echo "    Fix the receipt in $SITE/index.html, then re-run."
  if [[ $DEPLOY -eq 1 ]]; then
    echo "    Refusing to deploy an untrue claim."
    exit 1
  fi
  echo "    (warning only — a plain sync does not publish)"
else
  echo "  ✓ homepage claim matches: $CHECKS checks"
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
echo "▶ prove the live copy matches source"
# A's sync ENDS by running its parity check; this one ended by printing a
# suggestion a human must remember. The host's crosscheck_live covers all six
# hub pages (200s, titles, ordered headings, link targets, SHA-256 of every
# asset incl. style.css and app.js), and sync copies this repo's files in
# byte-identical — so a green run transitively proves THIS source is live.
# Fail closed: a deploy whose live copy cannot be verified is a failed deploy.
( cd "$SITE" && node crosscheck_live.js ) || {
  echo "✗ the LIVE site does not match source — the deploy is not done until this passes."
  exit 1
}

echo
echo "✓ deployed and proven live."
