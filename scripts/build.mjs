import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {packagePlugin} from './package-plugin.mjs';
import {inspectPluginArchive} from '../src/plugin-archive.mjs';
import {approvedPresetAudio} from './preset-policy.mjs';

assert.equal(process.versions.node, '24.21.0', 'Use the pinned Node 24.21.0 runtime');
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => arg.startsWith('--out=')), 'Use --out=<fresh directory>');
const output = resolve(args[0]?.slice(6) || join(root, '..', 'voice-artifacts'));
const outputRelative = relative(root, output);
assert.ok(outputRelative === '..' || outputRelative.startsWith('..' + sep) || isAbsolute(outputRelative), 'Use an output directory outside the source repository');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const release = await json(join(root, 'release.json'));
assert.equal(release.version, '1.0.2');
assert.equal(release.appRange, '^2.0.11');
assert.ok(Number.isFinite(Date.parse(release.publishedAt)));
const git = (...argv) => {
  try { return execFileSync('git', argv, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); }
  catch { return null; }
};
const status = git('status', '--porcelain');
const source = {repository: release.repository, commit: git('rev-parse', '--verify', 'HEAD'), tree: git('rev-parse', '--verify', 'HEAD^{tree}'),
  workingTreeDirty: status === null ? null : status.length > 0};
await mkdir(output);
const packages = [];
for (const name of release.packageNames) {
  const directory = join(root, 'components', name), template = join(root, 'manifests', name + '.json');
  const manifest = await json(template), assetBytes = await readFile(join(directory, 'assets.json'));
  const assets = JSON.parse(assetBytes), downloads = await json(join(directory, 'downloads.json'));
  assert.equal(manifest.id, 'ai-buddy.' + name);
  assert.equal(manifest.version, release.version);
  assert.equal(manifest.appRange, release.appRange);
  assert.deepEqual(manifest.dependencies, name === 'voice-shared-runtime' ? {} : {'ai-buddy.voice-shared-runtime': release.version});
  assert.equal(downloads.assetsSha256, sha(assetBytes), 'The download mapping must bind the unchanged asset inventory');
  const inventory = new Map(assets.files.map(file => [file.path, file]));
  const archived = new Set(downloads.archives.flatMap(archive => archive.files));
  const covered = new Set();
  for (const path of [...downloads.archives.flatMap(archive => archive.files), ...(downloads.directFiles ?? []).map(file => file.path)]) {
    assert.ok(inventory.has(path) && !inventory.get(path).url && !covered.has(path), 'Download paths must cover declared files once');
    covered.add(path);
  }
  assert.ok(assets.files.every(file => file.url || covered.has(file.path)), 'Every asset needs a pinned source or download mapping');
  const presetAudio = await approvedPresetAudio(root, name), packedAudio = new Set();
  const url = `${release.repository}/releases/download/${release.tag}/${manifest.id}-${release.version}.zip`;
  const result = await packagePlugin({manifest: template, files: directory, out: join(output, name), url});
  const entry = await json(result.entry);
  entry.publishedAt = release.publishedAt;
  await writeFile(result.entry, JSON.stringify(entry, null, 2));
  const bytes = await readFile(result.archive), inspected = inspectPluginArchive(bytes, entry.manifest);
  for (const file of inspected.entries) {
    const packed = bytes.subarray(file.begin, file.stop), raw = file.method ? inflateRawSync(packed) : packed;
    if (file.path !== 'plugin.json') assert.equal(sha(raw), entry.manifest.files.find(row => row.path === file.path).sha256);
    if (/\.wav$/i.test(file.path)) {
      const reference = presetAudio.get(file.path);
      assert.ok(reference, `Undeclared reference audio in ${name}/${file.path}`);
      assert.equal(raw.length, reference.bytes, 'Preset audio size differs from the approved source');
      assert.equal(sha(raw), reference.sha256, 'Preset audio hash differs from the approved source');
      assert.equal(raw.toString('ascii', 0, 4), 'RIFF');
      assert.equal(raw.toString('ascii', 8, 12), 'WAVE');
      packedAudio.add(file.path);
    } else {
      assert.ok(!/\.(?:mp3|flac|ogg|m4a|aac|opus|wma|aiff?|zip|exe|dll|bin|pth|ckpt)$/i.test(file.path), 'Plugin ZIPs allow only source, metadata and declared preset WAVs');
      assert.ok(!/(?:^|\/)(?:\.env(?:\..*)?|(?:credentials|secrets?|accounts?)(?:[.-].*)?)$/i.test(file.path), 'Private configuration file in plugin ZIP');
      assert.ok(!/^(?:RIFF|fLaC|OggS|ID3)/.test(raw.toString('ascii', 0, 4)), `Undeclared reference audio in ${name}/${file.path}`);
      assert.match(file.path, /\.(?:mjs|py|json|md|txt)$/i, 'Plugin ZIPs allow only source, metadata and declared preset WAVs');
      const text = new TextDecoder('utf-8', {fatal: true}).decode(raw);
      assert.ok(!/\b[A-Za-z]:[\\/]|\/(?:Users|home)\/|Administrator/.test(text), `Private absolute path in ${name}/${file.path}`);
      assert.ok(!/-----BEGIN (?:[A-Z ]* )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[opusr]_[A-Za-z0-9]{20,})\b|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)["']?\s*[:=]\s*["'][^"'\r\n]{12,}["']/i.test(text), `Credential material in ${name}/${file.path}`);
    }
  }
  assert.deepEqual([...packedAudio].sort(), [...presetAudio.keys()].sort(), 'Every declared preset WAV must be present in the ZIP');
  const directBytes = assets.files.filter(file => file.url || !archived.has(file.path)).reduce((total, file) => total + file.bytes, 0);
  packages.push({id: manifest.id, version: manifest.version, archive: relative(output, result.archive).replaceAll('\\', '/'),
    releaseEntry: relative(output, result.entry).replaceAll('\\', '/'), url, sha256: result.sha256, bytes: result.bytes,
    assetsSha256: sha(assetBytes), downloadsSha256: sha(await readFile(join(directory, 'downloads.json'))),
    assetFiles: inventory.size, downloadBytes: downloads.archives.reduce((total, archive) => total + archive.bytes, 0) + directBytes,
    presetAudioFiles: presetAudio.size, presetAudioBytes: [...presetAudio.values()].reduce((total, row) => total + row.bytes, 0)});
}
await writeFile(join(output, 'packages.json'), JSON.stringify({schemaVersion: 1, version: release.version, publishedAt: release.publishedAt,
  source, packages, archivePrivacyCheck: true, completeDownloadMapping: true, signed: false, published: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, packages: packages.map(({id, bytes, sha256}) => ({id, bytes, sha256})), signed: false, published: false}, null, 2));
