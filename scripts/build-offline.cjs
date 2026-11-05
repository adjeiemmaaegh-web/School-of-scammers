#!/usr/bin/env node
/** Generate an immutable, versioned offline cache manifest from the production build.
 * This is browser-hosted shell caching, not server storage or guaranteed data backup.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
if(!fs.existsSync(path.join(dist,'index.html')))throw Error('Run Vite build before generating offline worker');
const files=[];
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,ent.name),rel=path.relative(dist,full).replaceAll(path.sep,'/');
  if(ent.isDirectory())walk(full);
  else if(ent.isFile()&&rel!=='sw.js'&&!rel.endsWith('.map'))files.push(rel);
 }
}
walk(dist);
files.sort();
if(!files.some(x=>x.startsWith('assets/')&&x.endsWith('.js')))throw Error('Missing hashed Vite JavaScript assets');
if(!files.includes('index.html'))throw Error('Missing index.html');
const urls=['/',...files.map(file=>'/'+file)];
const hash=crypto.createHash('sha256');
for(const rel of files){hash.update(rel);hash.update(fs.readFileSync(path.join(dist,rel)));}
const version=hash.digest('hex').slice(0,16);
const template=fs.readFileSync(path.join(__dirname,'offline-worker-template.cjs'),'utf8');
if(!template.includes('/*__PRECACHE__*/')||!template.includes('/*__VERSION__*/'))throw Error('Service worker template markers missing');
const source=template.replace('/*__PRECACHE__*/',JSON.stringify(urls)).replace('/*__VERSION__*/',JSON.stringify(version));
fs.writeFileSync(path.join(dist,'sw.js'),source,'utf8');
const written=fs.readFileSync(path.join(dist,'sw.js'),'utf8');
for(const item of urls)if(!written.includes(JSON.stringify(item)))throw Error('Offline manifest omitted '+item);
if(urls.length>600)throw Error('Unexpected number of precache files');
console.log('OFFLINE BUILD PASS: '+urls.length+' shell/asset paths, cache version '+version);
