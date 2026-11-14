/**
 * P8 browser composite-cell authoring: two independently saved workcells with
 * internal wires -> composed browser-local assembly -> authoritative worker
 * paste. No network and no fake worker mutation.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const libraryKey='plc-sandbox-local-assemblies-v1';
const projectKey='efo-open-sandbox-project-v1';
const device=(id,kind,x,y)=>({id,kind,x,y,pressed:false,yawDeg:0});
const fragmentA={version:1,components:[
 device('supplyA','supply',60,60),device('lampA','lamp',250,60),
],wires:[{id:'wireA',from:'supplyA.P24',to:'lampA.L+'}]};
const fragmentB={version:1,components:[
 device('supplyB','supply',60,60),
 device('eyeB','geometry-photoeye',250,60),
],wires:[{id:'wireB',from:'supplyB.P24',to:'eyeB.L+'}]};
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.evaluate((key,pairs)=>{
   localStorage.clear();localStorage.setItem(key,JSON.stringify(pairs));
  },libraryKey,[{id:1,name:'Lamp station',fragment:fragmentA},
    {id:2,name:'Photoeye station',fragment:fragmentB}]);
  await page.reload({waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-p7-assembly-library]',{timeout:20000});
  await page.$eval('[data-p7-assembly-library]',el=>el.open=true);
  await page.select('[data-assembly-select]','1');
  await page.click('[data-assembly-compose-add]');
  await page.select('[data-assembly-select]','2');
  await page.click('[data-assembly-compose-add]');
  const stack=await page.$eval('[data-assembly-compose-stack]',el=>el.textContent);
  assert.ok(stack.includes('Lamp station')&&stack.includes('Photoeye station'));
  await page.type('[data-assembly-name]','Combined PLC cell');
  await page.click('[data-assembly-compose-save]');
  await page.waitForFunction(key=>{
   const items=JSON.parse(localStorage.getItem(key)||'[]');
   return items.length===3;
  },{timeout:12000},libraryKey);
  const entries=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),libraryKey);
  assert.equal(entries.length,3);
  const composed=entries[2].fragment;
  assert.equal(composed.components.length,4);
  assert.equal(composed.wires.length,2);
  const names=new Set(composed.components.map(c=>c.id));
  assert.equal(names.size,4);
  for(const w of composed.wires){
   assert.ok(names.has(w.from.split('.')[0])&&names.has(w.to.split('.')[0]));
  }
  await page.select('[data-assembly-select]','3');
  await page.$eval('[data-assembly-x]',el=>{
   el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.$eval('[data-assembly-y]',el=>{
   el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.click('[data-assembly-insert]');
  await page.waitForFunction(key=>{
   const value=JSON.parse(localStorage.getItem(key)||'null');
   return value?.components?.length===4&&value?.wires?.length===2;
  },{timeout:16000},projectKey);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),projectKey);
  assert.equal(new Set(saved.components.map(c=>c.id)).size,4);
  assert.ok(saved.wires.every(w=>saved.components.some(c=>w.from.startsWith(c.id+'.'))&&
   saved.components.some(c=>w.to.startsWith(c.id+'.'))));
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[]);
  console.log('P8 COMPOSED ASSEMBLY BROWSER PASS: two saved independent wired cells -> composite -> real worker paste');
 }finally{await browser.close();}
})().catch(e=>{console.error('P8 COMPOSED ASSEMBLY BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
