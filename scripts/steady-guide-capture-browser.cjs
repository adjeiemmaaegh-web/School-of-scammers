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
  // Additional genuine UI states captured on a fresh, isolated simulator project.
  await shot('SG-07-library','/sandbox',1440,940,'Library search for photoeye', '[data-p5-library]');
  await page.type('[aria-label="Search component library"]','photoeye');
  await page.waitForFunction(()=>[...document.querySelectorAll('.sandbox-palette-item')].some(e=>/photoeye/i.test(e.textContent||'')),{timeout:6000});
  await page.screenshot({path:dir+'/SG-07-filtered.png',fullPage:false});
  captures.push({id:'SG-07',route:'/sandbox',viewport:'1440x940',state:'Component library filtered to photoeye',file:'SG-07-filtered.png',source:'genuine Chromium app screenshot',review:'pending'});
  // These tabs show the actual dock controls. The project remains a temporary QA browser project.
  await page.click('[data-p5-dock-tab="program"]');
  await page.screenshot({path:dir+'/SG-09-program-dock.png',fullPage:false});
  captures.push({id:'SG-09',route:'/sandbox',viewport:'1440x940',state:'PLC program dock, no configured PLC',file:'SG-09-program-dock.png',source:'genuine Chromium app screenshot',review:'pending'});
  await page.click('[data-p5-dock-tab="diagnostics"]');
  await page.screenshot({path:dir+'/SG-12-diagnostics.png',fullPage:false});
  captures.push({id:'SG-12',route:'/sandbox',viewport:'1440x940',state:'Diagnostics dock on a clean empty project',file:'SG-12-diagnostics.png',source:'genuine Chromium app screenshot',review:'pending'});
  // Inspector visibility is local UI state only. Open it if the learner's default is collapsed.
  const inspectorIsOpen=await page.$eval('.p5-panel-toggles button:nth-child(2)',el=>el.getAttribute('aria-pressed')==='true');
  if(!inspectorIsOpen)await page.click('.p5-panel-toggles button:nth-child(2)');
  await page.waitForSelector('[data-p5-inspector]',{timeout:6000});
  await page.screenshot({path:dir+'/SG-08-inspector.png',fullPage:false});
  captures.push({id:'SG-08',route:'/sandbox',viewport:'1440x940',state:'Inspector panel, empty device selection (do not imply device chosen)',file:'SG-08-inspector.png',source:'genuine Chromium app screenshot',review:'pending'});
  // The library may initialize asynchronously, so wait for the enabled real UI action.
  await page.waitForFunction(()=>{const e=document.querySelector('[data-open-project-library]');return e&&!e.disabled;},{timeout:12000});
  await page.click('[data-p5-menu] details:first-child > summary');
  await page.click('[data-open-project-library]');
  await page.waitForSelector('.ux6-modal',{timeout:8000});
  await page.screenshot({path:dir+'/SG-16-project-library.png',fullPage:false});
  captures.push({id:'SG-16',route:'/sandbox',viewport:'1440x940',state:'Local project library, fresh empty browser',file:'SG-16-project-library.png',source:'genuine Chromium app screenshot',review:'pending'});

  const data={generatedAt:new Date().toISOString(),note:'Captured for human QA only. Do not import without source and visual review.',captures};
  fs.writeFileSync(dir+'/manifest.json',JSON.stringify(data,null,2));
  assert.equal(captures.length,14);
  console.log('STEADY GUIDE REAL SCREENSHOT CAPTURE PASS: '+captures.length+' states');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
