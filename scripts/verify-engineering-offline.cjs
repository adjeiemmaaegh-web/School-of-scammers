/** One-command offline verification of source syntax, contracts, and compiled PLC engines. */
const cp=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const run=(bin,args)=>cp.execFileSync(bin,args,{cwd:root,stdio:'inherit'});
run(process.execPath,['scripts/verify-source-offline.cjs']);
run(process.execPath,['scripts/check-integration-contracts.cjs']);
run(process.execPath,['scripts/test-integration-contracts.cjs']);
run(process.execPath,['scripts/check-evidence-freshness.cjs']);
run(process.execPath,['scripts/check-generated-vector-freshness.cjs']);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'plc-engineering-'));
try{
 run('tsc',['--target','es2022','--module','commonjs','--moduleResolution','node','--skipLibCheck','--outDir',temp,
 'src/engineering/ladder-sequences.ts','src/engineering/input-fault-scan-trace.ts','src/engineering/fault-matrix.ts','src/engineering/safety-invariants.ts','src/engineering/regression-suite.ts','src/engineering/workcell-session.ts','src/engineering/session-analysis.ts']);
 const compiled=path.join(temp,'engineering');
 run(process.execPath,['scripts/integration-smoke.cjs',compiled]);
 run(process.execPath,['scripts/session-integration-smoke.cjs',compiled]);
 console.log('PASS: complete offline source and compiled-engineering gate. Frontend dependency typecheck, Vite, Vitest and browser tests are NOT included.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
