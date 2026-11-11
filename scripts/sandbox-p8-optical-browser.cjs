/**
 * P8 browser commissioning: real saved 3D equipment and real 24V PLC16/ST
 * wiring. A worker-spawned body behind a user-configured opaque rack must NOT
 * assert the sensor, while the same plant with the opt-in flag disabled does.
 * This is a complete browser->worker->telemetry path, not a mocked sensor.
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
 ['feeder','box-feeder',575,250],['eye','geometry-photoeye',500,250],
 ['rack','shelf',540,290],['lamp','lamp',890,250],
].map(([id,kind,x,y])=>({id,kind,x,y,pressed:false,
 ...(id==='rack'?{yawDeg:90}:{})}));
const wires=[
 ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
 ['supply.P24','plc16.I0.0'],['plc16.Q0.0','feeder.CMD_enable+'],
 ['supply.M0','feeder.M-'],['supply.P24','eye.L+'],
 ['supply.M0','eye.M'],['eye.OUT_present','plc16.I0.1'],
 ['plc16.Q0.1','lamp.L+'],['supply.M0','lamp.M-'],
].map(([from,to],i)=>({id:'w'+(i+1),from,to}));
const project=(occlusionMode)=>({
 formatVersion:1,components,wires,language:'st',stSource:ST,
 params:{eye:{rangeMm:800,responseMs:0,beamMode:1,beamWidthMm:100,occlusionMode}},
 program:{id:'sandbox-program',version:'1.0',
  rungs:[{id:'rung-1',elements:[{type:'contact',tag:'In0'}],coil:'Out0'}]},
});
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 const runCase=async(mode,expected)=>{
  await page.evaluate((name,data)=>{
   localStorage.clear();localStorage.setItem(name,JSON.stringify(data));
  },key,project(mode));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p3-bodies]',{timeout:15000});
  const clicked=await page.evaluate(()=>{
   const button=[...document.querySelectorAll('button')]
    .find(b=>b.textContent.trim()==='▶ Run'&&!b.disabled);
   if(!button)return false;button.click();return true;
  });
  assert.ok(clicked,'Expected enabled Run command');
  await page.waitForFunction(()=>{
   const count=Number(document.querySelector('[data-p3-bodies]')?.textContent||0);
   const data=document.querySelector('.sandbox-p3-world')?.textContent||'';
   const time=Number(data.match(/World time:\s*(\d+)\s*ms/)?.[1]||0);
   return count>0&&time>=1550;
  },{timeout:20000});
  const actual=await page.evaluate(()=>{
   const section=[...document.querySelectorAll('.sandbox-p3-signal-list section')]
    .find(s=>s.textContent.includes('Geometry photoeye · eye'));
   return section?.textContent?.includes('present = true')??null;
  });
  assert.equal(actual,expected,
   'Actual worker photoeye must obey user-saved 3D occlusion setting '+mode);
  const saved=await page.evaluate(name=>JSON.parse(localStorage.getItem(name)||'null'),key);
  assert.equal(saved?.params?.eye?.occlusionMode,mode);
  assert.equal(saved?.components?.find(c=>c.id==='rack')?.yawDeg,90);
  assert.equal(saved?.wires?.length,10);
 };
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await runCase(1,false);
  await runCase(0,true);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P8 WORKER OCCLUSION BROWSER PASS: true PLC/ST/feeder/body, rotated rack blocks opt-in sensor but not legacy mode');
 }finally{await browser.close();}
})().catch(err=>{console.error('P8 WORKER OCCLUSION BROWSER FAIL',err.stack||String(err));process.exitCode=1;});
