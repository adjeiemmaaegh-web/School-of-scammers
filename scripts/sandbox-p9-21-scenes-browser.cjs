/**
 * P9 real Chromium source-level acceptance:
 * - 21 original category/searchable plant scenes
 * - no hidden PLC program or wiring
 * - explicit two-click confirmation before replacing authored work
 * - worker-accepted saved orientation and elevated machine import
 * - browser persistence and normal real simulation clock
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const projectKey='efo-open-sandbox-project-v1';
const read=()=>JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try {
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'domcontentloaded',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true});
  assert.equal(await page.$$eval('[data-p9-scene-card]',es=>es.length),21);
  await page.type('[data-p9-scene-search]','WAREHOUSE');
  await page.waitForFunction(()=>
   document.querySelectorAll('[data-p9-scene-card]').length===2,{timeout:10000});
  assert.deepEqual(await page.$$eval('[data-p9-scene-card]',
   cards=>cards.map(c=>c.getAttribute('data-p9-scene-card'))),
   ['mini-warehouse','robot-warehouse-receiving']);
  await page.click('[data-p9-scene-search]');
  await page.keyboard.down('Control');await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');await page.keyboard.press('Backspace');
  await page.select('[data-p9-scene-category]','Safety & inspection');
  await page.waitForFunction(()=>
   document.querySelectorAll('[data-p9-scene-card]').length===3,{timeout:10000});
  assert.deepEqual(await page.$$eval('[data-p9-scene-card]',
   cards=>cards.map(c=>c.getAttribute('data-p9-scene-card'))),
   ['material-inspection','height-guard','guarded-conveyor']);
  await page.click('[data-load-plant-scene="guarded-conveyor"]');
  await page.waitForFunction(()=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.length===6&&p.wires.length===0&&
    p.components.some(c=>c.id==='curtain');
  },{timeout:20000});
  const first=await page.evaluate(read);
  assert.equal(first.components.length,6,'Must contain unsolved PLC, supply and original machines');
  assert.equal(first.wires.length,0,'No magic prewired scene');
  assert.equal(first.language,'ladder','Must not auto-load suggested ST reference solution');
  // Destructive action is now two-step and reversible while a project exists.
  await page.click('[data-load-plant-scene="height-guard"]');
  assert.equal(await page.$eval('[data-p9-scene-confirm-warning]',
   el=>el.textContent.includes('replaces your current project')),true);
  assert.deepEqual(await page.evaluate(read),first,
   'One-click should not destroy authored factory work');
  await page.click('[data-p9-scene-cancel]');
  assert.deepEqual(await page.evaluate(read),first);
  await page.click('[data-load-plant-scene="height-guard"]');
  await page.click('[data-load-plant-scene="height-guard"]');
  await page.waitForFunction(()=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.length===7&&p.wires.length===0&&
    p.components.some(c=>c.id==='push');
  },{timeout:20000});
  // New 3D orientation + elevation must survive actual browser worker save/reload.
  await page.select('[data-p9-scene-category]','Material handling');
  await page.click('[data-load-plant-scene="three-way-handoff"]');
  await page.click('[data-load-plant-scene="three-way-handoff"]');
  await page.waitForFunction(()=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id==='side')?.yawDeg===90;
  },{timeout:20000});
  await page.click('[data-load-plant-scene="scissor-lift-station"]');
  await page.click('[data-load-plant-scene="scissor-lift-station"]');
  await page.waitForFunction(()=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id==='out')?.elevationMm===1200;
  },{timeout:20000});
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  const saved=await page.evaluate(read);
  assert.equal(saved.components.find(c=>c.id==='out')?.elevationMm,1200);
  assert.equal(saved.wires.length,0);
  const run=await page.evaluate(()=>{
   const button=[...document.querySelectorAll('button')]
    .find(b=>b.textContent.trim()==='▶ Run'&&!b.disabled);
   if(!button)return false;button.click();return true;
  });
  assert.ok(run,'Learner can run, then wire/program scene on the original engine');
  await page.waitForFunction(()=>
   /World time:\s*[1-9][0-9]* ms/.test(
    document.querySelector('.sandbox-p3-world')?.textContent||''),
   {timeout:18000});
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P9 21 SCENES BROWSER PASS: filter/search, unsolved worker scene, destructive confirmation, yaw/elevation and reload');
 }finally{await browser.close();}
})().catch(e=>{console.error('P9 21 SCENES BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
