/** Dependency-free source syntax gate. Uses a system TypeScript installation, not app dependencies. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function compiler(){
  try{return require('typescript')}catch{}
  const bin=cp.execFileSync('which',['tsc'],{encoding:'utf8'}).trim();
  return require(path.resolve(bin,'../../lib/node_modules/typescript'));
}
const ts=compiler();
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|mts|cts)$/.test(e.name))files.push(p);}}
walk(path.join(root,'src'));walk(path.join(root,'tests'));files.push(path.join(root,'vite.config.ts'));
let diagnostics=[];
for(const file of files){const source=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of sf.parseDiagnostics){const at=sf.getLineAndCharacterOfPosition(d.start||0);diagnostics.push(`${path.relative(root,file)}:${at.line+1}:${at.character+1} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}}
if(diagnostics.length){console.error(diagnostics.join('\n'));process.exit(1)}
console.log(`PASS: ${files.length} TypeScript/TSX files parse cleanly (TypeScript ${ts.version}). Syntax only; not semantic typechecking.`);
