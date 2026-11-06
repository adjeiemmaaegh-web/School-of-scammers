#!/usr/bin/env node
/** Native Windows / installed Microsoft Edge CI. Hosted runner is not an 8GB shop PC.
 * Never labels Edge execution as Safari, mobile hardware or industrial acceptance.
 */
const assert=require('node:assert/strict');
const os=require('node:os'),path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4175';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 if(process.platform!=='win32')throw Error('Run on genuine Windows runner');
 const server=spawn(process.execPath,[path.join(__dirname,'..','node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port','4175','--strictPort'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  let serving=false;for(let i=0;i<90;i++){
   try{if((await fetch(base+'/')).ok){serving=true;break;}}catch{}
   if(server.exitCode!==null)throw Error('Vite server stopped unexpectedly');
   await pause(500);
  }
  assert.equal(serving,true,'Compiled Vite preview must launch on Windows');
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=d3d11']});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const routes=['/','/engineering','/workcell-composer','/process-control','/assessments','/dc-circuit'];
  for(const route of routes){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:35000});
   assert.ok(response?.ok(),'Edge route '+route);
   await page.locator('h1').first().waitFor({timeout:20000});
  }
  await page.goto(base+'/sandbox',{waitUntil:'domcontentloaded'});
  await page.locator('.sandbox-3d-shell').waitFor({timeout:20000});
  await page.waitForFunction(() => !!document.querySelector('canvas.sandbox-three-canvas') ||
    !!document.querySelector('.sandbox-3d-fallback'), { timeout:20000 });
  const graphics = await page.evaluate(() => {
    const canvas=document.querySelector('canvas.sandbox-three-canvas');
    return {rendered3D:!!canvas && canvas.width>0 && canvas.height>0,
      fallback:document.querySelector('.sandbox-3d-fallback')?.textContent?.trim()??null};
  });
  if(graphics.rendered3D){
    await page.getByRole('button',{name:'Place starter layout'}).first().click();
    await page.locator('[data-scene-terminal-id="plc-2.I0.0"]').waitFor({timeout:10000});
    assert.equal(await page.locator('.sandbox-device').count(),6,'3D workbench and patch panel must agree on placed devices');
    console.log('NATIVE EDGE 3D WEBGL PASS: live 3D device terminals and patch panel are available');
  }else{
    assert.ok(graphics.fallback?.includes('3D renderer unavailable'),
      '3D unavailable message must be explicit when Windows host disables WebGL');
    console.log('NATIVE EDGE 3D WEBGL UNVERIFIED: hosted runner disabled WebGL; real WebGL acceptance remains OPEN');
  }
  await page.goto(base+'/workcell-composer',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Commissioning scenario template').selectOption('packaging-cell');
  await page.getByRole('button',{name:'Load commissioning scenario'}).click();
  await page.getByRole('button',{name:'Run current scene acceptance'}).click();
  await page.getByLabel('Current scene acceptance results').getByText('PASS',{exact:true}).first().waitFor();
  await page.goto(base+'/engineering',{waitUntil:'domcontentloaded'});
  await page.getByLabel('External PLC reference trace comparison').waitFor();
  await page.goto(base+'/process-control',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab',{name:'Structured Text editor'}).click();
  await page.getByLabel('Import PLCopen Structured Text XML').waitFor();
  await page.goto(base+'/assessments',{waitUntil:'domcontentloaded'});
  await page.getByLabel('Instructor and learner field validation evidence').waitFor();
  await page.setViewportSize({width:390,height:780});
  for(const route of ['/','/labs','/workcell-composer']){
   await page.goto(base+route,{waitUntil:'domcontentloaded'});
   await page.locator('h1').first().waitFor({timeout:20000});
   const size=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
   assert.ok(size[0]<=size[1]+2,'Mobile-sized Edge horizontal overflow at '+route);
  }
  assert.deepEqual(errors,[],'No uncaught native Edge page exceptions');
  const report={scope:'GitHub-hosted Windows Edge browser, not 8GB owner hardware',
   validHardwareAcceptance:false,validSafariAcceptance:false,validMobileDeviceAcceptance:false,
   platform:os.platform(),release:os.release(),arch:os.arch(),totalMemoryGiB:Math.round(os.totalmem()/1073741824*10)/10,
   edgeVersion:browser.version(),threeDWebGLVerified:graphics.rendered3D,threeDFallback:graphics.fallback,routes,checks:['scene FAT','reference PLC CSV panel','PLCopen ST editor','anonymous trial panel','390px responsive'],pageErrors:errors,passed:true};
  fs.mkdirSync('qa-artifacts',{recursive:true});
  fs.writeFileSync('qa-artifacts/windows-edge-smoke.json',JSON.stringify(report,null,2)+'\n');
  console.log('NATIVE WINDOWS EDGE HOSTED RUNNER PASS',report.edgeVersion);
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(error=>{console.error('WINDOWS EDGE HOSTED RUNNER FAIL',error.stack||error);process.exitCode=1});
