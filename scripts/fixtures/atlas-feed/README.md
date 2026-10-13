# Feed fixtures

- `atlas-forecast-20261001T0108Z.json`: **synthetic since 12 Oct 2026.**
  - Invented: the guidance tracks, the watch reason texts and every capture instant (`generated_at`, `known_at`, `first_seen`, `as_of`).
  - Kept: the NHC advisory track points and the NHC cone are NHC's own public products.
  - No model's real forecast and no real capture observation time is in it. The structure (run counts, track lengths, watch states) is kept so the browser gates exercise the same paths.
- `atlas-live-20261001T0108Z.json`: the live record as the public refresh wrote it on 1 Oct 2026. It holds NHC best track and, for 10 of 17 records, operational SHIPS values. Since 12 Oct the published live file withholds SHIPS; this fixture is unchanged and still exercises the SHIPS panel.
