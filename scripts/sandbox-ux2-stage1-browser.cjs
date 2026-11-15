/**
 * UX2 stage-one PC/tablet browser acceptance. Uses actual sandbox + real worker.
 * Requires: npm ci, npm install --no-save puppeteer@24.31.0, npm run build,
 * and a Vite preview on PLC_BASE_URL (default http://127.0.0.1:4173).
 *
 * Run: PLC_BASE_URL=http://127.0.0.1:4173 node scripts/sandbox-ux2-stage1-browser.cjs
 * This file is not a passing QA report until executed on the exact commit.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');

const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const viewports=[
  {width:1920,height:1080,name:'desktop-fullhd'},
  {width:1366,height:768,name:'laptop'},
  {width:1280,height:720,name:'laptop-small'},
  {width:1024,height:768,name:'tablet-landscape'},
  {width:768,height:1024,name:'tablet-portrait'},
];
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  ]});
  let graphical3D=false;
  try {
    const page=await browser.newPage();
    const uncaught=[];
    page.on('pageerror',e=>uncaught.push(String(e)));
    fs.mkdirSync('qa-artifacts/ux2-stage1',{recursive:true});
    for(const viewport of viewports) {
      await page.setViewport({...viewport,deviceScaleFactor:1});
      await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
      await page.waitForSelector('[data-ux2-workbench="pc-tablet"]',{timeout:15000});
      const measurements=await page.evaluate(()=>{
        const outer=document.documentElement;
        const stage=document.querySelector('[data-p5-view-active]');
        const library=document.querySelector('[data-p5-library]');
        const dock=document.querySelector('.p5-engineering-dock');
        const canvas=document.querySelector('.sandbox-3d-shell');
        const boxes=el=>el?({
          x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,
          w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,
        }):null;
        return {
          viewport:[innerWidth,innerHeight],
          document:[outer.scrollWidth,outer.scrollHeight],
          stage:boxes(stage),library:boxes(library),dock:boxes(dock),
          canvas:boxes(canvas),outerOverflow:getComputedStyle(document.body).overflow,
          paletteTiles:document.querySelectorAll('.ux2-equipment-tile').length,
          thumbnailCount:document.querySelectorAll('.ux2-equipment-tile svg').length,
        };
      });
      assert.ok(measurements.document[0]<=viewport.width+2,
        'UX2 document is wider than '+viewport.name+': '+JSON.stringify(measurements));
      assert.ok(measurements.document[1]<=viewport.height+2,
        'UX2 outer page scrolls at '+viewport.name+': '+JSON.stringify(measurements));
      assert.ok(measurements.canvas?.w>=190&&measurements.canvas?.h>=145,
        'UX2 workcell missing at '+viewport.name+': '+JSON.stringify(measurements));
      assert.ok(measurements.canvas.y+measurements.canvas.h<=
        measurements.stage.y+measurements.stage.h+3,
        'UX2 3D scene is clipped by central workspace at '+
        viewport.name+': '+JSON.stringify(measurements));
      assert.ok(measurements.paletteTiles>=10,
        'UX2 palette must show registered equipment at '+viewport.name);
      assert.equal(measurements.thumbnailCount,measurements.paletteTiles,
        'Every visible equipment tile has an original SVG illustration');
      assert.ok(measurements.dock?.h>=24,
        'Engineering dock controls must remain available (collapsed is OK): '+
        viewport.name+' '+JSON.stringify(measurements));
      assert.ok(measurements.library?.h>100,'Illustrated library must remain available');
      console.log('UX2 GEOMETRY',viewport.name,JSON.stringify(measurements));
      await page.screenshot({path:'qa-artifacts/ux2-stage1/'+viewport.name+'.png'});
    }
    await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.ux2-equipment-tile');
    const num=await page.$$eval('.ux2-equipment-tile',xs=>xs.length);
    assert.ok(num>=10,'Image-based device catalog has real registry entries');
    const plcFilter=await page.$('[data-p5-category="plc"]');
    assert.ok(plcFilter,'Existing PLC category remains available');
    await plcFilter.click();
    assert.ok(await page.$$('.ux2-equipment-tile').then(a=>a.length)>=2,'PLC kind filter works');
    await page.click('[data-p5-category="all"]');
    await page.waitForFunction(n=>document.querySelectorAll('.ux2-equipment-tile').length>n,{},2);
    const plc=await page.evaluate(()=>{
      const btn=[...document.querySelectorAll('.ux2-equipment-tile')].find(
        el=>el.textContent?.includes('Virtual PLC 16/16'));
      if(!btn)return false;
      btn.click();
      return !!btn.querySelector('svg');
    });
    assert.ok(plc,'Illustrated PLC tile can request real click-to-place');
    await page.click('[data-p5-view="logical"]');
    await page.waitForFunction(()=>document.querySelectorAll('[data-p5-logical-device]').length===1,
      {timeout:12000});
    const supply=await page.evaluate(()=>{
      const btn=[...document.querySelectorAll('.ux2-equipment-tile')].find(
        el=>el.textContent?.includes('24V supply'));
      if(!btn)return false;
      btn.click();
      return !!btn.querySelector('svg');
    });
    assert.ok(supply,'Illustrated supply tile can request real click-to-place');
    await page.waitForFunction(()=>document.querySelectorAll('[data-p5-logical-device]').length===2,
      {timeout:12000});
    const ids=await page.$$eval('[data-p5-logical-device]',
      els=>els.map(el=>el.getAttribute('data-p5-logical-device')));
    const plcId=ids.find(id=>id.startsWith('plc16-'));
    const supplyId=ids.find(id=>id.startsWith('supply-'));
    assert.ok(plcId&&supplyId,'True worker project includes PLC and power supply');
    await page.$eval(`[data-p5-pin="${supplyId}.P24"]`,el=>el.click());
    await page.$eval(`[data-p5-pin="${plcId}.L+"]`,el=>el.click());
    await page.waitForFunction(()=>document.querySelectorAll('[data-p5-wire]').length===1,
      {timeout:10000});
    // Compact PC/tablet opens the dock collapsed: reveal it before checking
    // the diagnostic wire list. The logical canvas itself already proves the
    // worker accepted a real connection.
    await page.click('.p5-dock-heading button[aria-expanded="false"]');
    await page.waitForSelector('.sandbox-wire-list > div',{timeout:10000});
    assert.equal(await page.$eval('.sandbox-wire-list>div',els=>els.length),1,
      'Wire command reached real worker and diagnostic list');
    await page.click('[data-p5-view="physical"]');
    await page.waitForFunction(()=>!!document.querySelector('.sandbox-three-canvas canvas')||
      !!document.querySelector('.sandbox-3d-fallback'),{timeout:15000});
    const render=await page.evaluate(()=>({
      canvas:!!document.querySelector('.sandbox-three-canvas canvas'),
      fallback:!!document.querySelector('.sandbox-3d-fallback'),
    }));
    graphical3D=render.canvas;
    if(graphical3D){
      // P1 camera and canvas measurements must stabilize before a raycast.
      await page.waitForFunction(()=>{
        const canvas=document.querySelector('.sandbox-three-canvas canvas');
        return !!canvas&&canvas.width>320&&canvas.height>120;
      },{timeout:12000});
      // Avoid placing directly on an existing PLC/supply: intentional
      // collisions are worker-rejected, which would falsely fail drag/drop QA.
      await page.evaluate(()=>{
        const btn=[...document.querySelectorAll('.sandbox-toolbar button')]
          .find(el=>el.textContent?.trim()==='New blank project');
        if(!btn)throw Error('New blank project button missing');
        btn.click();
      });
      await page.waitForFunction(()=>document.querySelectorAll('[data-device-id]').length===0,
        {timeout:10000});
      const previous=0;
      await page.evaluate(()=>{
        const shell=document.querySelector('.sandbox-3d-shell');
        const r=shell.getBoundingClientRect();
        const dataTransfer=new DataTransfer();
        dataTransfer.setData('text/plain','add:motor');
        shell.dispatchEvent(new DragEvent('drop',{
          bubbles:true,cancelable:true,dataTransfer,
          clientX:r.left+r.width/2,clientY:r.top+r.height/2,
        }));
      });
      await page.waitForFunction(n=>
        document.querySelectorAll('[data-device-id]').length>n,
        {timeout:10000},previous).catch(async err=>{
          const state=await page.evaluate(()=>({
            errors:[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent),
            canvas:document.querySelector('.sandbox-three-canvas canvas')?.getBoundingClientRect().toJSON(),
            visibleDevices:document.querySelectorAll('[data-device-id]').length,
            status:document.querySelector('.p5-simulation-status')?.textContent,
          }));
          throw new Error('3D drop did not create a real component: '+
            JSON.stringify(state)+'; '+String(err));
        });
    } else {
      assert.ok(render.fallback,'No-WebGL fallback must remain visible');
      console.log('UX2 3D DROP SKIPPED: this browser has no WebGL; click placement and wiring tested');
    }
    await page.click('[data-p5-dock-tab="diagnostics"]');
    assert.equal(await page.$eval('[data-p5-dock-tab="diagnostics"]',
      x=>x.getAttribute('aria-pressed')),'true');
    await page.click('[data-p5-dock-tab="program"]');
    assert.equal(await page.$eval('[data-p5-dock-tab="program"]',
      x=>x.getAttribute('aria-pressed')),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),
      true,'Dock operations do not create outer-page scrolling');
    assert.deepEqual(uncaught,[],'No unhandled errors in UX2 browser route');
    console.log('UX2 STAGE-ONE ACCEPTANCE PASS: PC/tablet layout, SVG tiles, worker placement, real wiring, dock');
    console.log('3D drop: '+(graphical3D?'executed':'unverified due to missing WebGL'));
  } finally { await browser.close(); }
})().catch(err=>{
  console.error('UX2 STAGE-ONE ACCEPTANCE FAIL',err.stack||String(err));
  process.exitCode=1;
});
