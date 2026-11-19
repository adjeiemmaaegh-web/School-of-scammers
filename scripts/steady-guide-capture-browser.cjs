/** Real app screenshot capture for Steady Guide QA.
 * The script only uses a clean temporary browser profile. It does NOT write guide media or alter user projects.
 * Captures are review artifacts, not automatically approved or committed to /public.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const dir='qa-artifacts/steady-guide-captures';
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 const captures=[];
 async function shot(id,route,w,h,state,selector){
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.goto(base+route,{waitUntil:'networkidle0',timeout:40000});
  if(selector)await page.waitForSelector(selector,{timeout:15000});
  await page.screenshot({path:dir+'/'+id+'.png',fullPage:false});
  captures.push({id,route,viewport:w+'x'+h,state,file:id+'.png',source:'genuine Chromium app screenshot',review:'pending'});
 }
 try{
  await shot('SG-01-home','/',1440,940,'Fresh home page');
  await shot('SG-02-guide','/guide',1440,940,'Steady Guide landing, no project mutation','[data-steady-guide]');
  await shot('SG-03-workbench','/sandbox',1440,940,'Empty project, physical workbench','.sandbox-toolbar');
  await page.click('[data-p5-view="logical"]');
  await page.screenshot({path:dir+'/SG-05-logical.png',fullPage:false});
  captures.push({id:'SG-05',route:'/sandbox',viewport:'1440x940',state:'Logical view, empty project',file:'SG-05-logical.png',source:'genuine Chromium app screenshot',review:'pending'});
  await page.click('[data-p5-view="plan"]');
  await page.screenshot({path:dir+'/SG-06-floor-plan.png',fullPage:false});
  captures.push({id:'SG-06',route:'/sandbox',viewport:'1440x940',state:'Floor plan view, empty project',file:'SG-06-floor-plan.png',source:'genuine Chromium app screenshot',review:'pending'});
  await shot('SG-03-tablet','/sandbox',768,1024,'Empty simulator on tablet','.sandbox-toolbar');
  await shot('SG-01-mobile','/guide',390,844,'Guide mobile navigation','[data-steady-guide]');
  await shot('SG-18-learn','/learn',1440,940,'Existing Learn & Practice page','[data-learn-course]');
  const data={generatedAt:new Date().toISOString(),note:'Captured for human QA only. Do not import without source and visual review.',captures};
  fs.writeFileSync(dir+'/manifest.json',JSON.stringify(data,null,2));
  assert.equal(captures.length,8);
  console.log('STEADY GUIDE REAL SCREENSHOT CAPTURE PASS: '+captures.length+' states');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
