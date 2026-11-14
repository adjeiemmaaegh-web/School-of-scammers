/**
 * P15 production Chromium -> private assessment Worker -> real PLC -> actual
 * bottle feeder, belt, filler and interlocked capper, repeated three times.
 * The browser supplies neither body injection nor forged PLC outputs.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const BASE=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const st=logic=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',' In3 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 ' Out2 : BOOL;',' Out3 : BOOL;','END_VAR',logic,
].join('\n');
const patch=[
 ['scene-supply.P24','scene-plc.L+'],
 ['scene-supply.M0','scene-plc.M'],
 ['scene-plc.Q0.0','feeder.CMD_feed+'],
 ['scene-supply.M0','feeder.M-'],
 ['scene-plc.Q0.1','belt.CMD_run+'],
 ['scene-supply.M0','belt.M-'],
 ['scene-plc.Q0.2','filler.CMD_fill+'],
 ['scene-supply.M0','filler.M-'],
 ['scene-plc.Q0.3','capper.CMD_cap+'],
 ['scene-supply.M0','capper.M-'],
].map(([from,to],i)=>({id:'p15-wire-'+i,from,to}));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const state=()=>page.$eval('[data-p15-batch]',e=>e.dataset.p15BatchState);
 const run=async(expected)=>{
  await page.$eval('[data-p12-matrix]',e=>{e.open=true;});
  assert.equal(await page.$eval('[data-p15-run-batch]',e=>e.disabled),false);
  await page.click('[data-p15-run-batch]');
  try{
   await page.waitForFunction(()=>['passed','failed'].includes(
    document.querySelector('[data-p15-batch]')?.dataset.p15BatchState)||
    !!document.querySelector('[data-p12-error]'),{timeout:120000});
  }catch(e){
   throw Error('P15 real multiple-product Worker timeout: '+JSON.stringify({
    state:await state(),error:await page.$eval('[data-p12-matrix]',x=>x.textContent.slice(-1200)),
    cause:String(e),errors
   }));
  }
  const actual=await state();
  if(actual!==expected)throw Error('P15 expected '+expected+', got '+actual+': '+
   await page.$eval('[data-p15-batch]',e=>e.textContent.slice(-3500)));
 };
 try{
  await page.setViewport({width:1440,height:960});
  await page.goto(BASE+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:20000});
  await page.$eval('[data-p9-scene-gallery]',e=>{e.open=true;});
  await page.click('[data-load-plant-scene="bottle-line"]');
  await page.waitForSelector('[data-p15-batch]',{timeout:20000});
  assert.equal(await state(),'setup');
  assert.equal(await page.$eval('[data-p15-run-batch]',e=>e.disabled),true,
   'Unwired original factory cannot self-grade multi-product processing');
  await page.evaluate((key,wires,source)=>{
   const p=JSON.parse(localStorage.getItem(key));
   assertScene(p);
   p.wires=wires;p.language='st';p.stSource=source;
   localStorage.setItem(key,JSON.stringify(p));
   function assertScene(p){
    if(p.params?.feeder?.shapeMode!==1||p.params?.capper?.requiresFilled!==1)
     throw Error('Not the original physically interlocked bottle line');
   }
  },KEY,patch,st('Out0 := In0; Out1 := In1; Out2 := In2; Out3 := In3;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p15-batch]',{timeout:20000});
  await run('passed');
  const cases=await page.$$eval('[data-p15-case]',els=>els.map(e=>({
   id:e.dataset.p15Case,pass:e.dataset.p15CaseState,detail:e.textContent,
  })));
  assert.deepEqual(cases.map(c=>[c.id,c.pass]),[
   ['idle','pass'],['product-1','pass'],['fault-recovery','pass'],
   ['product-2','pass'],['product-3','pass'],
  ]);
  assert.ok(cases.filter(c=>c.id.startsWith('product-')).every(c=>
   /Original physical body b\d+ processed/.test(c.detail)));
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(saved.wires.length,10);
  assert.equal(saved.components.some(c=>c.id.startsWith('p15-batch-switch-')),false);
  assert.equal(JSON.stringify(saved).includes('verifiedProducts'),false);
  await page.evaluate((key,source)=>{
   const p=JSON.parse(localStorage.getItem(key));
   p.stSource=source;localStorage.setItem(key,JSON.stringify(p));
  },KEY,st('Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Out3 := TRUE;'));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p15-batch]',{timeout:20000});
  assert.equal(await state(),'setup','The previous passing batch report must not persist');
  await run('failed');
  assert.equal(await page.$eval('[data-p15-case="idle"]',
   e=>e.dataset.p15CaseState),'fail');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P15 MULTI-PRODUCT BROWSER PASS: three original PLC-controlled bottles, stable physical IDs, measured fill, cap, wrong-program rejection and no stored assessment');
 }finally{await browser.close();}
})().catch(e=>{console.error('P15 MULTI-PRODUCT BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
