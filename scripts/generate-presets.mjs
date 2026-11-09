import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {assertPluginTreeNoLinks} from '../src/plugin-archive.mjs';
import {presetCharacters, presetEngines, presetIndex, readPresetSources} from './preset-policy.mjs';

assert.equal(process.versions.node, '24.21.0', 'Use the pinned Node 24.21.0 runtime');
const root = resolve(import.meta.dirname, '..');
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const at = arg.indexOf('=');
  assert.ok(at > 2 && ['--source', '--receipt'].includes(arg.slice(0, at)), 'Use --source=<reference-round> --receipt=<new receipt outside source>');
  return [arg.slice(2, at), resolve(arg.slice(at + 1))];
}));
assert.ok(options.source && options.receipt, 'Both --source and --receipt are required');
const receiptRelative = relative(root, options.receipt);
assert.ok(receiptRelative === '..' || receiptRelative.startsWith('..' + sep) || isAbsolute(receiptRelative), 'Keep the source receipt outside the public source repository');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const sources = await readPresetSources(root), originals = new Map(), verified = [];
for (const engine of ['breeze', 'gpt']) {
  const declared = sources.sourceManifests[engine];
  assert.equal(declared.file, engine === 'breeze' ? 'REFERENCES-BREEZE.json' : 'REFERENCES-GPT.json');
  const manifestPath = join(options.source, declared.file);
  await assertPluginTreeNoLinks(manifestPath);
  const manifestBytes = await readFile(manifestPath);
  assert.equal(manifestBytes.length, declared.bytes, 'Source reference manifest size changed');
  assert.equal(hash(manifestBytes), declared.sha256, 'Source reference manifest hash changed');
  assert.deepEqual(JSON.parse(manifestBytes), sources.references[engine]);
  for (const id of presetCharacters) {
    const reference = sources.references[engine].entries[id], path = join(options.source, reference.file);
    await assertPluginTreeNoLinks(path);
    assert.ok((await lstat(path)).isFile(), 'Reference must be an ordinary file');
    const raw = await readFile(path);
    assert.equal(raw.length, reference.bytes, `Source size mismatch: ${reference.file}`);
    assert.equal(hash(raw), reference.sha256, `Source hash mismatch: ${reference.file}`);
    assert.equal(raw.toString('ascii', 0, 4), 'RIFF');
    assert.equal(raw.toString('ascii', 8, 12), 'WAVE');
    originals.set(`${engine}/${id}`, raw);
    verified.push({engine, characterId: id, source: path, bytes: raw.length, sha256: hash(raw),
      originalSha256: reference.sourceSHA, durationMs: reference.durationMs, method: reference.method});
  }
}
// All 22 original inputs must pass before any package source is changed. Audio is
// copied verbatim; this command has no transcoder, model or network dependency.
const outputs = [];
for (const [name, engine] of Object.entries(presetEngines)) {
  const index = presetIndex(sources, engine), directory = join(root, 'components', name);
  for (const profile of index.profiles) {
    for (const [kind, row] of [['calm', profile.references.calm], ['cloud', profile.cloudReference]]) {
      const path = join(directory, row.file), raw = originals.get(`${kind === 'cloud' ? 'breeze' : engine}/${profile.characterId}`);
      await assertPluginTreeNoLinks(path);
      await mkdir(dirname(path), {recursive: true});
      await writeFile(path, raw);
    }
  }
  await writeFile(join(directory, 'presets/index.json'), JSON.stringify(index, null, 2) + '\n');
  const audio = new Map(index.profiles.flatMap(profile => [profile.references.calm, profile.cloudReference]).map(row => [row.file, row]));
  outputs.push({package: name, profiles: index.profiles.length, audioFiles: audio.size,
    audioBytes: [...audio.values()].reduce((sum, row) => sum + row.bytes, 0)});
}
await mkdir(dirname(options.receipt), {recursive: true});
await writeFile(options.receipt, JSON.stringify({schemaVersion: 1, bundleId: sources.bundleId, sourceRound: sources.sourceRound,
  sourceManifests: sources.sourceManifests, verified, uniqueInputs: verified.length,
  uniqueInputBytes: verified.reduce((sum, row) => sum + row.bytes, 0), outputs,
  transformed: false, synthesized: false, uploaded: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({verifiedInputs: verified.length, outputs, receipt: options.receipt, transformed: false}, null, 2));
