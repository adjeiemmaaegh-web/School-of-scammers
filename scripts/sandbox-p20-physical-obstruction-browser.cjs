/**
 * P20 Chromium: an original gate-accumulation scene is *unsolved*. A real
 * learner-equivalent user authors Q-driven feeder, belt, stopper and 24 V
 * sensor feedback, then the private Worker proves genuine contact trip,
 * physical clearance, post-clearance acknowledgement and original-body
 * motion with three seeded lots and exact replay. No synthetic fault Q.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const source=()=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',' In3 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;',' Out3 : BOOL;','END_VAR',
 'VAR',' Phase : INT := 0;','END_VAR',
 'Out0 := FALSE;','Out1 := FALSE;','Out2 := FALSE;','Out3 := FALSE;',
 'CASE Phase OF',
 '0: IF In0 THEN Phase := 1; END_IF;',
 '1: Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Phase := 2;',
 '2: Out1 := TRUE; Out2 := TRUE; IF In1 THEN Phase := 3; END_IF;',
 '3: Out1 := TRUE; IF In2 THEN Phase := 4; END_IF;',
 '4: Out1 := TRUE; Out3 := In3;',
 'END_CASE;',
].join('\n');
const wires=()=>{
 const pairs=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
  ['scene-plc.Q0.0','feeder.CMD_feed+'],['scene-supply.M0','feeder.M-'],
  ['scene-plc.Q0.1','belt.CMD_run+'],['scene-supply.M0','belt.M-'],
  ['scene-plc.Q0.2','stopper.CMD_extend+'],['scene-supply.M0','stopper.M-'],
  ['scene-plc.Q0.3','belt.CMD_resetJam+'],
  ['scene-supply.P24','belt.L+'],['scene-supply.M0','belt.M'],
  ['scene-supply.P24','stopper.L+'],['scene-supply.M0','stopper.M'],
  ['belt.OUT_obstructionTripped','scene-plc.I0.1'],
  ['stopper.OUT_retracted','scene-plc.I0.2'],
 ];
 return pairs.map(([from,to],i)=>({id:'p20-original-ui-wire-'+i,from,to}));
};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p20-obstruction]',e=>e.dataset.p20State);
 async function execute(expected){
  await page.$eval('[data-p12-matrix]',e=>{e.open=true});
  assert.equal(await page.$eval('[data-p20-run-obstruction]',e=>e.disabled),false);
  await page.click('[data-p20-run-obstruction]');
  await page.waitForFunction(()=>['passed','failed','blocked'].includes(
   document.querySelector('[data-p20-obstruction]')?.dataset.p20State)||
   !!document.querySelector('[data-p12-error]'),{timeout:120000});
  const status=await state();
  if(status!==expected)throw Error('Expected P20 '+expected+' got '+status+': '+
   await page.$eval('[data-p20-obstruction]',e=>e.textContent.slice(-13000)));
 }
 try{
  await page.setViewport({width:1440,height:950});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="gate-accumulation"]');
  await page.waitForSelector('[data-p20-obstruction]',{timeout:20000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p20-run-obstruction]',e=>e.disabled),true,
   'Original scene cannot pass absent real PLC source and powered wiring');
  await page.evaluate((key,edges,code)=>{
   const p=JSON.parse(localStorage.getItem(key));
   if(!p||!p.components.some(c=>c.id==='feeder')||
    !p.components.some(c=>c.id==='stopper')||
    !p.components.some(c=>c.id==='belt'))throw Error('Original gate workcell not loaded');
   p.components=p.components.map(c=>c.id==='feeder'?{...c,x:430,y:225}:c);
   p.wires=edges;p.language='st';p.stSource=code;
   p.params={...p.params,belt:{...p.params?.belt,
    jamResetMode:1,obstructionTripMode:1}};
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE,wires(),source());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p20-obstruction]',{timeout:20000});
  await execute('passed');
  assert.equal(await page.$eval('[data-p20-replay]',e=>e.dataset.p20Replay),'pass');
  const states=await page.$$eval('[data-p20-lot]',els=>els.map(e=>[
   e.dataset.p20Lot,e.dataset.p20LotState
  ]));
  assert.deepEqual(states,[['0','pass'],['1','pass'],['2','pass'],['3','pass']]);
  assert.equal(await page.$$eval('[data-p20-case-state="fail"]',els=>els.length),0);
  const content=await page.$eval('[data-p20-result]',e=>e.textContent);
  assert.match(content,/Original products recovered:\s*3\s*\/\s*3/i);
  assert.match(content,/actual-gate-contact/);
  assert.match(content,/fresh-plc-reset/);
  assert.match(content,/same-product-and-source/);
  const project=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE);
  assert.equal(project.components.some(c=>['p20-start','p20-ack'].includes(c.id)),false);
  assert.equal(JSON.stringify(project).includes('sensedOriginalGate'),false);
  console.log('P20 ORIGINAL GATE COLLISION BROWSER PASS: three independent real feeder lots, authentic worker body-to-gate trip, powered PLC stopper release, fresh reset, conserved same carton and replay');
  await page.evaluate(key=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=p.stSource.replace('4: Out1 := TRUE; Out3 := In3;',
    '4: Out1 := TRUE; Out3 := FALSE;');
   localStorage.setItem(key,JSON.stringify(p));
  },STORAGE);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p20-obstruction]',{timeout:20000});
  assert.equal(await state(),'setup');
  await execute('failed');
  assert.equal(await page.$eval('[data-p20-lot="0"]',
   e=>e.dataset.p20LotState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P20 ORIGINAL GATE SOURCE-NEGATIVE BROWSER PASS: wrong PLC cannot borrow a previous physical pass and no grader state persisted');
 }finally{await browser.close();}
})().catch(e=>{console.error('P20 ORIGINAL GATE COLLISION BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
