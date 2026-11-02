/** Source-level integration guard for MC/DC generation and evidence freshness. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync('src/components/InstructionLab.tsx','utf8');
const generator=fs.readFileSync('src/engineering/mcdc-vector-generator.ts','utf8');
function validate(src){
 const marker='const result=generateMcdcVectors(bench.program);';
 const start=src.indexOf(marker);
 assert.ok(start>=0,'MC/DC generator action exists');
 const end=src.indexOf('setNotice(`Generated',start);
 assert.ok(end>start,'MC/DC action contains notice');
 const action=src.slice(start,end);
 const invalidate=action.indexOf('updateSequenceText(JSON.stringify(result.steps,null,2))');
 const retain=action.indexOf('setGeneratedVectors(result)');
 assert.ok(invalidate>=0&&retain>=0,'generated vectors are loaded and retained');
 assert.ok(invalidate<retain,'invalidate previous reports BEFORE saving newly generated witness evidence');
 assert.ok(src.includes('setGeneratedVectors(null);};'),'manual sequence edits invalidate generated witnesses');
 assert.ok(src.includes('disabled={!generatedVectors}'),'export disabled without current witnesses');
 assert.ok(src.includes('generatedWitnessCsv(generatedVectors)'),'witness export uses current evidence');
 assert.ok(generator.includes('Generated expectations are derived from the current ladder implementation'),'generated expectations are not independent oracle');
 return 7;
}
assert.equal(validate(source),7);
const broken=source.replace('updateSequenceText(JSON.stringify(result.steps,null,2));setGeneratedVectors(result);','setGeneratedVectors(result);updateSequenceText(JSON.stringify(result.steps,null,2));');
assert.throws(()=>validate(broken),/BEFORE/,'regression guard detects previous stale-evidence ordering');
console.log('PASS: 7 generated-evidence integration guards; historical defect mutation rejected');
