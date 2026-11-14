#!/usr/bin/env node
/** Reproduce Vercel response security headers on a local HTTP test server.
 * Checks actual browser CSP enforcement AND app/Worker startup. This is a
 * simulation of checked-in config, NOT verification of a live deployment.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const deployment=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const globalPolicy=deployment.headers.find(x=>x.source==='/(.*)');
assert.ok(globalPolicy,'Global response header policy missing');
const headers=Object.fromEntries(globalPolicy.headers.map(x=>[x.key.toLowerCase(),x.value]));
for(const name of ['content-security-policy','x-content-type-options',
 'referrer-policy','permissions-policy','x-frame-options'])
 assert.ok(headers[name],'Missing '+name);
for(const name of ["script-src 'self'","object-src 'none'","frame-ancestors 'none'",
 "base-uri 'self'","connect-src 'self'"])
 assert.ok(headers['content-security-policy'].includes(name),'CSP missing '+name);
assert.ok(!headers['content-security-policy'].includes("'unsafe-eval'"));
assert.ok(!headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let rel;
 try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{
  res.writeHead(400);res.end();return;
 }
 const file=path.resolve(dist,'.'+rel);
 const inside=file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile();
 const target=inside?file:path.join(dist,'index.html');
 const ext=path.extname(target);
 res.writeHead(200,{...headers,'content-type':mime[ext]??'application/octet-stream',
  ...(rel==='/sw.js'?{'cache-control':'no-cache, no-store, must-revalidate'}:{})});
 fs.createReadStream(target).pipe(res);
});
(async()=>{
 assert.ok(fs.existsSync(path.join(dist,'index.html')),'Build must exist');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,origin='http://127.0.0.1:'+port;
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox',
  '--disable-setuid-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],blocked=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',x=>{if(x.type()==='error'&&/Refused to execute inline script/.test(x.text()))blocked.push(x.text());});
 try{
  const response=await page.goto(origin+'/',{waitUntil:'networkidle0',timeout:40000});
  assert.equal(response.status(),200);
  const returned=response.headers();
  for(const k of Object.keys(headers))assert.equal(returned[k],headers[k],'Actual test response header '+k);
  await page.waitForSelector('main h1',{timeout:20000});
  // Runtime script injection is a genuine exploit boundary: static CSP must block it.
  await page.evaluate(()=>{
   const el=document.createElement('script');
   el.textContent='window.__qaInlineScriptExecuted=true';
   document.head.appendChild(el);
  });
  assert.equal(await page.evaluate(()=>window.__qaInlineScriptExecuted),undefined,
   'CSP should prevent arbitrary inline JavaScript execution');
  // The application's legitimate lazy imports and module Worker must still load.
  await page.goto(origin+'/sandbox',{waitUntil:'networkidle0',timeout:40000});
  await page.waitForSelector('[data-p9-scene-gallery]',{timeout:25000});
  await page.$eval('[data-p9-scene-gallery]',el=>{el.open=true;});
  assert.ok(await page.$('[data-load-plant-scene="gate-accumulation"]'));
  assert.deepEqual(errors,[], 'Secure policy must not cause JS/Worker runtime failures');
  console.log('QA CSP RUNTIME PASS: actual browser enforced inline-script block, 5 deployment headers, lazy sandbox/Worker ready');
 }finally{await browser.close();}
})().catch(e=>{console.error('QA CSP RUNTIME FAIL',e.stack||String(e));process.exitCode=1;})
 .finally(()=>server.close());
