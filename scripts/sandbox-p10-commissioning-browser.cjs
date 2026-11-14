/** P10 browser commissioning: actual 21-scene gallery -> real worker -> evidence.
 * No app state mutation except documented local project restore for wiring;
 * assertions only inspect worker rendered state after real boot and scan.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const checked=async(page,id)=>page.$eval('[data-p10-check="'+id+'"]',
 el=>el.getAttribute('data-p10-check-state'));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1440,height:960});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true});
  await page.click('[data-load-plant-scene="sorting-line"]');
  await page.waitForSelector('[data-p10-commissioning]',{timeout:18000});
  assert.equal(await page.$eval('[data-p10-commissioning]',
   el=>el.getAttribute('data-p10-scene-id')),'sorting-line');
  assert.equal(await checked(page,'equipment'),'pass');
  assert.equal(await checked(page,'plc-power'),'pending');
  assert.equal(await checked(page,'io-patches'),'pending');
  assert.equal(await checked(page,'program'),'pending');
  assert.equal(await checked(page,'scan'),'pending');
  assert.equal(await checked(page,'response'),'pending');
  assert.equal(await checked(page,'faults'),'pass');
  const start=await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')]
    .find(x=>x.textContent.trim()==='▶ Run'&&!x.disabled);
   if(!b)return false;b.click();return true;
  });
  assert.equal(start,true,'Must start actual worker');
  await page.waitForFunction(()=>
   document.querySelector('[data-p10-check="scan"]')
    ?.getAttribute('data-p10-check-state')==='pass',{timeout:20000});
  assert.equal(await checked(page,'plc-power'),'pending',
   'An unwired PLC remains OFF even when world time advances');
  const original=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(original.wires.length,0);
  const wired={...original,wires:[
   {id:'power-v',from:'scene-supply.P24',to:'scene-plc.L+'},
   {id:'power-m',from:'scene-supply.M0',to:'scene-plc.M'},
   {id:'in-eye',from:'eye1.OUT_present',to:'scene-plc.I0.0'},
   {id:'out-belt',from:'scene-plc.Q0.0',to:'belt.CMD_run+'},
   {id:'out-gate',from:'scene-plc.Q0.1',to:'gate.CMD_reject+'},
  ]};
  await page.evaluate((key,p)=>localStorage.setItem(key,JSON.stringify(p)),KEY,wired);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p10-commissioning]',{timeout:20000});
  // Diagnostics read only. There is no certification "force pass" button.
  assert.equal(await checked(page,'io-patches'),'pass');
  assert.equal(await checked(page,'scan'),'pending',
   'Simulation evidence must not survive a browser reload unexamined');
  const second=await page.evaluate(()=>{
   const b=[...document.querySelectorAll('button')]
    .find(x=>x.textContent.trim()==='▶ Run'&&!x.disabled);
   if(!b)return false;b.click();return true;
  });
  assert.ok(second);
  await page.waitForFunction(()=>document.querySelector('[data-p10-check="plc-power"]')
   ?.getAttribute('data-p10-check-state')==='pass',{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('[data-p10-check="scan"]')
   ?.getAttribute('data-p10-check-state')==='pass',{timeout:20000});
  assert.equal(await checked(page,'program'),'pending',
   'A powered PLC with placeholder source must not receive program credit');
  assert.equal(await checked(page,'response'),'pending',
   'An unsolved line must not fabricate a successful material cycle');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.wires.length,5);
  assert.deepEqual(errors.filter(s=>!/WebGL|GPU stall|favicon|swiftshader/i.test(s)),[]);
  console.log('P10 COMMISSIONING BROWSER PASS: unwired preflight, worker time, genuine 24V/IO, no false program/movement credit');
 } finally{await browser.close();}
})().catch(e=>{console.error('P10 COMMISSIONING BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
