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
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark',{timeout:8000});
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
          paletteDebug:(()=>{
            const parent=document.querySelector('.sandbox-palette');
            const list=document.querySelector('.sandbox-palette-list');
            const heading=parent?.querySelector('.sandbox-rail-heading');
            const search=parent?.querySelector('.sandbox-library-search');
            const first=list?.querySelector('.ux2-equipment-tile');
            const p=first?.getBoundingClientRect();
            const layer=p?document.elementFromPoint(p.x+p.width/2,p.y+p.height/2):null;
            const px=(el)=>{
              const r=el?.getBoundingClientRect();
              return r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null;
            };
            return {container:px(parent),heading:px(heading),search:px(search),
              filter:px(parent?.querySelector('.p5-device-families')),
              list:px(list),first:px(first),
              parentScrollTop:parent?.scrollTop,listScrollTop:list?.scrollTop,
              firstDisplay:first?getComputedStyle(first).display:null,
              firstOpacity:first?getComputedStyle(first).opacity:null,
              atCenter:layer?.tagName,
              onTile:!!(first&&layer&&(first===layer||first.contains(layer)))};
          })(),
          fullyVisibleTiles:(()=>{
            const list=document.querySelector('.sandbox-palette-list');
            if(!list)return 0;
            const available=list.getBoundingClientRect();
            return [...list.querySelectorAll('.ux2-equipment-tile')].filter(el=>{
              const box=el.getBoundingClientRect();
              const aside=document.querySelector('[data-p5-library]')?.getBoundingClientRect();
              const layer=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
              return box.width>20&&box.height>50&&aside&&
                box.left>=available.left-1&&box.right<=available.right+1&&
                box.left>=aside.left-1&&box.right<=aside.right+1&&
                box.top>=available.top-1&&box.bottom<=available.bottom+1&&
                !!layer&&(el===layer||el.contains(layer));
            }).length;
          })(),
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
      assert.ok(measurements.fullyVisibleTiles>=2,
        'At least one complete illustrated equipment row must be visible AND directly hittable, with no horizontal or vertical sidebar clipping, at '+
        viewport.name+': '+JSON.stringify(measurements));
      assert.ok(measurements.paletteDebug.first.x>=measurements.paletteDebug.container.x-1&&
        measurements.paletteDebug.first.x+measurements.paletteDebug.first.w<=
        measurements.paletteDebug.container.x+measurements.paletteDebug.container.w+1,
        'First equipment tile must remain inside left palette, never underneath factory canvas at '+
        viewport.name+': '+JSON.stringify(measurements.paletteDebug));
      assert.ok(measurements.dock?.h>=24,
        'Engineering dock controls must remain available (collapsed is OK): '+
        viewport.name+' '+JSON.stringify(measurements));
      assert.ok(measurements.library?.h>100,'Illustrated library must remain available');
      console.log('UX2 GEOMETRY',viewport.name,JSON.stringify(measurements));
      await page.screenshot({path:'qa-artifacts/ux2-stage1/'+viewport.name+'.png'});
    }
    // UX8: the registered equipment grid must be scrollable even after opening
    // the full assembly editor. Exercise real wheel input, not only CSS flags.
    for(const vp of [{width:1366,height:768},{width:1280,height:720},
                     {width:1024,height:768},{width:1920,height:1080}]) {
      await page.setViewport({...vp,deviceScaleFactor:1});
      await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
      await page.waitForSelector('[data-library-tab-trigger="components"]');
      const dimensions=await page.evaluate(()=>{
        const list=document.querySelector('.sandbox-palette-list');
        const rect=list.getBoundingClientRect();
        return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,
          listHeight:list.clientHeight,listContent:list.scrollHeight,
          count:list.querySelectorAll('.sandbox-palette-item').length,
          active:document.querySelector('[data-library-tab-trigger="components"]').getAttribute('aria-selected'),
          listOverflow:getComputedStyle(list).overflowY};
      });
      assert.ok(dimensions.count>=54,'UX8 equipment registry missing '+JSON.stringify(vp));
      assert.equal(dimensions.active,'true');
      assert.equal(dimensions.listOverflow,'auto');
      assert.ok(dimensions.listHeight>=120,
        'UX8 device viewport must not collapse: '+JSON.stringify({vp,dimensions}));
      assert.ok(dimensions.listContent>dimensions.listHeight);
      await page.mouse.move(dimensions.x,dimensions.y);
      await page.mouse.wheel({deltaY:260});
      await page.waitForFunction(()=>document.querySelector('.sandbox-palette-list').scrollTop>0);
      const prior=await page.$eval('.sandbox-palette-list',el=>el.scrollTop);
      assert.ok(prior>0,'UX8 mouse wheel must move the equipment list');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollTop),0,
        'UX8 wheel must not scroll the outer page');
      await page.click('[data-library-tab-trigger="assemblies"]');
      await page.$eval('[data-p7-assembly-library]',el=>{el.open=true;});
      const assembly=await page.evaluate(()=>{
        const panel=document.querySelector('[data-library-assemblies]');
        const components=document.querySelector('[data-library-components]');
        return {selected:document.querySelector('[data-library-tab-trigger="assemblies"]').getAttribute('aria-selected'),
          shown:!panel.hidden,componentsHidden:components.hidden,
          height:panel.getBoundingClientRect().height,
          expanded:panel.querySelector('details').open};
      });
      assert.equal(assembly.selected,'true');
      assert.ok(assembly.shown&&assembly.componentsHidden&&assembly.expanded);
      assert.ok(assembly.height>=120,
        'UX8 Assemblies must have its own usable viewport: '+JSON.stringify({vp,assembly}));
      await page.click('[data-library-tab-trigger="components"]');
      await page.waitForFunction(previous=>document.querySelector('.sandbox-palette-list').scrollTop>=previous-3,
        {timeout:3000},prior);
      assert.equal(await page.evaluate(()=>document.querySelector('[data-library-components]').hidden),false);
      assert.equal(await page.evaluate(()=>document.querySelector('[data-library-assemblies]').hidden),true);
      assert.ok(await page.$eval('.sandbox-palette-list',el=>el.clientHeight)>=120,
        'UX8 expanded-but-hidden Assemblies must not shrink the equipment list');
      console.log('UX8 LIBRARY TABS PASS',JSON.stringify(vp));
    }
    // UX9: The earlier QA only tested heights >=720 CSS px. At short laptop
    // viewport heights the fallback layout collapsed the active Components
    // panel to ZERO despite displaying the 54-count heading and selected tab.
    for(const vp of [{width:1366,height:700},{width:1366,height:650},
                     {width:1366,height:600},{width:1024,height:700},
                     {width:1536,height:710}]) {
      await page.setViewport({...vp,deviceScaleFactor:1});
      await page.goto(base+'/sandbox',{waitUntil:'networkidle0',timeout:30000});
      await page.waitForSelector('[data-library-tab-trigger="components"]');
      // Short viewports intentionally retain outer document scrolling.
      // Scroll the document to the real library before testing wheel input.
      await page.evaluate(()=>{
        const r=document.querySelector('.sandbox-palette').getBoundingClientRect();
        scrollTo(0,Math.max(0,scrollY+r.top-100));
      });
      const data=await page.evaluate(()=>{
        const get=selector=>{
          const e=document.querySelector(selector);
          const r=e.getBoundingClientRect();
          return {height:e.clientHeight,top:r.top,bottom:r.bottom,width:r.width,
            scrollHeight:e.scrollHeight,display:getComputedStyle(e).display};
        };
        const list=get('.sandbox-palette-list');
        const first=get('.sandbox-palette-item');
        return {side:get('.sandbox-palette'),panel:get('#sandbox-components-panel'),
          search:get('.sandbox-library-search'),list,first,
          buttons:document.querySelectorAll('.sandbox-palette-item').length,
          selected:document.querySelector('[data-library-tab-trigger="components"]').getAttribute('aria-selected'),
          scrollY,scrollWidth:document.documentElement.scrollWidth};
      });
      assert.equal(data.selected,'true');
      assert.equal(data.buttons,54,'UX9 must preserve all registered equipment');
      assert.ok(data.panel.height>=220&&data.search.height>=25&&data.list.height>=160,
        'UX9 short viewport collapsed Components: '+JSON.stringify({vp,data}));
      assert.ok(data.first.top>=data.list.top&&data.first.bottom<=data.list.bottom+2,
        'UX9 first equipment card must be visible: '+JSON.stringify({vp,data}));
      assert.ok(data.list.top>=0&&data.list.bottom<=vp.height+2,
        'UX9 equipment list must be in reach after scrolling page: '+JSON.stringify({vp,data}));
      assert.ok(data.scrollWidth<=vp.width+2,'UX9 horizontal page overflow');
      await page.mouse.move(data.side.width/2+
        (await page.$eval('.sandbox-palette',el=>el.getBoundingClientRect().left)),
        data.list.top+Math.min(60,data.list.height/2));
      await page.mouse.wheel({deltaY:260});
      await page.waitForFunction(()=>document.querySelector('.sandbox-palette-list').scrollTop>0);
      const wheel=await page.evaluate(()=>({
        list:document.querySelector('.sandbox-palette-list').scrollTop,
        document:scrollY,
      }));
      assert.ok(Math.abs(wheel.document-data.scrollY)<=2,
        'UX9 mouse wheel scroll must stay inside the library: '+JSON.stringify({vp,data,wheel}));
      await page.click('[data-library-tab-trigger="assemblies"]');
      const switchDebug=await page.evaluate(()=>{
        const el=document.querySelector('[data-library-assemblies]');
        const aside=document.querySelector('.sandbox-palette');
        return {selected:document.querySelector('[data-library-tab-trigger="assemblies"]')
          ?.getAttribute('aria-selected'),hidden:el.hidden,height:el.clientHeight,
          display:getComputedStyle(el).display,asideHeight:aside.clientHeight,
          win:[innerWidth,innerHeight],documentScrollY:scrollY};
      });
      console.log('UX9 ASSEMBLY SWITCH',JSON.stringify({vp,switchDebug}));
      // React tab state is async; require the new panel to render before
      // measuring, especially at the 1024px narrow legacy breakpoint.
      await page.waitForFunction(()=>{
        const el=document.querySelector('[data-library-assemblies]');
        return !!el&&!el.hidden&&el.clientHeight>=160;
      },{timeout:10000});
      await page.$eval('[data-p7-assembly-library]',el=>{el.open=true;});
      const assemblies=await page.$eval('[data-library-assemblies]',el=>({
        visible:!el.hidden,height:el.clientHeight,scrollHeight:el.scrollHeight,
      }));
      assert.ok(assemblies.visible&&assemblies.height>=160,
        'UX9 Assemblies tab collapsed: '+JSON.stringify({vp,assemblies}));
      await page.click('[data-library-tab-trigger="components"]');
      await page.waitForFunction(previous=>document.querySelector('.sandbox-palette-list').scrollTop>=previous-3,
        {timeout:3000},wheel.list);
      assert.ok(await page.$eval('.sandbox-palette-list',el=>el.clientHeight)>=160);
      console.log('UX9 SHORT VIEWPORT COMPONENTS PASS',JSON.stringify(vp));
    }
    await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.ux2-equipment-tile');
    // Dark industrial is the default on /sandbox only. A user who explicitly
    // selects light must retain that preference through a reload.
    assert.equal(await page.$eval('html',el=>el.dataset.theme),'dark',
      'Open engineering workspace defaults to approved dark theme');
    await page.click('.theme-btn');
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    assert.equal(await page.evaluate(()=>localStorage.getItem('skills-lab:theme')),'light',
      'User light override is stored');
    await page.reload({waitUntil:'networkidle0'});
    await page.waitForSelector('.ux2-equipment-tile');
    assert.equal(await page.$eval('html',el=>el.dataset.theme),'light',
      'User light theme overrides the sandbox default after reload');
    await page.click('.theme-btn');
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    assert.equal(await page.evaluate(()=>localStorage.getItem('skills-lab:theme')),'dark',
      'User can restore dark theme');
    console.log('UX2 THEME PASS: dark workbench default with persisted light/dark preference');
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
    assert.equal(await page.$$eval('.sandbox-wire-list>div',els=>els.length),1,
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

    // Tablet touch alternative to HTML5 drag/drop: an illustrated device tile
    // must create a genuine worker-owned device via a touch-generated click.
    // Keep the responsive viewport desktop-style (isMobile:false).
    await page.setViewport({width:1024,height:768,deviceScaleFactor:1,
      isMobile:false,hasTouch:true});
    await page.goto(base+'/sandbox',{waitUntil:'networkidle0'});
    await page.waitForSelector('.ux2-equipment-tile');
    await page.tap('.sandbox-toolbar button:first-child'); // New blank project
    await page.waitForFunction(()=>{
      const p=JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')??'null');
      return p&&p.components.length===0;
    },{timeout:12000});
    await page.tap('[data-p5-view="logical"]');
    await page.waitForFunction(()=>document.querySelector('[data-p5-view-active]')?.getAttribute('data-p5-view-active')==='logical',
      {timeout:10000});
    await page.tap('[data-p5-category="plc"]');
    await page.waitForFunction(()=>document.querySelector('[data-p5-category="plc"]')?.getAttribute('aria-pressed')==='true' &&
      !!document.querySelector('.ux2-equipment-tile:not([disabled])'),{timeout:10000});
    console.log('UX2 TABLET TAP PRE',JSON.stringify(await page.evaluate(()=>({
      tile:document.querySelector('.ux2-equipment-tile')?.textContent,
      disabled:document.querySelector('.ux2-equipment-tile')?.disabled,
      count:document.querySelectorAll('[data-p5-logical-device]').length,
    }))));
    await page.evaluate(()=>{
      const events=[];
      window.__ux2TapEvents=events;
      for(const name of ['touchstart','touchend','pointerdown','pointerup','click']){
        document.addEventListener(name,e=>{
          if(events.length<20)events.push({
            name,target:e.target?.tagName,
            cls:e.target?.getAttribute?.('class'),
            onTile:!!e.target?.closest?.('.ux2-equipment-tile'),
          });
        },true);
      }
    });
    const hit=await page.$eval('.ux2-equipment-tile:not([disabled])',el=>{
      el.scrollIntoView({block:'center'});
      const r=el.getBoundingClientRect();
      const node=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return {box:r.toJSON(),node:node?.tagName,
        closestTile:node?.closest?.('.ux2-equipment-tile')===el,
        draggable:el.draggable,maxTouch:navigator.maxTouchPoints,
        coarse:matchMedia('(pointer: coarse)').matches};
    });
    console.log('UX2 TABLET HIT',JSON.stringify(hit));
    await page.tap('.ux2-equipment-tile:not([disabled])');
    console.log('UX2 TABLET EVENTS',JSON.stringify(await page.evaluate(()=>window.__ux2TapEvents)));
    await page.waitForFunction(()=>document.querySelectorAll('[data-p5-logical-device]').length===1,
      {timeout:12000}).catch(async error=>{
        const debug=await page.evaluate(()=>({
          logical:document.querySelectorAll('[data-p5-logical-device]').length,
          family:document.querySelector('[data-p5-category="plc"]')?.getAttribute('aria-pressed'),
          tileDisabled:document.querySelector('.ux2-equipment-tile')?.disabled,
          warnings:[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent),
          project:JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1')||'null')?.components?.map(e=>e.kind),
        }));
        throw new Error('Touch tablet tap did not place a worker component: '+
          JSON.stringify(debug)+'; '+String(error));
      });
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),
      true,'Tablet touch placement retains no outer-page scrolling');
    assert.deepEqual(uncaught,[],'No unhandled errors after touch-generated placement');
    console.log('UX2 TABLET TOUCH PASS: virtual PLC tile tap -> actual worker device; no page scrolling');
    console.log('UX2 STAGE-ONE ACCEPTANCE PASS: PC/tablet layout, SVG tiles, worker placement, real wiring, dock');
    console.log('3D drop: '+(graphical3D?'executed':'unverified due to missing WebGL'));
  } finally { await browser.close(); }
})().catch(err=>{
  console.error('UX2 STAGE-ONE ACCEPTANCE FAIL',err.stack||String(err));
  process.exitCode=1;
});
