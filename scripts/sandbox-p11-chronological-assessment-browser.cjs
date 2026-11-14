/**
 * P11 Chrome E2E: genuine editable factory scene → native local project →
 * explicitly wired 24V PLC16 with original learner ST → actual worker-owned
 * rotary travel → two strictly ordered assessment witnesses.
 * No internal simulator stores, debug injection, fake time or DOM-only success.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const PROJECT='efo-open-sandbox-project-v1';
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;','END_VAR',
 'Out0 := NOT In1;'].join('\n');
const wires=[
 ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ['scene-supply.P24','index.L+'],['scene-supply.M0','index.M'],
 ['scene-supply.M0','index.M-'],
 ['scene-supply.P24','eye.L+'],['scene-supply.M0','eye.M'],
 ['eye.OUT_present','scene-plc.I0.0'],
 ['index.OUT_indexed','scene-plc.I0.1'],
 ['scene-plc.Q0.0','index.CMD_turn+'],
].map(([from,to],i)=>({id:'w'+(i+1),from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try {
  await page.setViewport({width:1440,height:960});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true});
  await page.click('[data-load-plant-scene="rotary-inspection"]');
  await page.waitForFunction(key=>
   JSON.parse(localStorage.getItem(key)||'null')
    ?.components?.some(c=>c.id==='index'),{timeout:20000},PROJECT);
  await page.waitForSelector('[data-p11-assessment]',{timeout:15000});
  assert.equal(await page.$eval('[data-p11-assessment]',
   e=>e.getAttribute('data-p11-state')),'setup');
  assert.equal(await page.$$eval('[data-p11-trial-goal]',n=>n.length),2);
  const unpowered=await page.$$eval('[data-p11-trial-goal]',
   n=>n.map(e=>e.getAttribute('data-p11-trial-state')));
  assert.deepEqual(unpowered,['pending','pending']);
  await page.evaluate((key,wires,st)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.wires=wires;p.language='st';p.stSource=st;
   localStorage.setItem(key,JSON.stringify(p));
  },PROJECT,wires,ST);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p11-assessment]',{timeout:15000});
  assert.equal(await page.$eval('[data-p11-trial-goal="turn"]',
   el=>el.getAttribute('data-p11-trial-state')),'pending');
  assert.equal(await page.$eval('[data-p10-check="io-patches"]',
   el=>el.getAttribute('data-p10-check-state')),'pass');
  assert.equal(await page.$eval('[data-p10-check="program"]',
   el=>el.getAttribute('data-p10-check-state')),'pass');
  const started=await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')]
    .find(e=>e.textContent.trim()==='▶ Run'&&!e.disabled);
   if(!b)return false;b.click();return true;
  });
  assert.ok(started,'Must start a genuinely wired Worker PLC');
  await page.waitForFunction(()=>
   document.querySelector('[data-p11-trial-goal="turn"]')
    ?.getAttribute('data-p11-trial-state')==='observed',{timeout:20000});
  await page.waitForFunction(()=>
   document.querySelector('[data-p11-assessment]')
    ?.getAttribute('data-p11-state')==='observed',{timeout:20000});
  const records=await page.$$eval('[data-p11-trial-goal]',es=>es.map(e=>({
   goal:e.getAttribute('data-p11-trial-goal'),
   state:e.getAttribute('data-p11-trial-state'),
   text:e.textContent,
  })));
  assert.deepEqual(records.map(e=>[e.goal,e.state]),[
   ['turn','observed'],['indexed','observed'],
  ]);
  const at=records.map(e=>Number(e.text.match(/Observed at (\d+) ms/)?.[1]));
  assert.ok(at.every(Number.isFinite)&&at[0]>=50&&at[1]>at[0],
   'Chronological proof must use two separate real Worker PLC scans');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROJECT);
  assert.equal(saved.wires.length,10);
  assert.equal(saved.language,'st');
  assert.equal(saved.stSource,ST);
  assert.equal(JSON.stringify(saved).includes('witnesses'),false);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p11-assessment]',{timeout:15000});
  assert.equal(await page.$eval('[data-p11-assessment]',
   el=>el.getAttribute('data-p11-state')),'setup',
   'Previous trial cannot be reused after browser restart');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P11 ORDERED WORKER ASSESSMENT PASS: original scene -> true PLC16 ST/Q -> rotary busy -> indexed; no false persistence');
 } finally{await browser.close();}
})().catch(e=>{console.error('P11 ORDERED WORKER ASSESSMENT FAIL',e.stack||String(e));process.exitCode=1;});
