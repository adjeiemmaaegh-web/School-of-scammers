/**
 * UX3 evidence gate: real running WebGL + worker-authored factory scenes.
 * NO synthetic scene content and NO generated mockup images.
 *
 * Builds from the exact PR source under Vite preview. Load original
 * unsolved teaching scenarios using the same user-visible scene gallery
 * controls the learner sees, then screenshot the actual 3D machine workcell.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer');

const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const dir='qa-artifacts/ux3-real-workcells';
const targets=[
 {id:'mixing-tank',kind:'mixer',name:'process-machinery',width:1366,height:768},
 {id:'bottle-line',kind:'filler',name:'bottle-filling-line',width:1366,height:768},
 {id:'sorting-line',kind:'belt-conveyor',name:'sorting-conveyor',width:1024,height:768},
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage',
 ]});
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  for(const t of targets){
   await page.setViewport({width:t.width,height:t.height,deviceScaleFactor:1});
   await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
   await page.waitForSelector('.sandbox-three-canvas canvas',{timeout:20000});
   const gallery='[data-p9-scene-gallery]';
   await page.click(gallery+' > summary');
   const selector='[data-load-plant-scene="'+t.id+'"]';
   await page.waitForSelector(selector,{visible:true,timeout:12000});
   await page.click(selector);
   if(await page.$('[data-p9-scene-confirm-warning]'))await page.click(selector);
   await page.waitForFunction(kind=>{
      const raw=localStorage.getItem('efo-open-sandbox-project-v1');
      const project=raw?JSON.parse(raw):null;
      return project?.components?.some(c=>c.kind===kind);
   },{timeout:25000},t.kind);
   const ui=await page.evaluate(()=>({
      mode:document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active'),
      shell:!!document.querySelector('.sandbox-3d-shell'),
      three:!!document.querySelector('.sandbox-three-canvas canvas'),
      project:document.querySelector('.sandbox-project-meta')?.textContent?.slice(0,250),
      alerts:[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent?.slice(0,200)),
      root:document.querySelector('main')?.className,
   }));
   console.log('UX3 POST-SCENE UI',t.name,JSON.stringify({ui,pageErrors:errors.slice(-6)}));
   if(ui.mode!=='physical'){
     await page.click('[data-p5-view="physical"]');
   }
   await page.waitForSelector('.sandbox-3d-shell',{timeout:12000}).catch(async err=>{
     throw new Error('3D shell did not render after worker scene: '+JSON.stringify(ui)+
       '; pageErrors='+JSON.stringify(errors)+'; '+String(err));
   });
   await page.$eval('.sandbox-3d-shell',el=>el.scrollIntoView({block:'start'}));
   await page.waitForSelector('[data-3d-fit-scene]',{visible:true,timeout:12000});
   await page.click('[data-3d-fit-scene]');
   await page.waitForFunction(()=>document.querySelector('.sandbox-three-canvas canvas')?.width>300,
     {timeout:12000});
   await page.mouse.move(1,1); // exclude transient hover expansion from passive-size evidence
   await sleep(500); // only for WebGL paint to settle, not simulation progression
   const evidence=await page.evaluate(kind=>{
     const raw=localStorage.getItem('efo-open-sandbox-project-v1');
     const project=raw?JSON.parse(raw):null;
     const canvas=document.querySelector('.sandbox-three-canvas canvas');
     const rect=canvas?.getBoundingClientRect();
     const pane=document.querySelector('.p5-layout')?.getBoundingClientRect();
     return {
       projectKinds:project?.components?.map(c=>c.kind),
       plantLabels:(project?.components||[]).filter(c=>['mixer','filler','belt-conveyor','valve','agitator'].includes(c.kind)).map(c=>({
         id:c.id,
         compact:!!document.querySelector('.sandbox-3d-label.ux3-compact-label[data-3d-drag-handle="'+CSS.escape(c.id)+'"]'),
       })),
       realWorkerScene:project?.components?.some(c=>c.kind===kind),
       projectWires:project?.wires?.length,
       canvas:{w:rect?.width,h:rect?.height,x:rect?.x,y:rect?.y},
       workspace:{w:pane?.width,h:pane?.height},
       scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
       viewport:[innerWidth,innerHeight],
       status:document.querySelector('.sandbox-3d-hud')?.textContent?.slice(0,220),
       mode:document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active'),
       labels:[...document.querySelectorAll('.sandbox-3d-label')].map(el=>({
         text:el.querySelector('strong')?.textContent,
         compact:el.classList.contains('ux3-compact-label'),
         width:Math.round(el.getBoundingClientRect().width),
         height:Math.round(el.getBoundingClientRect().height),
       })),
       terminals:[...document.querySelectorAll('.sandbox-3d-terminal')].map(el=>({
         width:Math.round(el.getBoundingClientRect().width),
         selected:el.classList.contains('selected'),
          interactive:el.matches(':hover, :focus-visible'),
          visible:getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none',
       })),
     };
   },t.kind);
   assert.ok(evidence.realWorkerScene,'Worker must own the selected scene: '+JSON.stringify(evidence));
   assert.equal(evidence.mode,'physical','3D must be the active workspace');
   assert.ok(evidence.canvas.w>250&&evidence.canvas.h>140,
     'Factory viewport must remain useful: '+JSON.stringify(evidence));
   assert.ok(evidence.scroll[0]<=t.width+2&&evidence.scroll[1]<=t.height+2,
     'No outer-page scrolling: '+JSON.stringify(evidence));
   assert.ok(evidence.labels.length>=2 &&
     evidence.labels.filter(l=>l.compact).length>=2 &&
     evidence.labels.filter(l=>l.compact).every(l=>l.width<=110&&l.height<=32),
     'Unselected labels must be compact, not obscure real 3D machines: '+
      JSON.stringify(evidence.labels));
   assert.ok(evidence.plantLabels.every(label=>label.compact),
     'Plant labels must stay compact even with one or two machines: '+
      JSON.stringify(evidence.plantLabels));
   assert.ok(evidence.terminals.length>=2 &&
     evidence.terminals.filter(p=>!p.selected && !p.interactive && p.visible).every(p=>p.width<=22),
     'Passive visible PLC terminals must be pin markers, not giant HTML buttons: '+
       JSON.stringify(evidence.terminals.slice(0,20)));
   console.log('UX3 REAL SCENE',t.name,JSON.stringify({
     ...evidence,labels:evidence.labels.slice(0,15),
     terminals:evidence.terminals.length,
   }));
   await page.screenshot({path:dir+'/'+t.name+'-'+t.width+'x'+t.height+'.png'});
  }
  assert.deepEqual(errors,[],'Real WebGL scene and worker actions have no uncaught page errors');
  console.log('UX3 REAL WORKCELLS PASS: 3 worker-authored scenes with actual WebGL screenshots');
 }finally{await browser.close();}
})().catch(error=>{
 console.error('UX3 REAL WORKCELLS FAIL',error.stack||String(error));process.exitCode=1;
});
