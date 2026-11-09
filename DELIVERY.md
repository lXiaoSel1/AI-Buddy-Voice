# Voice 1.0.1 source delivery

Prepared source and unsigned plugin packages for the planned AI-Buddy-Voice release v1.0.1. This is a local delivery; remote repository creation, tagging, signing, pushing, uploading and model/audio acceptance are separate steps.

- Branch: codex/voice-release-209. Planned origin: https://github.com/lXiaoSel1/AI-Buddy-Voice.git.
- All three versions are 1.0.1; appRange is ^2.0.9. Both engines require shared runtime 1.0.1 exactly. Permissions, schema and license template fields retain their input values.
- Original worker/entry/assets/LICENSE bytes are preserved. Final downloads.json is copied byte-for-byte; ASSET-NOTICES updates only release status and fixed upstream FFmpeg preparation.
- SDK source: AI Buddy integration baseline 1dfee0cbdffd03de61f720183730efa9b1e6bdb0. scripts/package-plugin.mjs plus src/plugin-archive.mjs and src/plugin-manifest.mjs are exact copies, with hashes in PROVENANCE.json. They use Node built-ins only.
- Rebuild with Node 24.21.0: node scripts/build.mjs --out=../voice-artifacts-new. No npm install, node_modules or host checkout is needed. Use a fresh output directory outside the repository. release.json fixes the release-entry timestamp.
- Small plugin ZIPs and per-package release-entry.json are in ../voice-artifacts. packages.json records source commit/tree, exact hashes and byte counts; BUILD-VERIFICATION.json records packaging checks and a second-build comparison.
- Actual package content/hash/privacy checks passed. Final downloads were parsed by the actual host parser, including the pinned upstream FFmpeg format, and every missing inventory source is mapped. No model weights, large resource ZIPs, personal recordings, private absolute paths, API keys or account data are included.
- Public download URLs are planned and have not been claimed reachable. No model process or real cloud API was called. No formal signing or publication was performed.

| Package | ZIP bytes | SHA-256 |
|---|---:|---|
| ai-buddy.voice-shared-runtime | 248428 | `0f059eb81b02356fa97367381b2517f4fb9ae813f06a0f49a7864b762c1f17ca` |
| ai-buddy.voice-breeze | 1654217 | `c398e266606714a8e7d53c0595ec25f3c9a6469a5254d74e279ba6da96b58d93` |
| ai-buddy.voice-gpt-sovits | 1499422 | `d8875bd5e2e69be150a2dc03303c7023db42ee429e8c8d1595c7a8c96814d85a` |

The bilingual README records selected-engine download totals, user-imported references, Breeze non-commercial notices, MiniMax authorization/fees, and fixed upstream FFmpeg preparation without an additional legal authorization claim.
