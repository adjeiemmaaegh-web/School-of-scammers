/**
 * UX2 Stage 2 compact command surface: real Chromium layout + clickable controls.
 * Does not replace the stage-one real worker/drag-drop acceptance.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const targets=[
  {name:'desktop-fullhd',w:1920,h:1080,maxTop:335},
  {name:'laptop',w:1366,h:768,maxTop:335},
  {name:'laptop-small',w:1280,h:720,maxTop:335},
  {name:'tablet-landscape',w:1024,h:768,maxTop:355},
  {name:'tablet-portrait',w:768,h:1024,maxTop:400},
];
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  ]});
  try {
    fs.mkdirSync('qa-artifacts/ux2-stage2',{recursive:true});
    const page=await browser.newPage();
    const pageErrors=[];
    page.on('pageerror',err=>pageErrors.push(String(err)));
    for(const t of targets){
      await page.setViewport({width:t.w,height:t.h,deviceScaleFactor:1});
      await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
      await page.waitForSelector('.efo-ux2-shell .ux2-command-stack');
      const state=await page.evaluate(()=>{
        const rect=sel=>{
          const el=document.querySelector(sel);
          const r=el?.getBoundingClientRect();
          return r?{top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right,width:r.width}:null;
        };
        const run=[...document.querySelectorAll('.sandbox-toolbar button')].find(x=>
          x.textContent?.includes('Run')&&!x.textContent?.includes('Scan'));
        const runRect=run?.getBoundingClientRect();
        const reachable=!!runRect&&runRect.width>0&&runRect.height>0&&
          runRect.left>=0&&runRect.right<=innerWidth;
        return {
          win:[innerWidth,innerHeight],
          doc:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
          stackDisplay:getComputedStyle(document.querySelector('.ux2-command-stack')).display,
          stage:rect('.p5-layout'),
          workflow:rect('.ux2-command-stack > .sandbox-workflow'),
          toolbar:rect('.ux2-command-stack > .sandbox-toolbar'),
          views:rect('.ux2-command-stack > .p5-view-tools'),
          authoring:rect('.ux2-command-stack > .workspace-editing-strip'),
          assemblies:rect('.ux2-command-stack > .sandbox-assembly-library'),
          runReachable:reachable,
          runRect:runRect?{left:runRect.left,right:runRect.right,top:runRect.top,bottom:runRect.bottom}:null,
        };
      });
      console.log('UX2 STAGE2',t.name,JSON.stringify(state));
      assert.equal(state.stackDisplay,'grid','Command stack must be compact grid at '+t.name);
      assert.ok(state.stage?.top<=t.maxTop,
        'Too much vertical chrome at '+t.name+': '+JSON.stringify(state));
      assert.ok(state.doc[0]<=t.w+2&&state.doc[1]<=t.h+2,
        'Document scroll/overflow at '+t.name+': '+JSON.stringify(state));
      assert.ok(state.runReachable,'Run button not reachable at '+t.name+': '+JSON.stringify(state));
      assert.ok(state.workflow&&state.views&&state.authoring&&state.assemblies,
        'Lost command surfaces at '+t.name);
      await page.screenshot({path:'qa-artifacts/ux2-stage2/'+t.name+'.png'});
    }
    await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.click('[data-p5-view="logical"]');
    assert.equal(await page.$eval('[data-p5-view-active]',e=>e.dataset.p5ViewActive),'logical');
    await page.click('[data-p5-view="physical"]');
    assert.equal(await page.$eval('[data-p5-view-active]',e=>e.dataset.p5ViewActive),'physical');
    const build=await page.$eval('.sandbox-workflow button[aria-pressed="true"]',e=>
      e.textContent?.includes('Build'));
    assert.equal(build,true,'Build workflow remains selected until explicitly changed');
    await page.click('.sandbox-workflow button:nth-child(3)');
    assert.equal(await page.$eval('.sandbox-workflow button:nth-child(3)',e=>e.getAttribute('aria-pressed')),
      'true','Program shortcut still selects corresponding workflow');
    assert.equal(await page.$eval('.p5-engineering-dock .p5-dock-heading button[aria-expanded]',
      e=>e.getAttribute('aria-expanded')),'true','Program expands real engineering dock');
    // Panel controls resize the actual grid, persist outside project files
    // and never introduce page-level scrolling.
    await page.click('.p5-menu-bar details:nth-child(5) > summary');
    await page.focus('[data-ux2-resize="library"]');
    const oldSize=await page.$eval('[data-ux2-resize="library"]',el=>Number(el.value));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(old=>Number(JSON.parse(localStorage.getItem('efo-ux2-layout-v1'))?.library)>old,
      {timeout:5000},oldSize);
    const adjusted=await page.evaluate(()=>({
      library:document.querySelector('.sandbox-palette')?.getBoundingClientRect().width,
      stored:JSON.parse(localStorage.getItem('efo-ux2-layout-v1')??'null')?.library,
      height:document.documentElement.scrollHeight,
    }));
    assert.ok(adjusted.library>=oldSize+9,'Library resize updates real workspace grid');
    assert.ok(adjusted.height<=770,'Resizing must not create page scroll at the 1366×768 test viewport');
    await page.reload({waitUntil:'networkidle0'});
    assert.equal(await page.$eval('[data-ux2-resize="library"]',el=>Number(el.value)),adjusted.stored,
      'Panel layout persists across reload independent of project storage');
    assert.deepEqual(pageErrors,[],'No uncaught UI errors');
    console.log('UX2 STAGE2 ACCEPTANCE PASS: compact 2-row workspace commands, all five viewports, live controls');
  } finally {await browser.close();}
})().catch(err=>{console.error('UX2 STAGE2 ACCEPTANCE FAIL',err.stack||String(err));process.exitCode=1});
