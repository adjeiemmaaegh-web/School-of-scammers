/**
 * P7 physical editing constraint: a second identical transport surface
 * cannot occupy the same coordinates, while a real P3 mounted sensor may
 * overlap it. Checks the authoritative saved project, not visual warnings.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),STORAGE);
 const count=n=>page.waitForFunction((expected,key)=>
   JSON.parse(localStorage.getItem(key)||'null')?.components?.length===expected,
   {timeout:15000},n,STORAGE);
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-p7-place-kind]');
  await page.select('[data-p7-place-kind]','roller-conveyor');
  const box=await page.$eval('.sandbox-three-canvas canvas',el=>{
   const rect=el.getBoundingClientRect();
   return {x:rect.left,y:rect.top,width:rect.width,height:rect.height};
  });
  const click=async(x=0,y=0)=>{
   await page.mouse.click(box.x+box.width*.5+x,box.y+box.height*.5+y);
  };
  await click();await count(1);
  const first=(await saved()).components[0];
  assert.equal(first.kind,'roller-conveyor');
  await click();
  await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.
   textContent?.includes('Refused duplicate'),{timeout:10000});
  assert.equal((await saved()).components.length,1,'Duplicate carrier must be refused in the worker');
  await page.select('[data-p7-place-kind]','geometry-photoeye');
  await click();
  await count(2);
  const mounted=(await saved()).components.find(c=>c.kind==='geometry-photoeye');
  assert.ok(mounted,'A sensor may share a true conveyor footprint');
  await page.select('[data-p7-place-kind]','roller-conveyor');
  await click(90,0);await count(3);
  const parts=(await saved()).components;
  assert.equal(parts.filter(c=>c.kind==='roller-conveyor').length,2);
  assert.notEqual(parts[0].x,parts[2].x);
  await page.reload({waitUntil:'networkidle0'});
  await count(3);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P7 WORKER CLEARANCE PASS: duplicate carrier refused, intentional mounted sensor and adjacent conveyor allowed, reload');
 }finally{await browser.close();}
})().catch(e=>{console.error('P7 WORKER CLEARANCE FAIL',e.stack||String(e));process.exitCode=1;});
