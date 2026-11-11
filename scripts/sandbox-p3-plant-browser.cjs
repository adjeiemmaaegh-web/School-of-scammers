/**
 * P3 SOURCE-ONLY browser acceptance recipe for the integration developer.
 * Uses actual saved project, real PLC16 ST, physical 24V output -> box feeder,
 * geometry photoeye -> PLC input -> lamp. No mock or animation-owned logic.
 * Not an OS/device acceptance test and deliberately not inserted into CI.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const key='efo-open-sandbox-project-v1';
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',
 'Out0 := In0;','Out1 := In1;'].join('\n');
const components=[
 ['supply','supply',20,10],['plc16','plc16',260,10],
 ['feeder','box-feeder',700,250],['eye','geometry-photoeye',700,250],
 ['lamp','lamp',890,250],
].map(([id,kind,x,y])=>({id,kind,x,y,pressed:false}));
const links=[
 ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
 ['supply.P24','plc16.I0.0'],['plc16.Q0.0','feeder.CMD_enable+'],
 ['supply.M0','feeder.M-'],['supply.P24','eye.L+'],
 ['supply.M0','eye.M'],['eye.OUT_present','plc16.I0.1'],
 ['plc16.Q0.1','lamp.L+'],['supply.M0','lamp.M-'],
].map(([from,to],i)=>({id:'w'+(i+1),from,to}));
const project={formatVersion:1,components,wires:links,language:'st',stSource:ST,
 program:{id:'sandbox-program',version:'1.0',rungs:[
  {id:'rung-1',elements:[{type:'contact',tag:'In0'}],coil:'Out0'},
 ]}};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox',
  '--disable-setuid-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:20000});
  await page.evaluate((key,data)=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(data));},key,project);
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('[data-p3-scene-gallery], [data-p3-bodies]');
  await page.waitForSelector('[data-p3-bodies]');
  const clickText=async(label)=>{
   const ok=await page.evaluate(text=>{
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    if(!button||button.disabled)return false;button.click();return true;
   },label);
   assert.ok(ok,'Expected enabled button: '+label);
  };
  await clickText('▶ Run');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b=>b.textContent.trim()==='Pause'),{timeout:12000});
  await page.waitForFunction(()=>Number(document.querySelector('[data-p3-bodies]')?.textContent)>0,
    {timeout:15000});
  const bodies=Number(await page.$eval('[data-p3-bodies]',el=>el.textContent.trim()));
  assert.ok(bodies>=1,'At least one real worker-spawned box');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-p3-signal-list section')]
    .some(el=>el.textContent.includes('eye')&&el.textContent.includes('present = true')),
    {timeout:10000});
  await clickText('Pause');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-toolbar button')]
    .some(b=>b.textContent.trim()==='▶ Run'),{timeout:10000});
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),key);
  assert.equal(saved.components.length,5);
  assert.equal(saved.wires.length,10);
  assert.equal(saved.stSource,ST);
  assert.deepEqual(errors.filter(e=>!/WebGL|favicon|GPU stall/i.test(e)),[]);
  console.log('P3 SOURCE BROWSER PASS: actual PLC→feeder→body→photoeye, save/reopen ready');
 }finally{await browser.close();}
})().catch(e=>{console.error('P3 SOURCE BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
