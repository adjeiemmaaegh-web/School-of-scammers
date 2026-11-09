/**
 * P5-UX source acceptance: real browser, real sandbox worker, zero mocked state.
 * UI organization only; does not claim hardware/browser/device acceptance.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');
const url=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173')+'/sandbox';
(async()=>{
  const browser=await puppeteer.launch({headless:true,args:[
    '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  ]});
  try{
    fs.mkdirSync('qa-artifacts/p5-ux',{recursive:true});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.goto(url,{waitUntil:'networkidle0',timeout:30000});
    await page.waitForSelector('[data-p5-workspace="organized"]',{timeout:15000});
    const initial=await page.evaluate(()=>({
      view:document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active'),
      library:!!document.querySelector('[data-p5-library]'),
      inspector:!!document.querySelector('[data-p5-inspector]'),
      dock:!!document.querySelector('[data-p5-dock]'),
      tools:[...document.querySelectorAll('[data-p5-view]')].map(el=>el.textContent.trim()),
    }));
    assert.equal(initial.view,'physical');
    assert.equal(initial.library,true);
    assert.equal(initial.inspector,true);
    assert.equal(initial.dock,true);
    assert.deepEqual(initial.tools,['Logical / Wiring','Physical / 3D Plant']);
    await page.screenshot({path:'qa-artifacts/p5-ux/desktop-physical-1440.png'});
    const countBefore=await page.$eval('.sandbox-scene-stat',el=>el.textContent.trim());
    await page.click('[data-p5-view="logical"]');
    await page.waitForFunction(()=>document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active')==='logical');
    const logical=await page.evaluate(()=>({
      visible:!!document.querySelector('#sandbox-stage-wire')?.open,
      heading:getComputedStyle(document.querySelector('.p5-logical-heading')).display,
      physical:getComputedStyle(document.querySelector('.p5-physical-stage')).display,
    }));
    assert.equal(logical.visible,true);
    assert.ok(await page.$('[data-p5-logical-canvas]'),'Physical project has a spatial logical board');
    assert.notEqual(logical.heading,'none');
    assert.equal(logical.physical,'none');
    await page.screenshot({path:'qa-artifacts/p5-ux/desktop-logical-1440.png'});
    await page.click('[data-p5-category="plc"]');
    const palette=await page.$$eval('.sandbox-palette-item',els=>els.map(e=>e.textContent.trim()));
    assert.ok(palette.length>=2,'Controller models in family');
    assert.ok(palette.every(s=>/PLC/i.test(s)),'PLC family excludes unrelated devices');
    await page.click('.sandbox-palette-item');
    await page.waitForFunction(()=>document.querySelectorAll('[data-p5-logical-device]').length===1,
      {timeout:15000});
    const afterPlacement=await page.$eval('.sandbox-scene-stat',el=>el.textContent.trim());
    assert.notEqual(afterPlacement,countBefore,'Placement is a real project mutation');
    await page.click('[data-p5-category="all"]');
    assert.ok((await page.$$('.sandbox-palette-item')).length>palette.length);
    await page.click('[data-p5-view="physical"]');
    await page.waitForFunction(()=>document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active')==='physical');
    assert.equal(await page.$eval('.sandbox-scene-stat',e=>e.textContent.trim()),afterPlacement,
      'View switch never modifies project components');
    await page.click('.p5-panel-toggles button:nth-child(1)');
    assert.equal((await page.$('[data-p5-library]')),null);
    await page.click('.p5-panel-toggles button:nth-child(1)');
    assert.ok(await page.$('[data-p5-library]'));
    await page.click('.p5-panel-toggles button:nth-child(2)');
    assert.equal((await page.$('[data-p5-inspector]')),null);
    await page.click('.p5-panel-toggles button:nth-child(2)');
    assert.ok(await page.$('[data-p5-inspector]'));
    await page.click('[data-p5-dock-tab="diagnostics"]');
    assert.equal(await page.$eval('[data-p5-dock]',e=>e.getAttribute('data-p5-dock')),'diagnostics');
    await page.click('[data-p5-dock-tab="program"]');
    assert.equal(await page.$eval('[data-p5-dock]',e=>e.getAttribute('data-p5-dock')),'program');
    await page.keyboard.down('Alt');await page.keyboard.press('1');await page.keyboard.up('Alt');
    assert.equal(await page.$eval('[data-p5-view-active]',e=>e.getAttribute('data-p5-view-active')),'logical');
    await page.keyboard.down('Alt');await page.keyboard.press('2');await page.keyboard.up('Alt');
    assert.equal(await page.$eval('[data-p5-view-active]',e=>e.getAttribute('data-p5-view-active')),'physical');
    assert.ok(await page.$('[data-p5-sim-state]'),'Worker state readout remains visible');
    await page.setViewport({width:1280,height:800,deviceScaleFactor:1});
    await page.screenshot({path:'qa-artifacts/p5-ux/laptop-physical-1280.png'});
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    assert.equal(await page.$eval('[data-p5-workspace]',e=>e.getAttribute('data-p5-workspace')),'organized');
    assert.ok(await page.$('[data-p5-view="logical"]'),'Narrow screens retain view switch');
    assert.ok(await page.$('[data-p5-dock-tab="program"]'),'Narrow screens retain PLC editor access');
    await page.screenshot({path:'qa-artifacts/p5-ux/narrow-physical-390.png'});
    assert.deepEqual(errors.filter(e=>!/WebGL|favicon|GPU stall/i.test(e)),[]);
    console.log('P5-UX BROWSER PASS: view state, catalog, dock, panels, keyboard and narrow controls');
  }finally{await browser.close();}
})().catch(e=>{console.error('P5-UX BROWSER FAIL',e.stack||String(e));process.exitCode=1;});
