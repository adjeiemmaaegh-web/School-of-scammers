/* Zero-dependency repeatable checks: requires only installed node and tsc. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'plc-fat-'));
let count=0;
const check=(description,fn)=>{fn();count++;console.log(`PASS ${count}: ${description}`);};
try{
 cp.execFileSync('tsc',['--strict','--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom','--skipLibCheck','--outDir',out,'src/engineering/factory-acceptance.ts'],{cwd:root,stdio:'pipe'});
 const mod=require(path.join(out,'engineering/factory-acceptance.js'));
 const {workcellLadder}=require(path.join(out,'engineering/workcell.js'));
 const {newBoard,changeBoard}=require(path.join(out,'engineering/wiring-board.js'));
 const run=(id)=>mod.runFactoryAcceptance(workcellLadder,'fixture',undefined,[id]).cases[0];
 const all=mod.runFactoryAcceptance();
 check('10 scripted acceptance procedures',()=>assert.equal(all.total,10));
 check('Reference implementation satisfies all scenarios',()=>assert.equal(all.passed,10));
 check('No scenario failed',()=>assert.equal(all.failed,0));
 check('Results deterministic',()=>assert.deepEqual(all,mod.runFactoryAcceptance()));
 check('All cases use bounded simulation clocks',()=>assert.ok(all.cases.every(c=>c.scans<=1000&&c.scans>=1)));
 check('Evidence per case increases monotonically',()=>assert.ok(all.cases.every(c=>c.evidence.every((e,i)=>i===0||e.scan>c.evidence[i-1].scan))));
 for(const def of mod.FAT_DEFINITIONS)check(`${def.id} individual scenario`,()=>assert.equal(run(def.id).passed,true));
 check('Hazard shown with motor running after welded-contact STOP',()=>assert.equal(run('welded-contactor').checks.find(c=>c.name.startsWith('Hazard:')).actual,'ON'));
 check('Hazard cleared when supply isolated',()=>assert.equal(run('welded-contactor').evidence.at(-1).motor,false));
 const missing=(tag)=>({...workcellLadder,rungs:workcellLadder.rungs.map(r=>({...r,elements:r.elements.filter(e=>e.type!=='contact'||e.tag!==tag)}))});
 check('Unprotected sensor logic fails acceptance',()=>assert.equal(mod.runFactoryAcceptance(missing('SensorOK'),'fixture',undefined,['sensor-loss']).failed,1));
 check('Unprotected guard logic fails acceptance',()=>assert.equal(mod.runFactoryAcceptance(missing('GuardClosed'),'fixture',undefined,['guard-restart']).failed,1));
 check('Unwired board fails',()=>assert.equal(mod.runFactoryAcceptance(workcellLadder,'configured-board',newBoard(),['start-permissives']).failed,1));
 const wired=changeBoard(changeBoard(newBoard(),{kind:'connect',from:'PS.P',to:'I0.IN'},false),{kind:'connect',from:'PS.M',to:'I0.COM'},false);
 check('Powered I0.2 board passes',()=>assert.equal(mod.runFactoryAcceptance(workcellLadder,'configured-board',wired,['start-permissives']).passed,1));
 check('Configured-board sensor open breaks the actual input circuit',()=>assert.equal(mod.runFactoryAcceptance(workcellLadder,'configured-board',wired,['sensor-loss']).passed,1));
 check('Automated board fault injection never mutates user board',()=>{const before=JSON.stringify(wired);mod.runFactoryAcceptance(workcellLadder,'configured-board',wired,['sensor-loss']);assert.equal(JSON.stringify(wired),before);});
 check('Configured mode requires board',()=>assert.throws(()=>mod.runFactoryAcceptance(workcellLadder,'configured-board')));
 check('Invalid program rejected',()=>assert.throws(()=>mod.runFactoryAcceptance({...workcellLadder,rungs:[]})));
 check('Duplicate FAT case rejected',()=>assert.throws(()=>mod.runFactoryAcceptance(workcellLadder,'fixture',undefined,['sensor-loss','sensor-loss'])));
 check('Empty FAT case selection rejected',()=>assert.throws(()=>mod.runFactoryAcceptance(workcellLadder,'fixture',undefined,[])));
 check('CSV contains summary and evidence',()=>{assert.match(mod.fatChecksCsv(all),/criterion,expected/);assert.match(mod.fatEvidenceCsv(all),/starterDiagnostic/);});
 check('CSV formula cannot become a formula from fixed generated data',()=>assert.ok(all.cases.every(c=>c.checks.every(k=>!k.name.startsWith('=')))));
 console.log(`PASS: ${count}/${count} standalone focused checks`);
} finally{fs.rmSync(out,{recursive:true,force:true});}
