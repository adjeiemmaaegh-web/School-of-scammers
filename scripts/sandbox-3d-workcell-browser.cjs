/**
 * 3D-FIRST, physical browser acceptance (software WebGL): Orbit / Fly /
 * First Person, true worker-owned P3 equipment drawn as 3D meshes and direct
 * pointer selection/drag. The saved project is the only mutation evidence.
 * The camera is an inspection view; it is not an input to the PLC.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const KEY='efo-open-sandbox-project-v1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),KEY);
 const cameraPosition=async()=>{
  const text=await page.$eval('[data-3d-camera-status]',el=>el.textContent||'');
  const match=/Camera ([-.0-9]+), ([-.0-9]+), ([-.0-9]+) m/.exec(text);
  assert.ok(match,'Camera pose must be projected from the real Three.js camera: '+text);
  return match.slice(1).map(Number);
 };
 const setNumber=async(selector,value)=>{
  await page.$eval(selector,el=>el.scrollIntoView({block:'center'}));
  await page.click(selector,{clickCount:3});
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
 };
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('.sandbox-three-canvas',{timeout:20000});
  assert.equal(await page.$eval('[data-p5-view-active]',el=>el.getAttribute('data-p5-view-active')),'physical',
   'An industrial scene opens in 3D by default, not a 2D plan');
  assert.equal(await page.$eval('[data-3d-camera-mode="orbit"]',el=>el.getAttribute('aria-pressed')),'true');
  await page.click('[data-3d-camera-mode="fly"]');
  await page.waitForFunction(()=>document.querySelector('[data-3d-camera-status]')?.textContent.includes('Camera '));
  const flyBefore=await cameraPosition();
  assert.equal(await page.$eval('.sandbox-three-canvas',canvas=>{canvas.focus();return document.activeElement===canvas;}),true,'Keyboard must focus the active 3D canvas');
  await page.keyboard.down('w');
  await sleep(750);
  await page.keyboard.up('w');
  await page.waitForFunction(before=>{
   const text=document.querySelector('[data-3d-camera-status]')?.textContent||'';
   const m=/Camera ([-.0-9]+), ([-.0-9]+), ([-.0-9]+) m/.exec(text);
   return m&&Math.abs(Number(m[1])-before[0])+Math.abs(Number(m[3])-before[2])>.02;
  },{timeout:12000},flyBefore);
  const flyAfter=await cameraPosition();
  assert.notDeepEqual(flyAfter,flyBefore,'Fly must move the actual Three.js camera');
  await page.click('[data-3d-camera-mode="first-person"]');
  await page.waitForFunction(()=>document.querySelector('[data-3d-camera-status]')?.textContent.includes('Eye height 1.8 m'));
  await page.waitForFunction(()=>/Camera [^,]+, 1.80,/.test(document.querySelector('[data-3d-camera-status]')?.textContent||''));
  const first=await cameraPosition();
  assert.equal(first[1],1.8);
  assert.equal(await page.$eval('.sandbox-three-canvas',canvas=>{canvas.focus();return document.activeElement===canvas;}),true,'Keyboard must focus the active 3D canvas');
  await page.keyboard.down('w');await sleep(350);await page.keyboard.up('w');
  const walking=await cameraPosition();
  assert.equal(walking[1],1.8,'Walking must remain at the documented eye height');
  await page.click('[data-3d-camera-mode="orbit"]');
  await page.waitForFunction(()=>document.querySelector('[data-3d-camera-mode="orbit"]')?.getAttribute('aria-pressed')==='true');

  const placed=await page.evaluate(()=>{
   const btn=[...document.querySelectorAll('.sandbox-palette-item')]
     .find(el=>el.querySelector('strong')?.textContent.trim()==='Powered/gravity rollers');
   if(!btn||btn.disabled)return false;btn.click();return true;
  });
  assert.ok(placed,'Real original worker-physics roller conveyor in the library');
  await page.waitForFunction(key=>{
   const p=JSON.parse(localStorage.getItem(key)||'null');
   return p?.components?.length===1;
  },{timeout:15000},KEY);
  const id=(await saved()).components[0].id;
  assert.equal((await saved()).components[0].kind,'roller-conveyor');
  await page.$eval(`[data-device-id="${id}"] .sandbox-inspect-link`,el=>el.scrollIntoView({block:'center'}));
  await page.click(`[data-device-id="${id}"] .sandbox-inspect-link`);
  await page.waitForSelector('[data-pos-x]');
  await setNumber('[data-pos-x]',455);await setNumber('[data-pos-y]',225);
  await page.waitForFunction(id=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   const c=p?.components?.find(c=>c.id===id);
   return c&&c.x===455&&c.y===225;
  },{timeout:12000},id);
  const canvas=await page.$('.sandbox-three-canvas');
  await page.$eval('.sandbox-three-canvas',el=>el.scrollIntoView({block:'center'}));
  const box=await canvas.boundingBox();assert.ok(box&&box.width>200&&box.height>200);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  const before=(await saved()).components[0];
  // The model is exactly at (0,0,0) in real Three coordinates. The centre
  // ray hits the actual worker-owned roller model, not the 2D canvas.
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  await page.waitForFunction(()=>document.querySelector('[data-workspace-selection] input:checked')!==null,
    {timeout:12000});
  await page.mouse.move(cx+65,cy+18,{steps:14});
  await page.mouse.up();
  await page.waitForFunction((id,oldX)=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id===id)?.x!==oldX;
  },{timeout:15000},id,before.x);
  const moved=(await saved()).components[0];
  assert.equal(moved.yawDeg??0,0);
  assert.notEqual(moved.x,before.x,'Direct 3D drag must issue an accepted worker move');
  assert.equal((await saved()).components.length,1,'Direct 3D drag cannot create duplicate objects');
  await page.evaluate(()=>{
   const button=[...document.querySelectorAll('.workspace-authoring-bar button')]
     .find(b=>b.textContent.trim()==='↷ 90°');
   if(!button||button.disabled)throw Error('3D selected equipment lacks rotate command');
   button.click();
  });
  await page.waitForFunction(id=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id===id)?.yawDeg===90;
  },{timeout:15000},id);
  await page.click('[data-undo]');
  await page.waitForFunction(id=>{
   const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null');
   return p?.components?.find(c=>c.id===id)?.yawDeg===0;
  },{timeout:15000},id);
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('.sandbox-three-canvas');
  assert.equal((await saved()).components[0].x,moved.x,'3D authored geometry round-trips on reload');
  assert.equal((await saved()).components[0].yawDeg??0,0);
  assert.deepEqual(errors.filter(s=>!/WebGL|GPU stall|favicon|swiftshader/i.test(s)),[]);
  console.log('3D WORKCELL BUILDER PASS: 3D default, Fly movement, First Person eye height, physical worker roller 3D drag, yaw undo and persistence');
 }finally{await browser.close();}
})().catch(e=>{console.error('3D WORKCELL BUILDER FAIL',e.stack||String(e));process.exitCode=1;});
