# Voice 1.0.2 source delivery

Source and unsigned review packages for AI-Buddy-Voice v1.0.2. Final source-commit binding, signing and publication belong to the consolidated release process.

- Branch: `codex/voice-presets-release`; source baseline: `89d1280aea7d3b360a317d012ea926992faaa0e5`.
- All three packages are 1.0.2 for AI Buddy `^2.0.11`. Each engine requires shared runtime 1.0.2 exactly. Existing manifest permissions, API/data schemas and license fields are preserved.
- Each engine carries 11 presets in `presets/index.json`. Breeze contains 11 full reference WAVs; GPT contains 11 existing short WAVs plus the 11 full originals for explicit cloud-cloning consent. Installation imports missing presets and preserves existing selections and personal recordings.
- [PRESET-SOURCES.md](PRESET-SOURCES.md) and [presets/sources.json](presets/sources.json) record source manifests, original hashes, transcripts and existing derivation methods. All 22 unique inputs are copied verbatim; 33 packaged WAVs total 18,535,004 bytes. No generated audition output or user data is an input.
- Existing worker, entry, `assets.json`, `downloads.json`, SDK, LICENSE and README screenshot bytes are preserved. No model weights or large runtime archives are rebuilt.
- With Node 24.21.0: `node scripts/build.mjs --out=../voice-artifacts-new`, then `node scripts/verify-packages.mjs ../voice-artifacts-new`. Use a fresh output directory outside the checkout; no npm install or host source is needed. `release.json` fixes the timestamp; `packages.json` records hashes, sizes and source Git metadata, including dirty-worktree state.
- The old 1.0.1 ZIPs fail the 11-preset requirement. Eight packaging regressions pass against the real build command and delivered ZIP entries, including byte-for-byte source matching, repeatability, extra/altered/missing/disguised audio, altered manifests, private paths and credentials.
- No real synthesis, voice model process, microphone, cloud API, upload, MiniMax voice creation, signing or publication was performed by this source-delivery task. Public URLs remain planned until the consolidated release verifies them.

| Review package | ZIP bytes | SHA-256 |
|---|---:|---|
| ai-buddy.voice-shared-runtime | 248427 | `12ec9a51c572de4763636de7dec39c449f049b7f158485d0d262a73eb6915378` |
| ai-buddy.voice-breeze | 7656787 | `7cf20fb54448e98514138034183c4413264f2a98f2abf63a9406307cb713b6b5` |
| ai-buddy.voice-gpt-sovits | 10267732 | `b411017203b4bbfaa6989dfedd02f074165a4b77b1d287dfe58c819f07cbf247` |

These hashes identify the review ZIP bytes. The final release must be rebuilt from the reviewed source commit so its receipt records that commit.
