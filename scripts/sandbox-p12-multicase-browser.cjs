/** P12 browser acceptance: original gallery -> real learner ST + 24V machine
 * -> isolated browser module Worker -> four independent outcome cases -> fail
 * incorrect always-on PLC -> no grade/fixture corruption after reload.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const logic=(body)=>['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 'END_VAR',body].join('\n');
const wires=[
 ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
 ['scene-supply.M0','index.M-'],['scene-plc.Q0.0','index.CMD_turn+'],
 ['eye.OUT_present','scene-plc.I0.0'],
 ['scene-supply.P24','eye.L+'],['scene-supply.M0','eye.M'],
 ['index.OUT_indexed','scene-plc.I0.1'],
 ['scene-supply.P24','index.L+'],['scene-supply.M0','index.M'],
].map(([from,to],i)=>({id:'p12w'+(i+1),from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p12-matrix]',el=>el.getAttribute('data-p12-state'));
 try{
  await page.setViewport({width:1440,height:960,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:18000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true});
  await page.click('[data-load-plant-scene="rotary-inspection"]');
  await page.waitForSelector('[data-p12-matrix]',{timeout:16000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p12-run-matrix]',e=>e.disabled),true,
   'The default unsolved workcell cannot auto-pass assessment');
  await page.evaluate((key,links,st)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.wires=links;p.language='st';p.stSource=st;
   localStorage.setItem(key,JSON.stringify(p));
  },KEY,wires,logic('Out0 := In0 AND NOT In1; Out1 := FALSE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix]',{timeout:16000});
  assert.equal(await page.$eval('[data-p12-run-matrix]',el=>el.disabled),false);
  await page.click('[data-p12-run-matrix]');
  await page.waitForFunction(()=>document.querySelector('[data-p12-matrix]')
   ?.getAttribute('data-p12-state')==='passed',{timeout:45000});
  const checks=await page.$$eval('[data-p12-case]',es=>es.map(e=>({
   id:e.getAttribute('data-p12-case'),state:e.getAttribute('data-p12-case-state'),
   content:e.textContent,
  })));
  assert.deepEqual(checks.map(x=>[x.id,x.state]),[
   ['idle','pass'],['demand','pass'],['release','pass'],
   ['fault-recovery','pass'],
  ]);
  assert.ok(checks.every(c=>/simulated at \d+ ms/.test(c.content)));
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.wires.length,10);
  assert.equal(saved.components.some(c=>c.id==='p12-test-button'),false);
  assert.equal(JSON.stringify(saved).includes('matrixResult'),false);
  // A deliberately always-on program must fail physical idle/limit challenges.
  await page.evaluate((key,st)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=st;localStorage.setItem(key,JSON.stringify(p));
  },KEY,logic('Out0 := TRUE; Out1 := FALSE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix]',{timeout:16000});
  assert.equal(await state(),'setup',
   'A previous passing report must never survive source edit/reload');
  await page.click('[data-p12-run-matrix]');
  await page.waitForFunction(()=>document.querySelector('[data-p12-matrix]')
   ?.getAttribute('data-p12-state')==='failed',{timeout:45000});
  assert.equal(await page.$eval('[data-p12-case="idle"]',
   el=>el.getAttribute('data-p12-case-state')),'fail');
  const remaining=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(remaining.wires.length,10);
  assert.equal(remaining.components.some(c=>c.id==='p12-test-button'),false);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P12 REAL MULTI-CASE BROWSER PASS: four independent PLC/physics cases, deliberate wrong logic rejected, no fixture persistence');
 }finally{await browser.close();}
})().catch(error=>{console.error('P12 MULTI-CASE BROWSER FAIL',error.stack||String(error));process.exitCode=1;});
