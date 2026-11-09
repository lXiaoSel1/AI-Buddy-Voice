# Character voice reference sources

Voice 1.0.2 includes the 11-character `ai-buddy.character-voices-r04` bundle in each engine package. The exact source reference metadata, original SHA-256 values, transcripts and existing derivation methods are preserved in [presets/sources.json](presets/sources.json).

- Input round: `voice-audition-r04`.
- Breeze input: `REFERENCES-BREEZE.json`, SHA-256 `f7e25ebc473dd404f963bd4374020e95698c234698d1874a304e9bfa7feffebb`, 6,094 bytes. Its 11 full reference WAVs total 7,519,988 bytes, with durations of 12,199–15,386 ms.
- GPT input: `REFERENCES-GPT.json`, SHA-256 `1c516b043d2a2f3a2383130f5110a07d271b96b2918ad406fc12fb9ac3565461`, 5,947 bytes. Its 11 already prepared short reference WAVs total 3,495,028 bytes, with durations of 3,605–8,890 ms.
- Breeze packages the 11 full WAVs. GPT packages its 11 short WAVs and the same 11 full Breeze originals as separate cloud references. The 33 packaged files contain 22 unique WAV byte sequences totaling 11,015,016 unique bytes; all packaged audio totals 18,535,004 bytes.
- Each WAV is copied byte for byte after checking its declared size and SHA-256. This release does not trim, transcode, normalize, generate or synthesize reference audio. No generated audition output or user data is an input.
- The two input reference manifests contain no author-credit fields or separate license statement. This file records their provenance; it adds no attribution or licensing claim beyond the supplied source information. Existing model and component notices remain in the package `ASSET-NOTICES.md` files.

Installing a verified official engine package in AI Buddy 2.0.11 imports its presets without replacing an existing character/engine selection or a user's own recording. A cloud reference remains local until the user explicitly confirms cloud cloning. Bundling it does not upload it or create a MiniMax voice.

## Reproduce the references

With Node 24.21.0 and the two exact input manifests plus their referenced WAVs in one input directory:

```console
node scripts/generate-presets.mjs --source=<voice-audition-r04-directory> --receipt=<new-receipt-outside-checkout.json>
```

The source directory is a command-line input, not a private path embedded in public source. All 22 input files and both source manifests must match before package source is updated. The generated receipt records the input paths and hashes locally, outside the public checkout. A fresh receipt filename is required for each run.

The committed references already support a standalone package build without the original input directory:

```console
node scripts/build.mjs --out=../voice-artifacts-new
node scripts/verify-packages.mjs ../voice-artifacts-new
```

To run the packaging regressions, set `VOICE_PACKAGE_TEST_WORK` to an isolated evidence directory outside the checkout, then run `node --test scripts/build.test.mjs`. Tests invoke the real build command and inspect delivered ZIP entries; they do not start a voice model or call a cloud service.
