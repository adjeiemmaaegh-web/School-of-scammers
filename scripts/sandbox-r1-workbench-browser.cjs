/** Real-Chrome acceptance for roadmap R1 (UX6): at every target size the canvas gets most of the viewport, nothing
 *  essential is clipped or covered, the active tool is explicit and keyboard-switchable, editing is visibly locked while
 *  the simulation runs, and panel visibility/size preferences survive a reload and recover from corrupt storage.
 *  Pixel-level visual approval remains an owner review of the screenshots (set R1_SHOTS=<dir> to save them). */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const shots = process.env.R1_SHOTS;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// [width, height, minimum canvas share of the viewport height]
const SIZES = [[1440, 940, 0.66], [1366, 768, 0.60], [1280, 720, 0.58], [1024, 768, 0.52], [768, 1024, 0.55]];
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const open = async (w, h) => {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
    return page;
  };
  const place = (page, labels) => page.evaluate(ls => { for (const l of ls) [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === l)?.click(); }, labels);
  try {
    for (const [w, h, share] of SIZES) {
      const page = await open(w, h);
      await place(page, ['24V supply', 'Virtual PLC 16/16', 'START NO', '24V pilot lamp', 'Pneumatic cylinder', '24V on-delay relay']);
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6, { timeout: 10000 });
      await sleep(1200);
      const m = await page.evaluate(() => {
        const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
        const canvas = document.querySelector('canvas');
        const c = canvas ? rect(canvas) : null;
        const visibleButtons = [...document.querySelectorAll('.ux2-command-stack button, .p5-menu-bar summary, .sandbox-project-meta')]
          .filter(e => e.offsetParent !== null && !e.closest('details:not([open]) > :not(summary)'));
        const clipped = visibleButtons.filter(e => { const r = rect(e); return r.r > innerWidth + 1 || r.l < -1 || r.b > innerHeight + 1; }).map(e => (e.textContent || '').trim().slice(0, 30));
        const ribbon = document.querySelector('.p7-3d-authoring');
        const rr = ribbon ? rect(ribbon) : null;
        const gizmo = document.querySelector('.p7-3d-gizmo');
        const gr = gizmo ? rect(gizmo) : null;
        const overlap = !!(rr && gr && rr.l < gr.r && rr.r > gr.l && rr.t < gr.b && rr.b > gr.t);
        return { vh: innerHeight, canvasH: c ? c.b - c.t : 0, canvas: c, docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth,
          clipped, ribbonOutside: !!(rr && c && (rr.l < c.l - 1 || rr.r > c.r + 1 || rr.t < c.t - 1 || rr.b > c.b + 1)), overlap };
      });
      assert.ok(m.canvasH / m.vh >= share, `${w}x${h}: canvas is ${(100 * m.canvasH / m.vh).toFixed(0)}% of the viewport, expected >= ${(100 * share).toFixed(0)}%`);
      assert.ok(m.docH <= m.vh + 1 && m.docW <= w + 1, `${w}x${h}: outer document scrolls (${m.docW}x${m.docH})`);
      assert.deepEqual(m.clipped, [], `${w}x${h}: clipped controls: ${m.clipped.join(', ')}`);
      assert.equal(m.ribbonOutside, false, `${w}x${h}: 3D placement ribbon leaves the canvas`);
      assert.equal(m.overlap, false, `${w}x${h}: 3D placement ribbon overlaps the axis gizmo`);
      if (shots) await page.screenshot({ path: `${shots}/r1-${w}x${h}.png` });
      console.log(`${w}x${h}: canvas ${(100 * m.canvasH / m.vh).toFixed(0)}% of viewport, no clipped controls, no outer scroll`);
      await page.close();
    }

    // Explicit tools, shortcuts and run lock.
    const page = await open(1366, 768);
    const tool = () => page.$eval('[data-ux6-active-tool]', e => e.getAttribute('data-ux6-active-tool'));
    assert.equal(await tool(), 'select');
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('t');
    await page.waitForFunction(() => document.querySelector('[data-ux6-active-tool]')?.getAttribute('data-ux6-active-tool') === 'wire', { timeout: 4000 });
    assert.equal(await page.$eval('[data-ux6-tool="wire"]', e => e.getAttribute('aria-pressed')), 'true');
    await page.keyboard.press('i');
    await page.waitForFunction(() => document.querySelector('[data-ux6-active-tool]')?.getAttribute('data-ux6-active-tool') === 'measure', { timeout: 4000 });
    await page.keyboard.press('v');
    await page.waitForFunction(() => document.querySelector('[data-ux6-active-tool]')?.getAttribute('data-ux6-active-tool') === 'select', { timeout: 4000 });
    await place(page, ['24V supply']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 1);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '▶ Run').click());
    await page.waitForFunction(() => document.querySelector('[data-ux6-active-tool]')?.getAttribute('data-ux6-active-tool') === 'run', { timeout: 6000 });
    assert.match(await page.$eval('.ux6-tool-chip', e => e.textContent), /locked/);
    assert.equal(await page.$eval('[data-ux6-tool="wire"]', e => e.disabled), true, 'wire tool disabled while running');
    assert.match(await page.$eval('[data-ux6-tool="wire"]', e => e.title), /Pause/);
    await page.keyboard.press('t'); // must not enter wire mode while running
    await sleep(300);
    assert.equal(await tool(), 'run');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Pause').click());
    await page.waitForFunction(() => document.querySelector('[data-ux6-active-tool]')?.getAttribute('data-ux6-active-tool') === 'select', { timeout: 6000 });
    console.log('Tools: V/T/I shortcuts, pressed state, run lock and explanation');

    // Preferences: visibility and size persist, and bad stored values fall back safely.
    await page.evaluate(() => [...document.querySelectorAll('.p5-panel-toggles button')].find(b => b.textContent.trim() === 'Library').click());
    await page.evaluate(() => [...document.querySelectorAll('.p5-panel-toggles button')].find(b => b.textContent.trim() === 'Inspector').click());
    await sleep(300);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.p5-panel-toggles');
    const pressed = () => page.$$eval('.p5-panel-toggles button', bs => Object.fromEntries(bs.map(b => [b.textContent.trim(), b.getAttribute('aria-pressed')])));
    assert.deepEqual(await pressed(), { Library: 'false', Inspector: 'true', Dock: 'true' }, 'panel visibility restored after reload (dock was opened by the Measure shortcut)');
    await page.evaluate(() => localStorage.setItem('efo-ux2-layout-v1', JSON.stringify({ library: 'x', inspector: 9999, dock: null, visible: { library: 'yes', inspector: 7 } })));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.p5-panel-toggles');
    assert.deepEqual(await pressed(), { Library: 'true', Inspector: 'false', Dock: 'false' }, 'corrupt preferences fall back to defaults');
    await page.evaluate(() => localStorage.setItem('efo-ux2-layout-v1', '{not json'));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.p5-panel-toggles');
    assert.equal((await pressed()).Library, 'true');
    console.log('Preferences: persisted, corrupt values recovered');
    // Diagnostics overview (R8.1): worker-derived rails/controllers/alarms and jump links in the Measurements tab.
    await page.evaluate(() => document.querySelector('[data-p5-dock-tab="diagnostics"]').click());
    await page.waitForSelector('[data-diagnostics-overview]', { timeout: 8000 });
    assert.ok(await page.$('[data-diag-rail]'), 'power rail listed');
    assert.match(await page.$eval('[data-diag-scan]', e => e.textContent), /Scan \d+/);
    await page.evaluate(() => document.querySelector('[data-diag-jump="diag-meter"]').click());
    assert.ok(await page.$('#diag-meter'), 'jump target exists');
    console.log('Diagnostics: overview with rails, controllers, alarms and jump links');
    // Commissioning report (R8.4): the menu item produces an escaped local HTML file from the worker's own state.
    await place(page, ['24V supply', '24V pilot lamp']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 2);
    await page.evaluate(() => {
      window.__reportBlob = null;
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = blob => { if (blob.type === 'text/html') blob.text().then(t => { window.__reportBlob = t; }); return original(blob); };
      const d = [...document.querySelectorAll('.p5-menu-bar details')].find(x => x.querySelector('summary').textContent === 'Project'); d.open = true;
      document.querySelector('[data-export-report]').click();
    });
    await page.waitForFunction(() => !!window.__reportBlob, { timeout: 8000 });
    const report = await page.evaluate(() => window.__reportBlob);
    assert.match(report, /commissioning snapshot/); assert.match(report, /Content-Security-Policy/); assert.match(report, /lamp/);
    console.log('Report: commissioning HTML generated from the live snapshot');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('R1 workbench browser E2E PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
