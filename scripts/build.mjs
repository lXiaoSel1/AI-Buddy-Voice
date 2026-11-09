import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {packagePlugin} from './package-plugin.mjs';
import {inspectPluginArchive} from '../src/plugin-archive.mjs';

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
assert.equal(release.version, '1.0.1');
assert.equal(release.appRange, '^2.0.9');
assert.ok(Number.isFinite(Date.parse(release.publishedAt)));
const git = (...argv) => {
  try { return execFileSync('git', argv, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); }
  catch { return null; }
};
const source = {repository: release.repository, commit: git('rev-parse', '--verify', 'HEAD'), tree: git('rev-parse', '--verify', 'HEAD^{tree}')};
await mkdir(output);
const packages = [];
for (const name of release.packageNames) {
  const directory = join(root, 'components', name), template = join(root, 'manifests', name + '.json');
  const manifest = await json(template), assetBytes = await readFile(join(directory, 'assets.json'));
  const assets = JSON.parse(assetBytes), downloads = await json(join(directory, 'downloads.json'));
  assert.equal(manifest.id, 'ai-buddy.' + name);
  assert.equal(manifest.version, release.version);
  assert.equal(manifest.appRange, release.appRange);
  assert.deepEqual(manifest.dependencies, name === 'voice-shared-runtime' ? {} : {'ai-buddy.voice-shared-runtime': '1.0.1'});
  assert.equal(downloads.assetsSha256, sha(assetBytes), 'The download mapping must bind the unchanged asset inventory');
  const inventory = new Map(assets.files.map(file => [file.path, file]));
  const archived = new Set(downloads.archives.flatMap(archive => archive.files));
  const covered = new Set();
  for (const path of [...downloads.archives.flatMap(archive => archive.files), ...(downloads.directFiles ?? []).map(file => file.path)]) {
    assert.ok(inventory.has(path) && !inventory.get(path).url && !covered.has(path), 'Download paths must cover declared files once');
    covered.add(path);
  }
  assert.ok(assets.files.every(file => file.url || covered.has(file.path)), 'Every asset needs a pinned source or download mapping');
  const url = `${release.repository}/releases/download/${release.tag}/${manifest.id}-${release.version}.zip`;
  const result = await packagePlugin({manifest: template, files: directory, out: join(output, name), url});
  const entry = await json(result.entry);
  entry.publishedAt = release.publishedAt;
  await writeFile(result.entry, JSON.stringify(entry, null, 2));
  const bytes = await readFile(result.archive), inspected = inspectPluginArchive(bytes, entry.manifest);
  for (const file of inspected.entries) {
    assert.ok(!/\.(?:wav|mp3|flac|ogg|zip|exe|dll|bin|pth|ckpt)$/i.test(file.path), 'Plugin ZIPs contain metadata and wrapper source only');
    const packed = bytes.subarray(file.begin, file.stop), raw = file.method ? inflateRawSync(packed) : packed;
    assert.ok(!/\b[A-Za-z]:[\\/]|\/(?:Users|home)\/|Administrator/.test(raw.toString('utf8')), `Private absolute path in ${name}/${file.path}`);
    if (file.path !== 'plugin.json') assert.equal(sha(raw), entry.manifest.files.find(row => row.path === file.path).sha256);
  }
  const directBytes = assets.files.filter(file => file.url || !archived.has(file.path)).reduce((total, file) => total + file.bytes, 0);
  packages.push({id: manifest.id, version: manifest.version, archive: relative(output, result.archive).replaceAll('\\', '/'),
    releaseEntry: relative(output, result.entry).replaceAll('\\', '/'), url, sha256: result.sha256, bytes: result.bytes,
    assetsSha256: sha(assetBytes), downloadsSha256: sha(await readFile(join(directory, 'downloads.json'))),
    assetFiles: inventory.size, downloadBytes: downloads.archives.reduce((total, archive) => total + archive.bytes, 0) + directBytes});
}
await writeFile(join(output, 'packages.json'), JSON.stringify({schemaVersion: 1, version: release.version, publishedAt: release.publishedAt,
  source, packages, archivePrivacyCheck: true, completeDownloadMapping: true, signed: false, published: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, packages: packages.map(({id, bytes, sha256}) => ({id, bytes, sha256})), signed: false, published: false}, null, 2));
