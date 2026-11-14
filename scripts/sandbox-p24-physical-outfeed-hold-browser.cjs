/** P24 Chromium: original unsolved factory -> authored ST -> original b2
 * physically jams downstream real stopper for 200ms, no premature release,
 * actual 24V hold feedback/release, source-negative and conserved b3.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const source=()=>[
 'VAR_INPUT',...Array.from({length:12},(_,i)=>' In'+i+' : BOOL;'),
 'END_VAR','VAR_OUTPUT',...Array.from({length:7},(_,i)=>' Out'+i+' : BOOL;'),
 'END_VAR','VAR',' Phase : INT := 0;',' Delay : INT := 0;',
 ' Released : BOOL := FALSE;','END_VAR',
 ...Array.from({length:7},(_,i)=>'Out'+i+' := FALSE;'),
 'CASE Phase OF',
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;',
 '2: Out1 := TRUE; Out2 := TRUE; Delay := Delay + 1; IF Delay >= 23 THEN Phase := 3; END_IF;',
 '3: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 4;',
 '4: Out1 := TRUE; Out2 := TRUE; Out0 := In6 AND NOT In5; IF In1 THEN Phase := 5; END_IF;',
 '5: Out1 := TRUE; Out4 := TRUE; IF In2 AND In3 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; Out4 := TRUE; Out3 := In4; IF In4 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := NOT Released; IF In8 AND In11 AND In9 THEN Released := TRUE; END_IF; Out0 := In6 AND NOT In5 AND NOT In1 AND NOT In7 AND In10 AND Released; IF Out0 THEN Phase := 8; END_IF;',
 '8: Out1 := TRUE; Out4 := TRUE; Out5 := TRUE; Out6 := FALSE;',
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
  ['scene-plc.Q0.6','outstop.CMD_extend+'],
  ['scene-supply.M0','outstop.M-'],
  ['scene-supply.P24','outstop.L+'],
  ['scene-supply.M0','outstop.M'],
  ['outstop.OUT_extended','scene-plc.I1.1'],
  ['outstop.OUT_retracted','scene-plc.I1.2'],
  ['outstop.OUT_heldLoad','scene-plc.I1.3'],
 ];
 return pairs.map(([from,to],i)=>({id:'p24-real-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const status=()=>page.$eval('[data-p24-hold]',e=>e.dataset.p24State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p24-run-hold]',e=>e.disabled),false,
   'Real stop, sensor, supply and original worker preflight must be satisfied');
  await page.click('[data-p24-run-hold]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p24-hold]')?.dataset.p24State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await status();
  if(actual!==expected)throw Error('P24 expected '+expected+' got '+actual+': '+
   await page.$eval('[data-p24-hold]',e=>e.textContent.slice(-20000)));
 }
 try{
  await page.setViewport({width:1440,height:980});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="gate-accumulation"]');
  await page.waitForSelector('[data-p24-hold]',{timeout:20000});
  assert.equal(await status(),'setup');
  assert.equal(await page.$eval('[data-p24-run-hold]',e=>e.disabled),true,
   'Original scene with no programmed PLC/outstop cannot pass');
  await page.evaluate((key,edges,code)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p||!p.components.some(c=>c.id==='belt')||
    !p.components.some(c=>c.id==='stopper'))
    throw Error('Original gate-accumulation scene missing');
   p.components=p.components.map(c=>c.id==='feeder'?{...c,x:430,y:225}:c);
   p.components.push(
    {id:'pusher',kind:'pusher',x:479,y:225,pressed:false},
    {id:'receiver',kind:'belt-conveyor',x:515,y:225,pressed:false},
    {id:'outstop',kind:'stopper',x:535,y:225,pressed:false});
   p.wires=edges;p.language='st';p.stSource=code;
   p.params={...p.params,
    belt:{...p.params?.belt,lengthMm:600,widthMm:150,speedMmS:250,
     jamResetMode:1,obstructionTripMode:0,accumulationTripMode:1,
     accumulationDwellMs:200,zoneSensorMode:1,zoneCapacity:2},
    pusher:{speedMmS:250,strokeMm:260,maxMassKg:20},
    receiver:{lengthMm:600,widthMm:150,speedMmS:250,
     zoneSensorMode:1,zoneCapacity:1},
    outstop:{travelMs:100,holdSensorMode:1,holdDwellMs:200}};
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE,wires(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p24-hold]',{timeout:20000});
  await run('passed');
  assert.equal(await page.$eval('[data-p24-replay]',e=>e.dataset.p24Replay),'pass');
  assert.deepEqual(await page.$$eval('[data-p24-lot]',els=>els.map(e=>[
   e.dataset.p24Lot,e.dataset.p24LotState
  ])),[['0','pass'],['1','pass'],['2','pass'],['3','pass']]);
  assert.equal(await page.$$eval('[data-p24-case-state="fail"]',els=>els.length),0);
  const visible=await page.$eval('[data-p24-result]',e=>e.textContent);
  assert.match(visible,/Original feeder cartons:\s*9/i);
  for(const expected of ['early-release-held-until-real-contact',
   '200ms-original-outstop-contact','original-carton-stationary-under-powered-drive',
   'held-receiver-inhibits-new-feed','24v-release-physical-stop-and-original-b2',
   'original-b2-outfeed-after-release','fresh-third-after-physical-outfeed'])
   assert.ok(visible.includes(expected),'Missing physical PLC case '+expected);
  const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(p.components.some(c=>['p24-start','p24-maint','p24-more',
   'p24-release'].includes(c.id)),false);
  assert.equal(JSON.stringify(p).includes('heldContactBodyId'),false);
  assert.equal(p.wires.some(w=>w.from==='outstop.OUT_heldLoad'),true);
  console.log('P24 POSITIVE PASS: original physical 200ms outstop hold I1.3, early release refused, Q0.6 release and real b3');
  // Negative: a PLC releasing based on I0.7 receiver-full instead of actual
  // jam-dwell I1.3 must drop outstop Q0.6 prematurely, before contact.
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   const previous='IF In8 AND In11 AND In9 THEN Released := TRUE; END_IF;';
   if(!p.stSource.includes(previous))throw Error('P24 test source anchor missing');
   p.stSource=p.stSource.replace(previous,
    'IF In8 AND In7 AND In9 THEN Released := TRUE; END_IF;');
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p24-hold]',{timeout:20000});
  assert.equal(await status(),'setup');
  await run('failed');
  assert.ok(await page.$$eval(
   '[data-p24-case="early-release-held-until-real-contact"][data-p24-case-state="fail"]',
   els=>els.length)>0,'Premature release on receiver-full instead of original physical dwell must fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P24 NEGATIVE PASS: PLC dropping outstop on receiver-full without 200ms original contact fails');
 }finally{await browser.close();}
})().catch(e=>{console.error('P24 PHYSICAL OUTFEED BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
