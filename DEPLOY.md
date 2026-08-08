# Deploying AI Hub to hlur.ai/hub

The site is an artifact of TWO repos: this one (source) and
`siaklin99-gif/Hlur_Website` (the host that owns hlur.ai). Deploys go through
the host so both sub-sites ship through one gate.

## Normal path (working machine with both repos checked out)

```bash
./sync_hlur.sh --deploy
```

That runs, in order: `./selfcheck --full` → the claim gate (the hlur.ai
homepage advertises this repo's check count; a stale claim refuses to deploy)
→ `build.js --check` → copy into `Hlur_Website/hub/` → the host's
`verify_home.js` → the host's `build_dist.js` → `netlify deploy` → the host's
`crosscheck_live.js`, which must end `SOURCE AND LIVE AGREE`. Any red stops
the chain. Then commit and push BOTH repos.

## Recovery path (any machine — used successfully 2026-08-08)

Needs: `gh` authenticated, `netlify` CLI authenticated, Node ≥18. Both repos
must already be PUSHED — this path deploys only what is on GitHub.

```bash
cd "$(mktemp -d)"
gh repo clone siaklin99-gif/Hlur_Website hlur && cd hlur
./selfcheck            # sibling-repo checks SKIP loudly here — that is by design
node build_dist.js     # must end "no harnesses, docs, scripts or unreferenced media included"
netlify deploy --prod --dir _dist --functions netlify/functions \
  --site 5106a934-085b-4aff-bcf1-1acaf3b6f95a
node crosscheck_live.js   # must end "SOURCE AND LIVE AGREE"
```

The `--site` id is the Netlify site bound to the hlur.ai domain (name:
`melodic-cascaron-35ef81`; confirm with `netlify api listSites` if in doubt —
pick the one whose `custom_domain` is `hlur.ai`). The id is an identifier,
not a credential; deploys still require the CLI's own auth.

To change hub CONTENT via this path: clone this repo too, edit `src/`, run
`node build.js && ./selfcheck`, push, then copy the six `*.html` +
`assets/{style.css,app.js,favicon.svg,og.png}` into the host clone's `hub/`,
commit and push the host, then deploy as above.

## What runs where

| Check | Local | CI |
|---|---|---|
| test.js + verify.js (fast, offline) | pre-commit hook + selfcheck | every push/PR (`verify.yml`) |
| render.js full incl. pixel refs | `selfcheck --full` | — (refs are macOS-rendered) |
| render.js minus pixel refs | — | weekly + manual (`rendered.yml`) |
| Live parity | end of every `--deploy` | — |
