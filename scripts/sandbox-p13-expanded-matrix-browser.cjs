/** P13 browser proof: first newly supported scene routes actual powered
 * PLC16 Q to a physical gate. The independent Worker must pass 4 real
 * scenarios for correct ST and reject a constant-on false solution.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const st=logic=>['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 'END_VAR',logic].join('\n');
const wires=[
 ['scene-supply.P24','scene-plc.L+'],
 ['scene-supply.M0','scene-plc.M'],
 ['scene-plc.Q0.0','gate.CMD_reject+'],
 ['scene-supply.M0','gate.M-'],
 ['eye1.OUT_present','scene-plc.I0.0'],
 ['scene-supply.P24','eye1.L+'],
 ['scene-supply.M0','eye1.M'],
].map(([from,to],i)=>({id:'p13-w'+(i+1),from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[],consoleErrors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
 const state=async()=>page.$eval('[data-p12-matrix]',
  el=>el.getAttribute('data-p12-state'));
 async function runCase(expectState){
  await page.$eval('[data-p12-matrix]',el=>{el.open=true;});
  assert.equal(await page.$eval('[data-p12-run-matrix]',b=>b.disabled),false);
  await page.click('[data-p12-run-matrix]');
  try{
   await page.waitForFunction(()=>['passed','failed'].includes(
    document.querySelector('[data-p12-matrix]')?.getAttribute('data-p12-state'))||
    !!document.querySelector('[data-p12-error]'),{timeout:25000});
  }catch(e){
   const debug=await page.evaluate(()=>({
    state:document.querySelector('[data-p12-matrix]')?.dataset.p12State,
    error:document.querySelector('[data-p12-error]')?.textContent,
    preflight:document.querySelector('[data-p12-preflight]')?.textContent,
    report:document.querySelector('[data-p12-matrix-result]')?.textContent?.slice(0,1800),
   }));
   throw Error('P13 Worker execution timed out: '+JSON.stringify({
    debug,errors,consoleErrors,cause:String(e)}));
  }
  if(await state()!==expectState){
   const report=await page.$eval('[data-p12-matrix]',el=>el.textContent.slice(-2200));
   throw Error('P13 expected '+expectState+', received '+await state()+': '+report);
  }
 }
 try{
  await page.setViewport({width:1440,height:950});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true;});
  await page.click('[data-load-plant-scene="sorting-line"]');
  await page.waitForSelector('[data-p12-matrix]',{timeout:20000});
  assert.equal(await page.$eval('[data-p12-matrix]',el=>el.dataset.p12SceneId),
   'sorting-line');
  assert.equal(await page.$eval('[data-p12-run-matrix]',el=>el.disabled),true,
   'Unsolved learning scene cannot be passed without actual PLC wiring');
  await page.evaluate((key,links,source)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.wires=links;p.language='st';p.stSource=source;
   localStorage.setItem(key,JSON.stringify(p));
  },KEY,wires,st('Out0 := In0; Out1 := FALSE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix]',{timeout:20000});
  await runCase('passed');
  const cases=await page.$$eval('[data-p12-case]',items=>items.map(x=>({
   id:x.getAttribute('data-p12-case'),
   pass:x.getAttribute('data-p12-case-state'),
   text:x.textContent,
  })));
  assert.deepEqual(cases.map(c=>[c.id,c.pass]),[
   ['idle','pass'],['demand','pass'],['release','pass'],
   ['fault-recovery','pass'],
  ]);
  assert.ok(cases.every(c=>/simulated at \d+ ms/.test(c.text)));
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.wires.length,7);
  assert.ok(!saved.components.some(c=>c.id==='p13-trial-switch'));
  assert.ok(!JSON.stringify(saved).includes('sourceSignature'));
  await page.evaluate((key,source)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=source;localStorage.setItem(key,JSON.stringify(p));
  },KEY,st('Out0 := TRUE; Out1 := FALSE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p12-matrix]',{timeout:20000});
  assert.equal(await state(),'setup');
  await runCase('failed');
  assert.equal(await page.$eval('[data-p12-case="idle"]',
   el=>el.getAttribute('data-p12-case-state')),'fail');
  const persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(persisted.wires.length,7);
  assert.ok(!persisted.components.some(c=>c.id==='p13-trial-switch'));
  // The specialized robot/gantry/bottle workcells must not render a false pass.
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true;});
  await page.click('[data-load-plant-scene="bottle-line"]');
  await page.waitForSelector('[data-p13-unavailable]',{timeout:20000});
  assert.ok((await page.$eval('[data-p13-unavailable]',
   el=>el.textContent)).includes('cylinder bottle'));
  assert.equal(await page.$$eval('[data-p12-matrix]',items=>items.length),0);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P13 EXTENDED MATRIX BROWSER PASS: original gate has 4 worker passes; constant ON rejected; bottle gap disclosed; no fixture persistence');
 }finally{await browser.close();}
})().catch(e=>{console.error('P13 EXTENDED MATRIX BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
