/** P23 Chromium: learner-authored PLC, genuine consecutive motor-driven belts. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const source=()=>[
 'VAR_INPUT',...Array.from({length:8},(_,i)=>' In'+i+' : BOOL;'),
 'END_VAR','VAR_OUTPUT',...Array.from({length:6},(_,i)=>' Out'+i+' : BOOL;'),
 'END_VAR','VAR',' Phase : INT := 0;',' Delay : INT := 0;','END_VAR',
 ...Array.from({length:6},(_,i)=>'Out'+i+' := FALSE;'),
 'CASE Phase OF',
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;',
 '2: Out1 := TRUE; Out2 := TRUE; Delay := Delay + 1; IF Delay >= 23 THEN Phase := 3; END_IF;',
 '3: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 4;',
 '4: Out1 := TRUE; Out2 := TRUE; Out0 := In6 AND NOT In5; IF In1 THEN Phase := 5; END_IF;',
 '5: Out1 := TRUE; Out4 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; Out4 := TRUE; Out3 := In4; IF In4 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7; IF Out0 THEN Phase := 8; END_IF;',
 '8: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE;',
 'END_CASE;',
].join('\n');
const wires=()=>{
 const pairs=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
  ['scene-plc.Q0.0','feeder.CMD_feed+'],['scene-supply.M0','feeder.M-'],
  ['scene-plc.Q0.1','belt.CMD_run+'],['scene-supply.M0','belt.M-'],
  ['scene-plc.Q0.2','stopper.CMD_extend+'],['scene-supply.M0','stopper.M-'],
  ['scene-plc.Q0.3','belt.CMD_resetJam+'],
  ['scene-plc.Q0.4','pusher.CMD_extend+'],['scene-supply.M0','pusher.M-'],
  ['scene-supply.P24','belt.L+'],['scene-supply.M0','belt.M'],
  ['scene-supply.P24','stopper.L+'],['scene-supply.M0','stopper.M'],
  ['scene-supply.P24','pusher.L+'],['scene-supply.M0','pusher.M'],
  ['belt.OUT_accumulationTripped','scene-plc.I0.1'],
  ['stopper.OUT_retracted','scene-plc.I0.2'],
  ['pusher.OUT_extended','scene-plc.I0.3'],
  ['belt.OUT_zoneFull','scene-plc.I0.5'],
  ['scene-plc.Q0.5','receiver.CMD_run+'],
  ['scene-supply.M0','receiver.M-'],
  ['scene-supply.P24','receiver.L+'],
  ['scene-supply.M0','receiver.M'],
  ['receiver.OUT_zoneFull','scene-plc.I0.7'],
 ];
 return pairs.map(([from,to],i)=>({id:'p23-real-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const status=()=>page.$eval('[data-p23-handoff]',e=>e.dataset.p23State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p23-run-handoff]',e=>e.disabled),false,
   'P23 source/receiver electric and geometry preflight must be complete');
  await page.click('[data-p23-run-handoff]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p23-handoff]')?.dataset.p23State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await status();
  if(actual!==expected)throw Error('P23 expected '+expected+' got '+actual+': '+
   await page.$eval('[data-p23-handoff]',e=>e.textContent.slice(-15000)));
 }
 try{
  await page.setViewport({width:1440,height:980});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="gate-accumulation"]');
  await page.waitForSelector('[data-p23-handoff]',{timeout:20000});
  assert.equal(await status(),'setup');
  assert.equal(await page.$eval('[data-p23-run-handoff]',e=>e.disabled),true,
   'Unsolved default factory must not pass P23');
  await page.evaluate((key,edges,code)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p||!p.components.some(c=>c.id==='stopper')||
    !p.components.some(c=>c.id==='belt'))throw Error('Original gate scene missing');
   p.components=p.components.map(c=>c.id==='feeder'?{...c,x:430,y:225}:c);
   p.components.push({id:'pusher',kind:'pusher',x:479,y:225,pressed:false},
    {id:'receiver',kind:'belt-conveyor',x:515,y:225,pressed:false});
   p.wires=edges;p.language='st';p.stSource=code;
   p.params={...p.params,
    belt:{...p.params?.belt,lengthMm:600,widthMm:150,speedMmS:250,
     jamResetMode:1,obstructionTripMode:0,accumulationTripMode:1,
     accumulationDwellMs:200,zoneSensorMode:1,zoneCapacity:2},
    pusher:{speedMmS:250,strokeMm:260,maxMassKg:20},
    receiver:{lengthMm:600,widthMm:150,speedMmS:250,
     zoneSensorMode:1,zoneCapacity:1}};
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE,wires(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p23-handoff]',{timeout:20000});
  await run('passed');
  assert.equal(await page.$eval('[data-p23-replay]',e=>e.dataset.p23Replay),'pass');
  assert.deepEqual(await page.$$eval('[data-p23-lot]',els=>els.map(e=>[
   e.dataset.p23Lot,e.dataset.p23LotState
  ])),[['0','pass'],['1','pass'],['2','pass'],['3','pass']]);
  assert.equal(await page.$$eval('[data-p23-case-state="fail"]',els=>els.length),0);
  const visible=await page.$eval('[data-p23-result]',e=>e.textContent);
  assert.match(visible,/Original feeder-generated cartons:\s*9/i);
  for(const check of ['original-receiver-handoff','powered-receiver-transport',
   'full-receiver-inhibits-fresh-feed','physical-receiver-clearance',
   'fresh-third-after-receiver-clear'])assert.ok(visible.includes(check),check);
  const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(p.components.some(c=>['p23-start','p23-maint','p23-more'].includes(c.id)),false);
  assert.equal(JSON.stringify(p).includes('accumulationBodyId'),false);
  assert.equal(p.wires.some(w=>w.from==='receiver.OUT_zoneFull'),true);
  console.log('P23 PASS: real original b2 handoff, receiver Q0.5 and I0.7, inhibition, exit, b3 and replay');
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace(
    'Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7;',
    'Out0 := In6 AND NOT In5 AND NOT In1;');
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p23-handoff]',{timeout:20000});
  assert.equal(await status(),'setup');
  await run('failed');
  assert.ok(await page.$$eval(
   '[data-p23-case="full-receiver-inhibits-fresh-feed"][data-p23-case-state="fail"]',
   els=>els.length)>0,'Source-only feeder interlock must fail downstream-full request');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P23 NEGATIVE PASS: PLC ignoring actual receiver I0.7 feeds b3 too early and fails');
 }finally{await browser.close();}
})().catch(e=>{console.error('P23 REAL HANDOFF BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
