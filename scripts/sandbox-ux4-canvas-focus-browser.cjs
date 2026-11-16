/**
 * UX4 physical-browser acceptance, actual 3D Canvas and live UI.
 * Verify that layout mode makes the editing area >=90% of available browser
 * content, can be reversed without losing project or panel state, and works
 * across desktop and PC/tablet breakpoints. No simulated screenshot fixture.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const sizes=[
  {name:'fullhd',w:1920,h:1080},
  {name:'laptop',w:1366,h:768},
  {name:'compact',w:1280,h:720},
  {name:'tablet-landscape',w:1024,h:768},
  {name:'tablet-portrait',w:768,h:1024},
];

(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 try{
  fs.mkdirSync('qa-artifacts/ux4-canvas-focus',{recursive:true});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  for(const t of sizes){
   await page.setViewport({width:t.w,height:t.h,deviceScaleFactor:1});
   await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
   await page.waitForSelector('.sandbox-three-canvas canvas',{timeout:20000});
   const before=await page.evaluate(()=>localStorage.getItem('efo-open-sandbox-project-v1'));
   await page.click('[data-efo-canvas-focus-toggle]');
   await page.waitForSelector('main.efo-workspace-focused');
   // React Three Fiber updates its canvas on ResizeObserver; checking on the
   // same layout tick would measure the stale pre-focus canvas dimensions.
   await page.waitForFunction(()=>{
     const r=document.querySelector('.sandbox-three-canvas canvas')?.getBoundingClientRect();
     return !!r && r.width*r.height/(innerWidth*innerHeight)>=0.90;
   },{timeout:8000}).catch(()=>{});
   const state=await page.evaluate(()=>{
    const box=sel=>{
      const n=document.querySelector(sel);
      if(!n)return null;
      const r=n.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height};
    };
    const hidden=sel=>{
      const n=document.querySelector(sel);
      return !n||!n.getClientRects().length||getComputedStyle(n).display==='none';
    };
    const canvas=box('.sandbox-three-canvas canvas');
    const cameraToolbar=box('.sandbox-3d-camera-controls');
    const focusToolbar=box('.efo-canvas-actions');
    return {
      viewport:[innerWidth,innerHeight],
      main:box('main.efo-workspace-focused'),
      stage:box('.p5-layout'),
      sandboxMain:box('.sandbox-main'),
      physical:box('.p5-physical-stage'),
      shell:box('.sandbox-3d-shell'),
      canvas,cameraToolbar,focusToolbar,
      canvasRatio:canvas?canvas.w*canvas.h/(innerWidth*innerHeight):0,
      mastheadHidden:hidden('.sandbox-masthead'),
      navHeaderHidden:hidden('.app-header'),
      toolbarHidden:hidden('.sandbox-toolbar'),
      paletteHidden:hidden('.sandbox-palette'),
      dockHidden:hidden('.p5-engineering-dock'),
      inspectorHidden:hidden('.p5-inspector-slot'),
      focused:document.querySelector('main')?.getAttribute('data-efo-canvas-focused'),
      restorePressed:document.querySelector('[data-efo-canvas-focus-toggle]')?.getAttribute('aria-pressed'),
      scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
    };
   });
   console.log('UX4 CANVAS FOCUS',t.name,JSON.stringify(state));
   if(state.cameraToolbar&&state.focusToolbar){
     const a=state.cameraToolbar,b=state.focusToolbar;
     const overlap=a.x<b.x+b.w && b.x<a.x+a.w && a.y<b.y+b.h && b.y<a.y+a.h;
     assert.ok(!overlap,'Focused camera toolbar must not overlap Restore/Run controls at '+t.name+': '+JSON.stringify(state));
   }
   assert.equal(state.focused,'true');
   assert.equal(state.restorePressed,'true');
   assert.ok(state.canvasRatio>=0.90,'3D canvas occupies <90% viewport at '+t.name+': '+JSON.stringify(state));
   assert.ok(Math.abs(state.main.w-t.w)<=2&&Math.abs(state.main.h-t.h)<=2,'Full content viewport required');
   assert.ok(state.mastheadHidden&&state.navHeaderHidden&&state.toolbarHidden&&state.paletteHidden&&state.dockHidden&&state.inspectorHidden,
      'Persistent tool chrome must be hidden during canvas focus');
   assert.ok(state.scroll[0]<=t.w+2&&state.scroll[1]<=t.h+2,
      'Focus mode introduced document scroll at '+t.name);
   await page.screenshot({path:'qa-artifacts/ux4-canvas-focus/'+t.name+'-focused.png'});
   // The same action reverses focus. This is not a new project or 3D scene.
   await page.click('[data-efo-canvas-focus-toggle]');
   await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-efo-canvas-focused')==='false');
   assert.ok(await page.$('.sandbox-palette'),'Library must return without creating a new project');
   const after=await page.evaluate(()=>localStorage.getItem('efo-open-sandbox-project-v1'));
   assert.equal(after,before,'Focus toggle must not mutate the saved project');
   await page.screenshot({path:'qa-artifacts/ux4-canvas-focus/'+t.name+'-tools.png'});
  }
  // Remember intentionally opened tools, even after leaving immersive mode.
  await page.setViewport({width:1366,height:768});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
  await page.click('.p5-panel-toggles button:nth-child(2)'); // Inspector.
  assert.ok(await page.$('[data-p5-inspector]'),'Inspector panel opens');
  await page.keyboard.down('Alt');await page.keyboard.press('Enter');await page.keyboard.up('Alt');
  await page.waitForSelector('main.efo-workspace-focused');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-efo-canvas-focused')==='false');
  assert.ok(await page.$('[data-p5-inspector]'),'Escape restores previously opened Inspector');
  // All three existing editor views can claim the same full viewport.
  for(const [view,selector] of [
   ['logical','.p5-logical-scroll'],
   ['plan','.p5-floor-stage'],
   ['physical','.sandbox-three-canvas canvas'],
  ]){
    await page.click('[data-p5-view="'+view+'"]');
    await page.click('[data-efo-canvas-focus-toggle]');
    await page.waitForSelector('main.efo-workspace-focused');
    // Switching from 2D back to 3D mounts a fresh WebGL canvas. Wait for its
    // ResizeObserver to claim the newly expanded viewport before measuring.
    await page.waitForFunction(sel=>{
      const r=document.querySelector(sel)?.getBoundingClientRect();
      return !!r && r.height>=650;
    },{timeout:8000},selector).catch(()=>{});
    const rect=await page.$eval(selector,el=>({display:getComputedStyle(el).display,h:el.getBoundingClientRect().height}));
    assert.notEqual(rect.display,'none','Workspace view unavailable in focus: '+view);
    assert.ok(rect.h>=650,'Workspace view too short in focus: '+view+' '+JSON.stringify(rect));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-efo-canvas-focused')==='false');
  }
  assert.deepEqual(errors,[],'No uncaught page exceptions');
  console.log('UX4 REAL BROWSER PASS: 5 screens, >=90% 3D canvas, restore, keyboard, 3 views');
 } finally {await browser.close();}
})().catch(err=>{console.error('UX4 REAL BROWSER FAIL',err.stack||String(err));process.exitCode=1});
