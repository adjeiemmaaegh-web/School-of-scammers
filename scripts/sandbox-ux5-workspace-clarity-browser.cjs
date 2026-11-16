/** UX5 actual-browser regression: two physical devices, not a design mockup.
 * Confirms real PLC worker placement and compact anchored labels, full-height
 * canvas, focus-selected navigation, panel toggles, and source-preserving tools.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const dir='qa-artifacts/ux5-workspace-clarity';
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage'
 ]});
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  for(const [width,height] of [[1600,900],[1024,768]]){
   await page.setViewport({width,height,deviceScaleFactor:1});
   await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
   await page.waitForSelector('.sandbox-three-canvas canvas',{timeout:25000});
   await page.evaluate(()=>localStorage.removeItem('efo-open-sandbox-project-v1'));
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForSelector('[data-p7-place-kind]',{timeout:25000});
   // Use the REAL illustrated library commands, not a synthetic project.
   const kinds=['mixer','proportional-valve'];
   for(let i=0;i<kinds.length;i++){
    const kind=kinds[i];
    const found=await page.evaluate(k=>{
      const tile=[...document.querySelectorAll('.sandbox-palette-item')]
        .find(el=>el.getAttribute('title')?.startsWith('Place ')&&
          (el.getAttribute('title')||'').toLowerCase().includes(
           k==='mixer'?'process agitator':'variable opening process valve'));
      if(!tile)return false;
      tile.click();return true;
    },kind);
    assert.ok(found,'Real equipment library entry missing: '+kind);
    await page.waitForFunction(n=>{
     const raw=localStorage.getItem('efo-open-sandbox-project-v1');
     return raw&&JSON.parse(raw).components?.length===n;
    },{timeout:15000},i+1);
   }
   await page.waitForFunction(()=>document.querySelectorAll('.sandbox-3d-label').length===2,
      {timeout:15000});
   await page.click('[data-3d-fit-scene]');
   await page.waitForFunction(()=>document.querySelector('.sandbox-three-canvas canvas')?.width>400,
      {timeout:10000});
   const evidence=await page.evaluate(()=>{
    const box=sel=>{
      const el=document.querySelector(sel);
      if(!el)return null;
      const r=el.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height};
    };
    const labels=[...document.querySelectorAll('.sandbox-3d-label')].map(el=>{
      const r=el.getBoundingClientRect();
      return {text:el.querySelector('strong')?.textContent,
        compact:el.classList.contains('ux3-compact-label'),w:r.width,h:r.height};
    });
    const shell=box('.sandbox-3d-shell'),canvas=box('.sandbox-three-canvas canvas');
    const stage=box('.p5-layout'),actions=box('.efo-canvas-actions');
    const camera=box('.sandbox-3d-camera-controls');
    const body=[document.documentElement.scrollWidth,document.documentElement.scrollHeight];
    return {shell,canvas,stage,actions,camera,labels,body,
      viewport:[innerWidth,innerHeight],
      project:JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'{}').components?.map(c=>c.kind)};
   });
   console.log('UX5 REAL TWO-DEVICE WORKSPACE',width,height,JSON.stringify(evidence));
   assert.deepEqual(evidence.project?.sort(),[...kinds].sort());
   assert.equal(evidence.labels.length,2,'Both real machines have camera-anchored labels');
   assert.ok(evidence.labels.every(x=>x.compact&&x.w<=115&&x.h<=36),
     'Even TWO devices must NEVER obscure machines with full-size status cards');
   assert.ok(evidence.canvas.w>=350&&evidence.canvas.h>=240,
     'The real 3D canvas must occupy useful workstation height');
   assert.ok(evidence.canvas.h>=evidence.stage.h*.62,
     'Canvas must consume most of the allocated workspace pane');
   assert.ok(evidence.body[0]<=width+2&&evidence.body[1]<=height+2,
     'Normal PC/tablet workbench must not create outer scrolling');
   assert.ok(evidence.actions&&evidence.camera&&
      evidence.camera.y>=evidence.shell.y-1&&
      evidence.camera.y+evidence.camera.h<=evidence.shell.y+evidence.shell.h+1,
      'Navigation controls must remain inside visible 3D stage');
   await page.screenshot({path:dir+'/two-machines-'+width+'x'+height+'.png'});
   // Selection must expose detail while preserving the same project data.
   const prior=await page.evaluate(()=>localStorage.getItem('efo-open-sandbox-project-v1'));
   await page.click('[data-3d-drag-handle]');
   await page.waitForFunction(()=>!!document.querySelector('.sandbox-3d-label.ux3-selected-label'),
      {timeout:8000});
   await page.click('[data-3d-focus-selected]');
   const detail=await page.$eval('.sandbox-3d-label.ux3-selected-label',el=>{
    const r=el.getBoundingClientRect();
    return {w:r.width,h:r.height,full:el.querySelector('strong')?.textContent};
   });
   assert.ok(detail.w<=185&&detail.h<=110,'Selected machine label is contextual, not giant: '+JSON.stringify(detail));
   const after=await page.evaluate(()=>localStorage.getItem('efo-open-sandbox-project-v1'));
   assert.equal(after,prior,'Camera focus and label selection never mutate project bytes');
   // Hide/show the palette without remounting or resetting the PLC project.
   await page.click('.p5-panel-toggles button:nth-child(1)');
   assert.equal(await page.$('[data-p5-library]'),null,'Library may be collapsed for more canvas');
   await page.click('.p5-panel-toggles button:nth-child(1)');
   assert.ok(await page.$('[data-p5-library]'),'Library restores in one action');
  }
  assert.deepEqual(errors,[],'UX5 browser checks should have no page errors');
  console.log('UX5 WORKSPACE CLARITY PASS: real two-device WebGL, layout and persistent actions');
 }finally{await browser.close();}
})().catch(err=>{console.error('UX5 WORKSPACE CLARITY FAIL',err.stack||String(err));process.exitCode=1});
