/**
 * P8 operator workshop: actual focused First Person camera -> explicit opt-in
 * -> ephemeral worker operator target -> photoeye -> powered PLC16 ST -> lamp.
 * No camera position is treated as a sensor truth by Three.js.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const STORAGE='efo-open-sandbox-project-v1';
const st=['VAR_INPUT',' In0 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;','END_VAR','Out0 := In0;'].join('\n');
const components=[
 ['supply','supply',20,10,0],['plc16','plc16',260,10,0],
 ['eye','geometry-photoeye',910,450,90],['lamp','lamp',630,120,0],
].map(([id,kind,x,y,yawDeg])=>({id,kind,x,y,yawDeg,pressed:false}));
const wires=[
 ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
 ['supply.P24','eye.L+'],['supply.M0','eye.M'],
 ['eye.OUT_present','plc16.I0.0'],['plc16.Q0.0','lamp.L+'],
 ['supply.M0','lamp.M-'],
].map(([from,to],i)=>({id:'w'+(i+1),from,to}));
const project={formatVersion:1,components,wires,language:'st',stSource:st,
 params:{eye:{rangeMm:800,responseMs:0,beamMode:1,beamWidthMm:400,
  targetMode:1,detectOperator:1}},
 program:{id:'sandbox-program',version:'1.0',rungs:[{
  id:'rung-1',elements:[{type:'contact',tag:'In0'}],coil:'Out0',
 }]},
};
const active=()=>[...document.querySelectorAll('.sandbox-p3-signal-list section')]
 .find(s=>s.textContent.includes('Geometry photoeye · eye'))
 ?.textContent?.includes('present = true')??null;
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate((key,value)=>{localStorage.clear();localStorage.setItem(key,
    JSON.stringify(value));},STORAGE,project);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p8-training-operator]',{timeout:20000});
  const run=await page.evaluate(()=>{
   const button=[...document.querySelectorAll('button')]
    .find(b=>b.textContent.trim()==='▶ Run'&&!b.disabled);
   if(!button)return false;button.click();return true;
  });
  assert.ok(run,'Expected powered worker Run');
  await page.waitForFunction(()=>document.querySelector('.sandbox-p3-world')
   ?.textContent?.includes('World time:'),{timeout:15000});
  assert.equal(await page.evaluate(active),false,'Unenabled camera cannot generate a PLC signal');
  await page.click('[data-3d-camera-mode="first-person"]');
  await page.waitForFunction(()=>document.querySelector('[data-3d-camera-status]')
   ?.textContent?.includes('Eye height 1.8 m'),{timeout:15000});
  await page.click('[data-p8-training-operator]');
  await page.waitForFunction(active,{timeout:20000});
  assert.equal(await page.evaluate(active),true,'Worker optical target must be visible');
  const enabled=await page.$eval('[data-p8-training-operator]',x=>x.checked);
  assert.equal(enabled,true);
  await page.click('[data-3d-camera-mode="orbit"]');
  await page.waitForFunction(()=>document.querySelector('[data-p8-training-operator]')
   ?.checked===false,{timeout:15000});
  await page.waitForFunction(()=>![...document.querySelectorAll('.sandbox-p3-signal-list section')]
   .some(s=>s.textContent.includes('Geometry photoeye · eye')&&
    s.textContent.includes('present = true')),{timeout:20000});
  assert.equal(await page.evaluate(active),false,'Leaving First Person must stop sensing proxy');
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),STORAGE);
  assert.equal(saved.components.length,4);
  assert.equal(saved.wires.length,7);
  assert.equal(saved.params.eye.detectOperator,1);
  assert.equal(JSON.stringify(saved).includes('training-operator'),false,
   'Transient classroom actor must NEVER be persisted');
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P8 OPERATOR BROWSER PASS: explicit worker actor -> powered optical PLC chain -> disabled, no project persistence');
 }finally{await browser.close();}
})().catch(e=>{console.error('P8 OPERATOR BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
