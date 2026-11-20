/** End-to-end ungraded Steady Guide first-lamp learning path.
 * Starts in the actual Guide, uses ordinary simulator UI clicks to place and wire,
 * tests the authoritative worker output and a deliberately broken connection.
 * New isolated browser profile only. Does not use private projects or assessment keys.
 */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const base=process.env.PLC_BASE_URL||'http://127.0.0.1:4173';
const projectKey='efo-open-sandbox-project-v1';
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:[
  '--no-sandbox','--disable-setuid-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 ]});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setViewport({width:1440,height:940,deviceScaleFactor:1});
  await page.goto(base+'/guide/topic/first-lamp',{waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-steady-topic="first-lamp"]',{timeout:15000});
  const recipe=await page.$$eval('[data-steady-first-lamp-wire]',items=>items.map(el=>({
   from:{kind:el.getAttribute('data-from-kind'),terminal:el.getAttribute('data-from-terminal')},
   to:{kind:el.getAttribute('data-to-kind'),terminal:el.getAttribute('data-to-terminal')},
  })));
  assert.deepEqual(recipe,[
   {from:{kind:'supply',terminal:'P24'},to:{kind:'start',terminal:'A'}},
   {from:{kind:'start',terminal:'B'},to:{kind:'lamp',terminal:'L+'}},
   {from:{kind:'lamp',terminal:'M-'},to:{kind:'supply',terminal:'M0'}},
  ],'The beginner instructions must expose three real named terminal pairs');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),projectKey),null,
   'The Guide must not create or overwrite a project key in a clean browser profile');
  // Link performs navigation only; it must not clear/create a project.
  await page.click('[data-steady-topic="first-lamp"] .sg-actions a[href="/sandbox"]');
  await page.waitForSelector('.sandbox-toolbar',{timeout:20000});
  assert.equal(new URL(page.url()).pathname,'/sandbox');
  await page.waitForFunction(()=>!!document.querySelector('.sandbox-palette-item:not([disabled])'),{timeout:16000});
  assert.equal(await page.$$eval('.sandbox-device',nodes=>nodes.length),0,
    'The practice begins with an actually empty new browser profile; Guide did not place anything');
  // The fresh app may create its own empty working-copy record on first load.
  // Only assert that Guide did not create equipment: the project must still be blank.
  // Later, once a real built project is saved, verify returning to Guide preserves exact bytes.
  // Work in the real keyboard-accessible Logical view, so no WebGL is required for wiring.
  await page.click('[data-p5-view="logical"]');
  await page.waitForSelector('[data-p5-logical-canvas]',{timeout:12000});
  const search='input[aria-label="Search component library"]';
  const components=[
   {kind:'supply',label:'24V supply',term:'24V supply'},
   {kind:'start',label:'START NO',term:'START NO'},
   {kind:'lamp',label:'24V pilot lamp',term:'pilot lamp'},
  ];
  const ids={};
  for(let i=0;i<components.length;i++){
   const item=components[i];
   await page.click(search);
   await page.keyboard.down('Control');
   await page.keyboard.press('KeyA');
   await page.keyboard.up('Control');
   await page.keyboard.press('Backspace');
   await page.type(search,item.term);
   // A broad search may return multiple valid components. Click the exact name.
   const entry='.sandbox-palette-item[title^="Place '+item.label+'."]:not([disabled])';
   await page.waitForSelector(entry,{timeout:10000}).catch(async error=>{
    const candidates=await page.$$eval('.sandbox-palette-item',nodes=>
     nodes.map(node=>node.getAttribute('title')).slice(0,12));
    throw new Error('Missing exact '+item.label+' search result: '+JSON.stringify(candidates)+'; '+error.message);
   });
   await page.$eval(entry,el=>el.scrollIntoView({block:'center'}));
   await page.click(entry);
   await page.waitForFunction(count=>document.querySelectorAll('.sandbox-device').length===count,{timeout:12000},i+1);
   const idsOfKind=await page.$$eval('.sandbox-device', (nodes,kind)=>
    nodes.map(node=>node.getAttribute('data-device-id')).filter(id=>id?.startsWith(kind+'-')),item.kind);
   assert.equal(idsOfKind.length,1,'One genuine instance of '+item.kind);
   ids[item.kind]=idsOfKind[0];
  }
  assert.equal(await page.$$eval('.sandbox-device',items=>items.length),3);
  assert.equal(await page.$$eval('[data-p5-logical-device]',items=>items.length),3);
  await page.click('[data-ux6-tool="wire"]');
  // The wires list is intentionally unmounted while the engineering dock is
  // collapsed. Opening diagnostics is an ordinary UI action; without it a zero
  // length query gives a false negative even for valid worker-accepted wires.
  await page.$eval('[data-p5-dock-tab="diagnostics"]',el=>el.click());
  await page.waitForSelector('.sandbox-wire-list',{timeout:12000});
  assert.equal(await page.$$eval('.sandbox-wire-list>div',items=>items.length),0);
  const wire=async(from,to,index)=>{
   const a='[data-terminal-id="'+from+'"]',b='[data-terminal-id="'+to+'"]';
   await page.$eval(a,el=>el.scrollIntoView({block:'center'}));
   await page.click(a);
   await page.waitForFunction(id=>document.querySelector('[data-terminal-id="'+id+'"]')?.classList.contains('selected'),{timeout:7000},from);
   await page.$eval(b,el=>el.scrollIntoView({block:'center'}));
   await page.click(b);
   await page.waitForFunction(expected=>document.querySelectorAll('.sandbox-wire-list>div').length===expected,{timeout:10000},index+1);
  };
  for(let i=0;i<recipe.length;i++){
   const link=recipe[i];
   await wire(ids[link.from.kind]+'.'+link.from.terminal,
    ids[link.to.kind]+'.'+link.to.terminal,i);
  }
  assert.equal(await page.$$eval('[data-p5-wire]',items=>items.length),3,
    'The real logical diagram contains the three accepted project wires');
  const lamp=ids.lamp,button=ids.start;
  const status=value=>page.waitForFunction((id,expected)=>
   document.querySelector('[data-device-id="'+id+'"] .sandbox-device-status')?.textContent.trim()===expected,
   {timeout:10000},lamp,value);
  const command=async label=>{
   const ok=await page.evaluate(name=>{
    const el=[...document.querySelectorAll('.sandbox-toolbar button')].find(b=>b.textContent.trim()===name&&!b.disabled);
    if(!el)return false;el.click();return true;
   },label);
   assert.ok(ok,'Expected enabled real toolbar control '+label);
  };
  await command('▶ Run');
  await page.waitForFunction(()=>Number(document.querySelector('.sandbox-scan')?.textContent?.replace(/\D/g,'')||0)>=3,{timeout:12000});
  await status('OFF');
  await page.click('[data-device-id="'+button+'"] .sandbox-operate');
  await status('ILLUMINATED');
  await page.click('[data-device-id="'+button+'"] .sandbox-operate');
  await status('OFF');
  // Demonstrate a real negative: break START B -> lamp L+, then operate START.
  await command('Pause');
  const from=ids.start+'.B',to=ids.lamp+'.L+';
  const removed=await page.evaluate(([a,b])=>{
   const row=[...document.querySelectorAll('.sandbox-wire-list>div')].find(el=>
    el.querySelector('code')?.textContent?.includes(a+' → '+b));
   const remove=row?.querySelector('button[aria-label^="Remove wire"]');
   if(!remove||remove.disabled)return false;
   remove.click();return true;
  },[from,to]);
  assert.ok(removed,'An actual project wire must be removable through the user interface');
  await page.waitForFunction(()=>document.querySelectorAll('.sandbox-wire-list>div').length===2,{timeout:10000});
  await command('▶ Run');
  const tickBefore=await page.$eval('.sandbox-scan',el=>Number(el.textContent.replace(/\D/g,'')));
  await page.click('[data-device-id="'+button+'"] .sandbox-operate');
  await page.waitForFunction(before=>Number(document.querySelector('.sandbox-scan')?.textContent?.replace(/\D/g,'')||0)>=before+3,{timeout:12000},tickBefore);
  await status('OFF');
  await command('Pause');
  await page.waitForFunction(k=>{
   try{const p=JSON.parse(localStorage.getItem(k)||'null');return p?.components?.length===3&&p?.wires?.length===2;}catch{return false;}
  },{timeout:10000},projectKey);
  const projectAfterPractice=await page.evaluate(k=>localStorage.getItem(k),projectKey);
  await page.goto(base+'/guide/topic/first-lamp',{waitUntil:'networkidle0',timeout:45000});
  await page.waitForSelector('[data-steady-topic="first-lamp"]',{timeout:15000});
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),projectKey),projectAfterPractice,
   'Returning to the Guide must not rewrite the learner project');
  assert.equal(await page.$$eval('[data-steady-first-lamp-wire]',els=>els.length),3);
  assert.deepEqual(errors.filter(e=>!/WebGL|GPU stall|favicon|swiftshader/i.test(e)),[],
   'No application errors during first-lamp learning journey');
  console.log('STEADY GUIDE FIRST LAMP END-TO-END PASS: Guide → manual placement → three worker-accepted wires → OFF/ON/OFF → missing-wire failure → Guide data isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error('STEADY GUIDE FIRST LAMP E2E FAIL',e.stack||String(e));process.exitCode=1});
