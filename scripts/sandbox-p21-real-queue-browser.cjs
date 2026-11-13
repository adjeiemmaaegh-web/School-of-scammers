/**
 * P21 Chromium: original unsolved gate-accumulation factory, independently
 * authored two-product PLC source and real 24 V load/sensor wiring.
 *
 * Private Worker must witness physical b2/b1 contact dwell (not a fake jam),
 * actual Q-driven pusher clears b1 without erasing it, and a genuinely new
 * PLC reset after maintenance delivers the original b2. Wrong source fails.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const source=()=>[
 'VAR_INPUT',...Array.from({length:5},(_,i)=>' In'+i+' : BOOL;'),
 'END_VAR','VAR_OUTPUT',...Array.from({length:5},(_,i)=>' Out'+i+' : BOOL;'),
 'END_VAR','VAR',' Phase : INT := 0;',' Delay : INT := 0;','END_VAR',
 ...Array.from({length:5},(_,i)=>'Out'+i+' := FALSE;'),
 'CASE Phase OF',
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;',
 '2: Out1 := TRUE; Out2 := TRUE; Delay := Delay + 1; IF Delay >= 23 THEN Phase := 3; END_IF;',
 '3: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 4;',
 '4: Out1 := TRUE; Out2 := TRUE; IF In1 THEN Phase := 5; END_IF;',
 '5: Out1 := TRUE; Out4 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; Out4 := TRUE; Out3 := In4; IF In4 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; Out4 := TRUE;',
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
 ];
 return pairs.map(([from,to],i)=>({id:'p21-browser-real-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const status=()=>page.$eval('[data-p21-queue]',e=>e.dataset.p21State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p21-run-queue]',e=>e.disabled),false,
   'Power and program preflight must be satisfied before assessment');
  await page.click('[data-p21-run-queue]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p21-queue]')?.dataset.p21State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await status();
  if(actual!==expected)throw Error('P21 expected '+expected+' got '+actual+': '+
   await page.$eval('[data-p21-queue]',e=>e.textContent.slice(-15000)));
 }
 try{
  await page.setViewport({width:1440,height:980});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="gate-accumulation"]');
  await page.waitForSelector('[data-p21-queue]',{timeout:20000});
  assert.equal(await status(),'setup');
  assert.equal(await page.$eval('[data-p21-run-queue]',e=>e.disabled),true,
   'Original unprogrammed factory cannot pass a staged private queue trial');
  await page.evaluate((key,edges,code)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p||!p.components.some(c=>c.id==='stopper')||
    !p.components.some(c=>c.id==='belt'))
    throw Error('Original gate-accumulation scene not loaded');
   p.components=p.components.map(c=>c.id==='feeder'?{...c,x:430,y:225}:c);
   p.components.push({id:'pusher',kind:'pusher',x:473,y:225,pressed:false});
   p.wires=edges;p.language='st';p.stSource=code;
   p.params={...p.params,
    belt:{...p.params?.belt,lengthMm:600,widthMm:150,speedMmS:250,
     jamResetMode:1,obstructionTripMode:0,
     accumulationTripMode:1,accumulationDwellMs:200},
    pusher:{speedMmS:250,strokeMm:260,maxMassKg:20}};
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE,wires(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p21-queue]',{timeout:20000});
  await run('passed');
  assert.equal(await page.$eval('[data-p21-replay]',e=>e.dataset.p21Replay),'pass');
  assert.deepEqual(await page.$$eval('[data-p21-lot]',els=>els.map(e=>[
   e.dataset.p21Lot,e.dataset.p21LotState
  ])),[['0','pass'],['1','pass'],['2','pass'],['3','pass']]);
  assert.equal(await page.$$eval('[data-p21-case-state="fail"]',els=>els.length),0);
  const visible=await page.$eval('[data-p21-result]',e=>e.textContent);
  assert.match(visible,/Original physical cartons:\s*6/i);
  assert.match(visible,/received:\s*3/i);
  assert.match(visible,/diverted by real pusher:\s*3/i);
  assert.match(visible,/physical-pair-dwell/);
  assert.match(visible,/genuine-physical-clearance/);
  assert.match(visible,/new-powered-reset/);
  const original=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(original.components.some(c=>['p21-start','p21-maintenance'].includes(c.id)),false);
  assert.equal(JSON.stringify(original).includes('accumulationBodyId'),false);
  console.log('P21 REAL BODY QUEUE BROWSER PASS: original unsolved scene to authored PLC, two source-fed cartons, true continuous collision dwell, physical Q pusher, post-clearance reset and exact replay');
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace(
    '6: Out1 := TRUE; Out4 := TRUE; Out3 := In4; IF In4 THEN Phase := 7; END_IF;',
    '6: Out1 := TRUE; Out4 := TRUE; IF In4 THEN Phase := 7; END_IF;');
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p21-queue]',{timeout:20000});
  assert.equal(await status(),'setup');
  await run('failed');
  assert.equal(await page.$eval('[data-p21-lot="0"]',
   e=>e.dataset.p21LotState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P21 REAL BODY QUEUE SOURCE-NEGATIVE BROWSER PASS: missing powered reset fails and stored project retains no assessor-only state');
 }finally{await browser.close();}
})().catch(e=>{console.error('P21 REAL BODY QUEUE BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
