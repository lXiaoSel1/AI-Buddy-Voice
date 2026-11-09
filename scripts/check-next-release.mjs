import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {assertNewReleaseCompatibility} from './lib/plugin-release-compatibility.mjs';
const root=resolve(import.meta.dirname,'..'),release=JSON.parse(await readFile(join(root,'release.json'),'utf8'));
for(const name of release.packageNames){const manifest=JSON.parse(await readFile(join(root,'manifests',name+'.json'),'utf8'));if(manifest.version!==release.version||manifest.appRange!==release.appRange)throw Error('Voice release/template identity differs');assertNewReleaseCompatibility(manifest);}
console.log(JSON.stringify({passed:true,version:release.version,packages:release.packageNames.length}));
