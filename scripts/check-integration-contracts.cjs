/* Dependency-free source integration gate. Uses global TypeScript if available. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{try{ts=require(path.join(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}catch{console.error('TypeScript compiler unavailable; install project dependencies or global TypeScript');process.exit(2)}}
const failures=[];let imports=0, routes=0, files=0;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.(ts|tsx)$/.test(e.name)?[path.join(dir,e.name)]:[])}
const sources=walk(path.join(root,'src'));
for(const file of sources){files++;const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('.')){imports++;const stem=path.resolve(path.dirname(file),n.moduleSpecifier.text);const candidates=[stem,stem+'.ts',stem+'.tsx',stem+'.js',stem+'.jsx',stem+'.json',path.join(stem,'index.ts'),path.join(stem,'index.tsx')];if(!candidates.some(p=>fs.existsSync(p)&&fs.statSync(p).isFile()))failures.push('Unresolved import '+path.relative(root,file)+' -> '+n.moduleSpecifier.text)}ts.forEachChild(n,visit)}visit(ast)}
const main=fs.readFileSync(path.join(root,'src/main.tsx'),'utf8');const registered=new Set([...main.matchAll(/<Route\s+path="([^"]+)"/g)].map(m=>m[1]));
const targets=[...main.matchAll(/\b(?:to|path)="(\/[^"]+)"/g)].map(m=>m[1]);
const catalog=fs.readFileSync(path.join(root,'src/lab-catalog.ts'),'utf8');targets.push(...[...catalog.matchAll(/\broute:'(\/[^']+)'|\bpath:'(\/[^']+)'/g)].map(m=>m[1]||m[2]));
targets.push(...[...main.matchAll(/\bnav\('(\/[^']+)'\)/g)].map(m=>m[1]));
for(const target of targets){routes++;if(!registered.has(target))failures.push('Unregistered navigation target '+target)}
if(!registered.has('*'))failures.push('Missing fallback route');
console.log(JSON.stringify({sourceFiles:files,relativeImportsChecked:imports,navigationTargetsChecked:routes,registeredRoutes:[...registered],failures},null,2));if(failures.length)process.exit(1);
