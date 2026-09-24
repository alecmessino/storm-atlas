# Storm Atlas

A research instrument over the historical tropical-cyclone record: define a cohort by where and
when storms formed, and see what those storms went on to do. It is not a forecast.

Live site: https://alecmessino.github.io/storm-atlas/

## Layout

- `docs/` is the published site (GitHub Pages, branch `main`, folder `/docs`).
  - `docs/data/atlas-*.bin.gz` and `atlas-manifest.json` are the archive packs, a versioned snapshot.
  - `docs/data/atlas-live-v1.json` and `docs/data/latest.json` are the live operational files,
    refreshed every 10 minutes from NHC's public ATCF decks, SHIPS and forecast advisories.
- `src/` is the Atlas source. `docs/dist/` is built from it by `scripts/build-atlas.mjs`.
- `scripts/` holds the refresh, the build and the gates.

## Gates

- `scripts/test-public-schema.mjs`: every field in the two live files must be in the approved schema.
- `scripts/scan-public.mjs`: a forbidden-string scan of the site (and, with `--repo`, of the whole
  repository). Exceptions are listed one by one in `scripts/scan-allowlist.json`.
- `scripts/stage.sh` stages the site in the layout the Atlas gates expect. See
  `.github/workflows/checks.yml` for the full list.
- `scripts/verify-live.mjs` checks the deployed site over the public internet.
