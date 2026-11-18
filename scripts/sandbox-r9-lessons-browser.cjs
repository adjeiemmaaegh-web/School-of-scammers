/** Real-Chrome check of the guided-lesson flow (R9): start a lesson from its unwired starter, see an honest "not yet",
 *  wire it through the UI, and pass the outcome check that runs the project through the real simulator. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewport({ width: 1440, height: 940 });
    const original = page.click.bind(page);
    page.click = async (selector, options) => { await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'center' })); return original(selector, options); };
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('[data-open-project-library]')?.disabled, { timeout: 15000 });
    await page.evaluate(() => document.querySelector('[data-p5-dock-tab="diagnostics"]').click());
    await page.waitForSelector('[data-lesson-panel]');
    assert.equal(await page.$eval('[data-lesson-select]', e => e.options.length), 3);

    // Start lesson 1: unwired starter in a new library project.
    await page.waitForFunction(() => !document.querySelector('[data-lesson-start]').disabled, { timeout: 10000 });
    await page.evaluate(() => document.querySelector('[data-lesson-start]').click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 3 && document.querySelectorAll('.sandbox-wire-list > div').length === 0, { timeout: 15000 });
    await page.evaluate(() => document.querySelector('[data-lesson-check]').click());
    await page.waitForSelector('[data-lesson-result="failed"]');
    assert.match(await page.$eval('[data-lesson-result]', e => e.textContent), /No wires have been added/);

    // Build it from the UI, then check again.
    const wire = async (a, b) => {
      await page.click(`[data-terminal-id="${a}"]`);
      await page.waitForFunction(id => document.querySelector(`[data-terminal-id="${id}"]`)?.classList.contains('selected'), {}, a);
      await page.click(`[data-terminal-id="${b}"]`);
    };
    await wire('ps.P24', 'go.A'); await wire('go.B', 'lamp.L+'); await wire('lamp.M-', 'ps.M0');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 3, { timeout: 8000 });
    await page.evaluate(() => document.querySelector('[data-lesson-check]').click());
    await page.waitForSelector('[data-lesson-result="passed"]', { timeout: 15000 });
    assert.equal(await page.$$eval('[data-lesson-check-result="pass"]', n => n.length), 3);
    console.log('Lesson 1: starter unwired, honest "not yet", UI build passes the outcome check');

    // A wrong build (lamp wired straight across the supply) is rejected with the failing expectation.
    await page.evaluate(() => [...document.querySelectorAll('.sandbox-wire-list > div button')][0].click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 2, { timeout: 8000 });
    await wire('ps.P24', 'lamp.L+');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-wire-list > div').length === 3, { timeout: 8000 });
    await page.evaluate(() => document.querySelector('[data-lesson-check]').click());
    await page.waitForSelector('[data-lesson-result="failed"]', { timeout: 15000 });
    assert.match(await page.$eval('[data-lesson-result]', e => e.textContent), /should be OFF/);
    console.log('Wrong build rejected with the failing expectation named');

    // Learn page: lessons listed with downloadable starters that exist.
    await page.goto(base + '/learn', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-learn-lessons]');
    const hrefs = await page.$$eval('[data-learn-lesson] a[download]', as => as.map(a => a.getAttribute('href')));
    assert.equal(hrefs.length, 3);
    for (const href of hrefs) {
      const body = await page.evaluate(async h => { const r = await fetch(h); return { ok: r.ok, text: await r.text() }; }, href);
      assert.ok(body.ok && JSON.parse(body.text).kind === 'efo-scene-package', `${href} downloads a scene package`);
    }
    console.log('Learn page: three lessons with downloadable starters');
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('R9 lessons browser E2E PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
