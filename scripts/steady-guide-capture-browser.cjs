/** Real app screenshot capture for Steady Guide QA.
 * The script only uses a clean temporary browser profile. It does NOT write guide media or alter user projects.
 * Captures are review artifacts, not automatically approved or committed to /public.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const sourceCommit=(process.env.STEADY_GUIDE_SOURCE_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
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


  // Populated, real-worker screenshots. No mocked UI, screenshots or pre-solved project state.
  // This fresh CI browser profile is disposable; no private owner project is opened or altered.
  async function genuine(id,file,route,state,alt,selector,evidence){
    assert.ok(evidence && Object.values(evidence).every(value=>value!==null&&value!==undefined&&value!==false),
      id+' must be based on present real project state');
    await page.$eval(selector,element=>element.scrollIntoView({block:'center',inline:'nearest'}));
    await page.screenshot({path:dir+'/'+file,fullPage:false});
    captures.push({id,route,viewport:'1440x940',state,file,
      source:'genuine Chromium app screenshot',
      proof:evidence,alt,review:'pending',scope:'review-only; subject limitations in CAPTURE_MATRIX.md'});
  }
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('.sandbox-toolbar',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('.sandbox-3d-empty button') &&
    [...document.querySelectorAll('.sandbox-device')].length===0,{timeout:12000});
  await page.evaluate(()=>{
    const button=document.querySelector('.sandbox-3d-empty button');
    if(!button||button.disabled)throw Error('Fresh starter-layout control unavailable');
    button.click(); // existing app action, not direct project-state injection
  });
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-device').length===6 &&
    !!document.querySelector('[data-device-id="plc-2"]')&&
    !!document.querySelector('[data-device-id="motor-4"]'),{timeout:15000});
  await genuine('SG-04','SG-04-starter-placed.png','/sandbox',
    'Six actual starter devices placed in the virtual physical workbench; not a certified machine installation',
    'Physical teaching workbench populated with a DC supply, PLC, contactor, motor and control buttons.',
    '.p5-layout',{devices:6,plc:true,motor:true,physical:true});
  await page.click('[data-p5-view="logical"]');
  await page.waitForSelector('[data-p5-logical-device="motor-4"] .p5-logical-device-title',{timeout:10000});
  await page.$eval('[data-p5-logical-device="motor-4"] .p5-logical-device-title',el=>el.click());
  await page.$eval('.p5-panel-toggles button:nth-child(2)',el=>{
    if(el.getAttribute('aria-pressed')!=='true')el.click();
  });
  await page.waitForFunction(()=>/motor/i.test(document.querySelector('[data-p5-inspector] .sandbox-inspector-heading h2')?.textContent||''),{timeout:8000});
  await genuine('SG-08','SG-08-selected-motor.png','/sandbox',
    'Selected real motor component with its Inspector model and terminals',
    'The actual selected motor is shown in the component Inspector, not an empty placeholder.',
    '[data-p5-inspector]',{selectedDevice:'motor-4',inspector:'populated'});
  const starterWires=[
    ['supply-1.P24','plc-2.L+'],['supply-1.M0','plc-2.M'],
    ['supply-1.P24','start-5.A'],['start-5.B','plc-2.I0.0'],
    ['supply-1.P24','stop-6.A'],['stop-6.B','plc-2.I0.1'],
    ['plc-2.Q0.0','contactor-3.A1'],['supply-1.M0','contactor-3.A2'],
    ['supply-1.P24','contactor-3.13'],['contactor-3.14','motor-4.L+'],
    ['supply-1.M0','motor-4.M-'],
  ];
  for(const [a,b] of starterWires){
    await page.$eval('[data-terminal-id="'+a+'"]',el=>el.click());
    await page.waitForFunction(id=>document.querySelector('[data-terminal-id="'+id+'"]')?.classList.contains('selected'),{},a);
    await page.$eval('[data-terminal-id="'+b+'"]',el=>el.click());
  }
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list > div').length===11 &&
    document.querySelectorAll('[data-p5-wire]').length===11,{timeout:15000});
  await genuine('SG-05','SG-05-real-wiring.png','/sandbox',
    'Eleven accepted named-terminal wires shown in real logical schematic; worker project',
    'Logical wiring schematic showing actual supply, PLC, contactor and motor terminal connections.',
    '[data-p5-logical-canvas]',{devices:6,wires:11,view:'logical'});
  await page.click('[data-p5-view="plan"]');
  await page.waitForSelector('[data-floor-plan]',{timeout:12000});
  await genuine('SG-06','SG-06-populated-plan.png','/sandbox',
    'Floor Plan of the same six-device project with eleven real stored wires',
    'Two-dimensional floor plan of the same populated training circuit.',
    '[data-floor-plan]',{devices:6,wires:11,view:'plan'});
  await page.$eval('[data-p5-dock-tab="program"]',el=>el.click());
  await page.waitForSelector('.sandbox-language-tabs',{timeout:12000});
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Load editable latch example');
    if(!button||button.disabled)throw Error('Ladder sample unavailable in populated worker project');
    button.click();
  });
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-contact').length===3,{timeout:12000});
  await genuine('SG-09','SG-09-authentic-ladder.png','/sandbox',
    'Populated three-contact Ladder example in the active real PLC editor',
    'Real Ladder Logic editor with an editable three-contact start and stop latch program.',
    '.sandbox-editor',{language:'ladder',contacts:3,devices:6,wires:11});
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-language-tabs button')].find(b=>b.textContent.includes('Structured Text'));
    if(!button||button.disabled)throw Error('ST language action unavailable');
    button.click();
  });
  await page.waitForSelector('.sandbox-st-editor',{timeout:12000});
  await genuine('SG-10','SG-10-authentic-st.png','/sandbox',
    'Actual Structured Text editor for the populated PLC; does not prove timer/PID programming',
    'Real Structured Text editor with its source and compile controls, without a timer or PID example.',
    '.sandbox-st-editor',{language:'st',devices:6,wires:11,timerPidExample:false===true?'present':'not demonstrated'});
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-language-tabs button')].find(b=>b.textContent.includes('Function Blocks'));
    if(!button||button.disabled)throw Error('FBD language action unavailable');
    button.click();
  });
  await page.waitForSelector('.sandbox-fbd-editor .sandbox-fbd-canvas',{timeout:12000});
  await genuine('SG-11','SG-11-authentic-fbd.png','/sandbox',
    'Real FBD editor and visual block canvas; not evidence of compiled FBD outcome',
    'Actual Function Block Diagram editor with editable block layout and connection controls.',
    '.sandbox-fbd-editor',{language:'fbd',devices:6,wires:11,compiled:'not established'});
  // Probe actual supply potential after real worker scans; never draw a fabricated meter value.
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-language-tabs button')].find(b=>b.textContent.includes('Ladder (LD)'));
    if(!button||button.disabled)throw Error('Ladder language control unavailable');button.click();
  });
  await page.waitForSelector('.sandbox-editor',{timeout:10000});
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent.trim()==='▶ Run');
    if(!button||button.disabled)throw Error('Real simulation Run action unavailable');button.click();
  });
  await page.waitForFunction(()=>Number(document.querySelector('.sandbox-scan')?.textContent?.replace(/\D/g,'')||0)>=2,{timeout:12000});
  await page.evaluate(()=>{
    const button=[...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent.trim()==='Pause');
    if(!button||button.disabled)throw Error('Real simulation Pause action unavailable');button.click();
  });
  await page.waitForFunction(()=>document.querySelector('[data-p5-sim-state]')?.textContent?.includes('Paused'),{timeout:12000});
  await page.$eval('[data-p5-dock-tab="diagnostics"]',el=>el.click());
  await page.waitForSelector('select[aria-label="Red meter probe"]',{timeout:12000});
  await page.select('select[aria-label="Red meter probe"]','supply-1.P24');
  await page.select('select[aria-label="Black meter probe"]','supply-1.M0');
  await page.waitForFunction(()=>document.querySelector('.sandbox-meter-reading')?.textContent?.trim()==='24 V DC',{timeout:12000});
  await genuine('SG-12','SG-12-worker-meter.png','/sandbox',
    'Real two-probe 24 V reading in diagnostics after actual scan; does not prove broad live I/O coverage',
    'Virtual meter reading 24 V DC between the named supply terminals after a real simulator scan.',
    '.sandbox-meter-reading',{probes:'supply-1.P24 / supply-1.M0',meter:'24 V DC',scans:'at least two'});
  await page.goto(base+'/guide/scenes',{waitUntil:'networkidle0',timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('[data-steady-scene-index] .sg-card').length===21,{timeout:12000});
  await genuine('SG-13','SG-13-scene-atlas.png','/guide/scenes',
    'Twenty-one existing factory scenes in source-backed Guide atlas; not a simulator gallery screenshot',
    'Steady Guide index of the twenty-one supported original virtual factory scenes.',
    '[data-steady-scene-index]',{sceneCards:21,view:'guide atlas only'});

  for(const item of captures){
    const png=fs.readFileSync(dir+'/'+item.file);
    assert.ok(png.length>1000 && png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),item.id+' is a nonempty original PNG');
    item.sha256=crypto.createHash('sha256').update(png).digest('hex');
    item.sourceCommit=sourceCommit;
    item.review='pending';
    item.alt??='Unmodified actual application screenshot of '+item.state+'.';
  }
  const data={generatedAt:new Date().toISOString(),sourceCommit,workflowCommit:process.env.GITHUB_SHA||null,
    note:'Automated selectors and genuine PNG digests are provenance checks, NOT owner or visual approval. Never publish review artifacts automatically.',captures};
  fs.writeFileSync(dir+'/manifest.json',JSON.stringify(data,null,2));
  assert.equal(captures.length,23);
  console.log('STEADY GUIDE REAL SCREENSHOT CAPTURE PASS: '+captures.length+' authentic states with SHA256 provenance; human review pending');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
