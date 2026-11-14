/**
 * P18 Chromium E2E: original unsolved bottle-line -> authored PLC16 ST +
 * actual 24V jam-sensor/reset wiring -> private Worker faults a moving belt,
 * repairs it, requires a real maintenance acknowledgement and same-bottle
 * recovery. Wrong PLC Q4 source is rejected; no test artifacts persist.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const body=[
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 '2: Out1 := TRUE; IF In1 THEN Phase := 3; END_IF;',
 '3: Out2 := TRUE; IF In2 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; IF In3 THEN Phase := 5; END_IF;',
 '5: Out3 := TRUE; IF In4 THEN Phase := 6; END_IF;',
 '6: Out1 := TRUE; IF In5 THEN Phase := 7; END_IF;',
 '7: Out1 := TRUE; IF NOT In5 THEN Count := Count + 1; Phase := 1; END_IF;',
];
const source=()=>[
 'VAR_INPUT',...Array.from({length:8},(_,i)=>' In'+i+' : BOOL;'),
 'END_VAR','VAR_OUTPUT',...Array.from({length:5},(_,i)=>' Out'+i+' : BOOL;'),
 'END_VAR','VAR',' Phase : INT := 0;',' Count : INT := 0;','END_VAR',
 ...Array.from({length:4},(_,i)=>'Out'+i+' := FALSE;'),
 'Out4 := In6 AND In7;',
 'CASE Phase OF',...body,'9: Out0 := FALSE;','END_CASE;',
].join('\n');
const wiring=()=>{
 const pairs=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 const output=[
  ['feeder','feed'],['belt','run'],['filler','fill'],
  ['capper','cap'],['belt','resetJam'],
 ];
 output.forEach(([id,act],i)=>pairs.push(
  ['scene-plc.Q0.'+i,id+'.CMD_'+act+'+'],
  ['scene-supply.M0',id+'.M-']));
 const inputs=[
  ['fill-eye','present'],['filler','filled'],['cap-eye','present'],
  ['capper','capped'],['exit-eye','present'],
 ];
 inputs.forEach(([id,sig],i)=>pairs.push(
  [id+'.OUT_'+sig,'scene-plc.I0.'+(i+1)],
  ['scene-supply.P24',id+'.L+'],['scene-supply.M0',id+'.M']));
 pairs.push(
  ['belt.OUT_jam','scene-plc.I0.6'],
  ['scene-supply.P24','belt.L+'],
  ['scene-supply.M0','belt.M']);
 return pairs.map(([from,to],i)=>({id:'p18-browser-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p18-jam]',e=>e.dataset.p18State);
 async function run(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p18-run-jam]',e=>e.disabled),false);
  await page.click('[data-p18-run-jam]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p18-jam]')?.dataset.p18State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const actual=await state();
  if(actual!==expected)throw Error('P18 expected '+expected+' but was '+actual+': '+
   await page.$eval('[data-p18-jam]',e=>e.textContent.slice(-5000)));
 }
 try{
  await page.setViewport({width:1440,height:970});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="bottle-line"]');
  await page.waitForSelector('[data-p18-jam]',{timeout:20000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p18-run-jam]',e=>e.disabled),true,
   'Original unprogrammed/unsupported bottle cell cannot auto-pass');
  await page.evaluate((key,edges,code)=>{
   const project=JSON.parse(localStorage.getItem(key));
   if(!project.components.some(c=>c.id==='belt')||
      !project.components.some(c=>c.id==='scene-plc'))
    throw Error('Original project missing real belt or PLC');
   project.wires=edges;project.language='st';project.stSource=code;
   project.params={...project.params,belt:{
    ...project.params?.belt,jamResetMode:1}};
   localStorage.setItem(key,JSON.stringify(project));
  },STORAGE,wiring(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p18-jam]',{timeout:20000});
  await run('passed');
  const check=await page.$$eval('[data-p18-case]',els=>els.map(e=>[
   e.dataset.p18Case,e.dataset.p18CaseState]));
  assert.deepEqual(check,[
   ['safe-idle','pass'],['stopped-product','pass'],
   ['latched-repair','pass'],['plc-reset','pass'],['same-product','pass'],
   ['entire-batch','pass'],['project-immutable','pass'],
  ]);
  const text=await page.$eval('[data-p18-result]',e=>e.textContent);
  assert.match(text,/original bottle\s+b2/i);
  assert.match(text,/produced 3, fully completed 3/);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(saved.components.some(c=>c.id==='p18-start'||
   c.id==='p18-maintenance-ack'),false);
  assert.equal(JSON.stringify(saved).includes('resetFromPlc'),false);
  // An identical scene with an invalid authored PLC cannot borrow a pass.
  await page.evaluate(key=>{
   const project=JSON.parse(localStorage.getItem(key));
   project.stSource=project.stSource.replace('Out4 := In6 AND In7;',
    'Out4 := FALSE;');
   localStorage.setItem(key,JSON.stringify(project));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p18-jam]',{timeout:20000});
  assert.equal(await state(),'setup');
  await run('failed');
  assert.equal(await page.$eval('[data-p18-case="plc-reset"]',
   e=>e.dataset.p18CaseState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P18 CONVEYOR JAM BROWSER PASS: original 24V PLC, moving real bottle belt fault, post-repair maintenance acknowledgement, physical same-body recovery, wrong reset refusal, non-persistence');
 }finally{await browser.close();}
})().catch(e=>{console.error('P18 CONVEYOR JAM BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
