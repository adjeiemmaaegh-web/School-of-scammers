#!/usr/bin/env node
/**
 * Automated high-severity WCAG baseline, run on the built static frontend.
 * A zero-violation automated scan is NOT a declaration of WCAG conformance.
 * Usage: PLC_BASE_URL=http://127.0.0.1:4173 node scripts/accessibility-acceptance.cjs
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const axePath=require.resolve('axe-core/axe.min.js');
const base=(process.env.PLC_BASE_URL||'http://127.0.0.1:4173').replace(/\/+$/,'');
const routes=['/','/learn','/assess','/sandbox','/scenario/plc-sbx-find-fault?seed=1','/trade/plc','/labs','/pathway','/workspaces','/engineering','/simulation','/process-control','/starter-lab','/pneumatics','/workcell-composer','/electrical-bench','/dc-circuit','/assessments','/reference','/settings','/about'];
const tags=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
async function run(){
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage();
 const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const route of routes){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:40000});
   assert.ok([200,304].includes(response?.status()),'HTTP route '+route);
   await page.waitForSelector('h1',{timeout:18000});
   await page.addScriptTag({path:axePath});
   const result=await page.evaluate(async tagSet=>{
    const report=await window.axe.run(document,{runOnly:{type:'tag',values:tagSet}});
    return {serious:report.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,targets:v.nodes.slice(0,5).flatMap(n=>n.target)})),moderate:report.violations.filter(v=>v.impact==='moderate').map(v=>v.id)};
   },tags);
   if(result.serious.length){ failures.push({route,issues:result.serious}); console.log('AXE DETAILS',route,JSON.stringify(result.serious)); }
   console.log('AXE ROUTE',route,'serious/critical',result.serious.length,'moderate',result.moderate.length);
  }
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForSelector('h1');
  await page.keyboard.press('Tab');
  const skip=await page.evaluate(()=>({text:document.activeElement?.textContent?.trim(),tag:document.activeElement?.tagName}));
  assert.equal(skip.text,'Skip to main content','Skip link should receive first Tab focus');
  await page.keyboard.press('Enter');
  const mainFocused=await page.evaluate(()=>document.activeElement?.id==='main');
  assert.ok(mainFocused,'Skip link should focus the main landmark in the current app');
  console.log('KEYBOARD SKIP PASS');
  assert.equal(errors.length,0,'No page errors during accessibility sweep');
  assert.equal(failures.length,0,'Serious/critical accessibility violations: '+JSON.stringify(failures));
  console.log('ACCESSIBILITY ACCEPTANCE PASS:',routes.length,'routes, zero detected serious/critical WCAG violations; skip navigation functional');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('ACCESSIBILITY ACCEPTANCE FAIL',e.stack||String(e));process.exitCode=1;});
