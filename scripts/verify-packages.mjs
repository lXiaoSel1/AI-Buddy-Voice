import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {inspectPluginArchive} from '../src/plugin-archive.mjs';

const root = resolve(import.meta.dirname, '..');
const characters = ['deepseek', 'grok', 'seed', 'kimi', 'qwen', 'minimax', 'chatgpt', 'gemini', 'claude', 'glm', 'hunyuan'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));

// Verify the delivered ZIPs, including their actual decompressed reference bytes.
export async function verifyPackages(directory) {
  const receipt = await json(join(directory, 'packages.json'));
  const release = await json(join(root, 'release.json'));
  const results = [];
  for (const row of [...receipt.packages].sort((a, b) => a.id.localeCompare(b.id))) {
    const bytes = await readFile(join(directory, row.archive));
    const entry = await json(join(directory, row.releaseEntry));
    assert.equal(bytes.length, row.bytes);
    assert.equal(hash(bytes), row.sha256);
    assert.deepEqual(entry.archive, {url: row.url, bytes: row.bytes, sha256: row.sha256});
    const inspected = inspectPluginArchive(bytes, entry.manifest);
    const files = new Map(inspected.entries.map(file => {
      const packed = bytes.subarray(file.begin, file.stop);
      return [file.path, file.method ? inflateRawSync(packed) : packed];
    }));
    const audio = [...files.keys()].filter(path => /\.(wav|mp3|flac|ogg)$/i.test(path));
    if (row.id === 'ai-buddy.voice-shared-runtime') {
      assert.equal(audio.length, 0, 'Shared runtime contains no reference audio');
      assert.ok(!files.has('presets/index.json'));
    } else {
      assert.ok(files.has('presets/index.json'), `${row.id} must deliver 11 character presets`);
      const index = JSON.parse(files.get('presets/index.json'));
      const engine = row.id === 'ai-buddy.voice-breeze' ? 'breeze' : 'gpt';
      assert.deepEqual(Object.keys(index).sort(), ['bundleId', 'engine', 'profiles', 'schemaVersion', 'version']);
      assert.equal(index.schemaVersion, 1);
      assert.equal(index.bundleId, 'ai-buddy.character-voices-r04');
      assert.equal(index.version, 1);
      assert.equal(index.engine, engine);
      assert.deepEqual(index.profiles.map(profile => profile.characterId), characters);
      const sources = await json(join(root, 'presets/sources.json'));
      const expectedAudio = new Set();
      for (const profile of index.profiles) {
        const id = profile.characterId;
        assert.deepEqual(Object.keys(profile).sort(), ['characterId', 'cloudReference', 'label', 'references']);
        assert.equal(profile.label, sources.labels[id] + ' · 预制声线');
        assert.deepEqual(Object.keys(profile.references), ['calm']);
        for (const [kind, reference] of [['calm', profile.references.calm], ['cloud', profile.cloudReference]]) {
          const source = sources.references[kind === 'cloud' ? 'breeze' : engine].entries[id];
          const file = `presets/audio/${id}-${kind === 'cloud' && engine === 'gpt' ? 'cloud' : 'calm'}.wav`;
          assert.deepEqual(reference, {file, bytes: source.bytes, sha256: source.sha256, text: source.text,
            language: source.language, durationMs: source.durationMs});
          const raw = files.get(file);
          assert.ok(raw, `Missing ${row.id}/${file}`);
          assert.equal(raw.length, source.bytes);
          assert.equal(hash(raw), source.sha256, `Approved source differs in ${row.id}/${file}`);
          assert.equal(raw.toString('ascii', 0, 4), 'RIFF');
          assert.equal(raw.toString('ascii', 8, 12), 'WAVE');
          if (kind === 'calm' && engine === 'gpt') assert.ok(source.durationMs >= 3000 && source.durationMs <= 10000);
          expectedAudio.add(file);
        }
      }
      assert.deepEqual(audio.sort(), [...expectedAudio].sort(), 'ZIP has exactly the declared preset audio');
    }
    assert.equal(entry.manifest.version, release.version);
    assert.equal(entry.manifest.appRange, release.appRange);
    assert.deepEqual(entry.manifest.dependencies, row.id === 'ai-buddy.voice-shared-runtime' ? {} : {'ai-buddy.voice-shared-runtime': release.version});
    results.push({id: row.id, profiles: row.id === 'ai-buddy.voice-shared-runtime' ? 0 : 11,
      audioFiles: audio.length, audioBytes: audio.reduce((sum, path) => sum + files.get(path).length, 0)});
  }
  assert.deepEqual(results.map(row => row.id).sort(), ['ai-buddy.voice-breeze', 'ai-buddy.voice-gpt-sovits', 'ai-buddy.voice-shared-runtime']);
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 3, 'Use verify-packages.mjs <package-output-directory>');
  console.log(JSON.stringify(await verifyPackages(resolve(process.argv[2])), null, 2));
}
