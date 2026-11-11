/** P8 real browser: powered feeder -> moving body -> PLC-controlled belt
 * -> worker fixed-solid jam, versus identical legacy scene without blocking.
 * No fake CSS animation, client-generated body or synthetic PLC signal.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const storage='efo-open-sandbox-project-v1';
const ST=['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',
 'Out0 := In0;','Out1 := In0;'].join('\n');
const parts=[
 ['supply','supply',20,10],['plc16','plc16',260,10],
 ['belt','belt-conveyor',455,225],['feeder','box-feeder',435,225],
 ['rack','shelf',495,265],
].map(([id,kind,x,y])=>({id,kind,x,y,pressed:false,
 ...(id==='rack'?{yawDeg:90}:{})}));
const wires=[
 ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
 ['supply.P24','plc16.I0.0'],['plc16.Q0.0','feeder.CMD_enable+'],
 ['supply.M0','feeder.M-'],['plc16.Q0.1','belt.CMD_run+'],
 ['supply.M0','belt.M-'],
].map(([from,to],i)=>({id:'w'+(i+1),from,to}));
const project=(blocking)=>({
 formatVersion:1,components:parts,wires,language:'st',stSource:ST,
 params:{belt:{lengthMm:1000,speedMmS:500},
  ...(blocking?{rack:{blockMaterialFlow:1}}:{})},
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
 const inspect=()=>page.evaluate(()=>{
  const list=[...document.querySelectorAll('.sandbox-p3-body-list li')];
  const raw=list.map(l=>l.textContent||'');
  const belt=[...document.querySelectorAll('.sandbox-p3-signal-list section')]
   .find(s=>s.textContent.includes('Variable-speed belt conveyor · belt'));
  return {raw,jam:belt?.textContent?.includes('jam = true')??null};
 });
 const one=async (blocked)=>{
  await page.evaluate((name,data)=>{localStorage.clear();localStorage.setItem(name,
   JSON.stringify(data));},storage,project(blocked));
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p3-bodies]',{timeout:15000});
  const clicked=await page.evaluate(()=>{
   const button=[...document.querySelectorAll('button')]
    .find(b=>b.textContent.trim()==='▶ Run'&&!b.disabled);
   if(!button)return false;button.click();return true;
  });
  assert.ok(clicked,'Real worker Run control must be usable');
  // Wait for worker-generated material flow and actual simulation time, not
  // only an assumed wall-clock delay or decorative mesh movement.
  await page.waitForFunction(()=>{
   const count=Number(document.querySelector('[data-p3-bodies]')?.textContent||0);
   const text=document.querySelector('.sandbox-p3-world')?.textContent||'';
   const time=Number(text.match(/World time:\s*(\d+)\s*ms/)?.[1]||0);
   return count>0&&time>=2850;
  },{timeout:24000});
  await page.evaluate(()=>{
   const details=[...document.querySelectorAll('.sandbox-p3-world details')];
   for(const d of details)d.open=true;
  });
  const observed=await inspect();
  assert.ok(observed.raw.length,'A physical worker parcel must exist');
  if(blocked){
   assert.equal(observed.jam,true,'The worker belt must publish a real jam');
   assert.ok(observed.raw.some(t=>t.includes('jammed')),'A moving body must be blocked');
  }else{
   assert.equal(observed.jam,false,'Legacy free material flow cannot invent jams');
   assert.ok(observed.raw.some(t=>Number(t.match(/x\s+(-?\d+)\s*mm/)?.[1])>100),
    'An unblocked parcel must move past the fixed-solid threshold');
  }
  const saved=await page.evaluate(name=>JSON.parse(localStorage.getItem(name)||'null'),storage);
  assert.equal(saved?.components?.length,5);
  assert.equal(saved?.wires?.length,7);
  assert.equal(saved?.params?.rack?.blockMaterialFlow??0,blocked?1:0);
 };
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await one(true);
  await one(false);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P8 FIXED SOLID BROWSER PASS: worker-driven conveyor jam vs legacy free material flow');
 }finally{await browser.close();}
})().catch(err=>{console.error('P8 FIXED SOLID BROWSER FAIL',err.stack||String(err));process.exitCode=1;});
