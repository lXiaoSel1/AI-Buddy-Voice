import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import test from 'node:test';
import {verifyPackages} from './verify-packages.mjs';

const source = resolve(import.meta.dirname, '..');
assert.equal(process.versions.node, '24.21.0', 'Use the pinned Node 24.21.0 runtime');
assert.ok(process.env.VOICE_PACKAGE_TEST_WORK, 'Set VOICE_PACKAGE_TEST_WORK to an evidence directory outside the checkout');
const work = resolve(process.env.VOICE_PACKAGE_TEST_WORK), rel = relative(source, work);
assert.ok(rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel), 'Tests use an isolated directory outside the checkout');
await mkdir(work, {recursive: true});
const run = await mkdtemp(join(work, 'package-regression-')), fixture = join(run, 'source');
await mkdir(fixture);
for (const name of ['scripts', 'src', 'components', 'manifests', 'presets', 'release.json']) {
  await cp(join(source, name), join(fixture, name), {recursive: true});
}
let sequence = 0;
async function build(label) {
  const out = join(run, `${++sequence}-${label}`);
  const result = spawnSync(process.execPath, ['scripts/build.mjs', `--out=${out}`], {cwd: fixture, encoding: 'utf8'});
  assert.ifError(result.error);
  await writeFile(join(run, `${sequence}-${label}.log`), result.stdout + result.stderr);
  return {out, ...result};
}
async function changed(path, change, body) {
  const target = join(fixture, path), before = await readFile(target);
  await writeFile(target, change(before));
  try { await body(); } finally { await writeFile(target, before); }
}
async function added(path, content, body) {
  const target = join(fixture, path);
  await writeFile(target, content, {flag: 'wx'});
  try { await body(); } finally { await rm(target); }
}
async function rejected(label, message) {
  const result = await build(label);
  assert.notEqual(result.status, 0, 'Invalid package must fail the public build command');
  assert.match(result.stderr, message);
}

await test('delivered ZIPs contain all 22 presets and exactly the approved original WAV bytes', async () => {
  const first = await build('valid');
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual((await verifyPackages(first.out)).map(({profiles, audioFiles, audioBytes}) => ({profiles, audioFiles, audioBytes})), [
    {profiles: 11, audioFiles: 11, audioBytes: 7519988},
    {profiles: 11, audioFiles: 22, audioBytes: 11015016},
    {profiles: 0, audioFiles: 0, audioBytes: 0}
  ]);
  const second = await build('reproduced');
  assert.equal(second.status, 0, second.stderr);
  const a = JSON.parse(await readFile(join(first.out, 'packages.json')));
  const b = JSON.parse(await readFile(join(second.out, 'packages.json')));
  assert.deepEqual(a.packages, b.packages, 'Same source produces identical ZIP hashes and sizes');
});

await test('build rejects audio absent from the preset manifest', async () => {
  const raw = await readFile(join(fixture, 'components/voice-breeze/presets/audio/deepseek-calm.wav'));
  await added('components/voice-breeze/presets/audio/extra.wav', raw,
    () => rejected('undeclared-wav', /Undeclared reference audio/));
});

await test('build rejects audio disguised as a text file', async () => {
  const raw = await readFile(join(fixture, 'components/voice-breeze/presets/audio/deepseek-calm.wav'));
  await added('components/voice-breeze/extra.txt', raw,
    () => rejected('disguised-audio', /Undeclared reference audio/));
});

await test('build rejects an altered approved WAV even when its filename is unchanged', async () => {
  await changed('components/voice-breeze/presets/audio/deepseek-calm.wav', raw => {
    const tampered = Buffer.from(raw); tampered[44] ^= 1; return tampered;
  }, () => rejected('wrong-audio-hash', /Preset audio hash differs/));
});

await test('build rejects a missing declared reference rather than publishing a partial preset bundle', async () => {
  const path = join(fixture, 'components/voice-gpt-sovits/presets/audio/deepseek-cloud.wav');
  const raw = await readFile(path);
  await rm(path);
  try { await rejected('missing-wav', /Every declared preset WAV must be present/); }
  finally { await writeFile(path, raw); }
});

await test('build rejects traversal and engine substitutions in the preset manifest', async () => {
  for (const [label, mutation] of [
    ['traversal', index => { index.profiles[0].references.calm.file = '../outside.wav'; }],
    ['wrong-engine', index => { index.engine = 'gpt'; }],
    ['wrong-character', index => { index.profiles[0].characterId = 'unknown'; }]
  ]) {
    await changed('components/voice-breeze/presets/index.json', raw => {
      const index = JSON.parse(raw); mutation(index); return JSON.stringify(index);
    }, () => rejected(label, /Preset index must match/));
  }
});

await test('build rejects other audio formats and reference audio in the shared runtime', async () => {
  await added('components/voice-breeze/extra.mp3', 'unapproved audio',
    () => rejected('other-audio', /allow only source, metadata and declared preset WAVs/));
  await added('components/voice-shared-runtime/extra.wav', 'unapproved audio',
    () => rejected('shared-audio', /Undeclared reference audio/));
});

await test('build rejects private paths, credentials and private account configuration', async () => {
  await added('components/voice-breeze/notes.json', JSON.stringify({path: ['Z:', 'private', 'voice.wav'].join('\\')}),
    () => rejected('private-path', /Private absolute path/));
  await added('components/voice-breeze/notes.json', JSON.stringify({apiKey: 'sk-' + 'x'.repeat(32)}),
    () => rejected('credential', /Credential material/));
  await added('components/voice-breeze/.env', 'unapproved local configuration',
    () => rejected('private-config', /Private configuration file/));
});

console.log(`Package regression evidence: ${run}`);
