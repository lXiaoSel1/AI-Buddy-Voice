import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const presetCharacters = ['deepseek', 'grok', 'seed', 'kimi', 'qwen', 'minimax', 'chatgpt', 'gemini', 'claude', 'glm', 'hunyuan'];
export const presetEngines = {'voice-breeze': 'breeze', 'voice-gpt-sovits': 'gpt'};

export async function readPresetSources(root) {
  const sources = JSON.parse(await readFile(join(root, 'presets/sources.json'), 'utf8'));
  assert.equal(sources.schemaVersion, 1);
  assert.equal(sources.bundleId, 'ai-buddy.character-voices-r04');
  assert.equal(sources.version, 1);
  for (const engine of ['breeze', 'gpt']) {
    assert.deepEqual(Object.keys(sources.references[engine].entries).sort(), [...presetCharacters].sort());
    for (const id of presetCharacters) {
      const reference = sources.references[engine].entries[id];
      assert.equal(reference.file, `references/${engine}/${id}-calm.wav`);
      assert.match(reference.sha256, /^[a-f0-9]{64}$/);
      assert.equal(reference.sourceSHA, sources.references.breeze.entries[id].sha256);
      assert.ok(Number.isSafeInteger(reference.bytes) && reference.bytes > 44);
      assert.ok(Number.isSafeInteger(reference.durationMs) && reference.durationMs > 0);
      assert.ok(reference.durationMs <= 30000, 'Reference exceeds the host profile duration limit');
      if (engine === 'gpt') assert.ok(reference.durationMs >= 3000 && reference.durationMs <= 10000, 'GPT reference must be 3-10 seconds');
      assert.equal(reference.language, 'zh');
      assert.ok(typeof reference.text === 'string' && reference.text.trim());
      assert.ok(typeof sources.labels[id] === 'string' && sources.labels[id].trim());
    }
  }
  return sources;
}

export function presetIndex(sources, engine) {
  assert.ok(['breeze', 'gpt'].includes(engine));
  const reference = (id, cloud) => {
    const row = sources.references[cloud ? 'breeze' : engine].entries[id];
    return {file: `presets/audio/${id}-${cloud && engine === 'gpt' ? 'cloud' : 'calm'}.wav`,
      bytes: row.bytes, sha256: row.sha256, text: row.text, language: row.language, durationMs: row.durationMs};
  };
  return {schemaVersion: 1, bundleId: sources.bundleId, version: sources.version, engine,
    profiles: presetCharacters.map(characterId => ({characterId, label: sources.labels[characterId] + ' · 预制声线',
      references: {calm: reference(characterId, false)}, cloudReference: reference(characterId, true)}))};
}

export async function approvedPresetAudio(root, name) {
  if (name === 'voice-shared-runtime') return new Map();
  const engine = presetEngines[name];
  assert.ok(engine, 'Unknown preset engine package');
  const expected = presetIndex(await readPresetSources(root), engine);
  const actual = JSON.parse(await readFile(join(root, 'components', name, 'presets/index.json'), 'utf8'));
  assert.deepEqual(actual, expected, 'Preset index must match the pinned approved source references');
  return new Map(expected.profiles.flatMap(profile => [profile.references.calm, profile.cloudReference]).map(row => [row.file, row]));
}
