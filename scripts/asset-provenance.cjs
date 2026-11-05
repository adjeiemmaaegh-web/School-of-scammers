#!/usr/bin/env node
/** Source-controlled asset inventory for review; never claim automated legal approval. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const extensions=new Set(['.glb','.gltf','.obj','.fbx','.png','.jpg','.jpeg','.webp','.svg','.woff','.woff2','.ttf','.otf','.mp3','.mp4','.wav','.hdr','.exr','.gif']);
const found=[];
for(const dir of ['public','src'])walk(path.join(root,dir));
function walk(directory){
 if(!fs.existsSync(directory))return;
 for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const abs=path.join(directory,item.name);
  if(item.isSymbolicLink())continue;
  if(item.isDirectory())walk(abs);
  else if(item.isFile()&&extensions.has(path.extname(item.name).toLowerCase())){
   const bytes=fs.readFileSync(abs);
   found.push({path:path.relative(root,abs).split(path.sep).join('/'),bytes:bytes.length,
    sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    licenseStatus:'UNVERIFIED',provenanceStatus:'UNVERIFIED'});
  }
 }
}
found.sort((a,b)=>a.path.localeCompare(b.path));
process.stdout.write(JSON.stringify({schemaVersion:1,generatedBy:'source-file-hash-inventory',legalClearance:'NOT_ESTABLISHED',assets:found},null,2)+'\n');
