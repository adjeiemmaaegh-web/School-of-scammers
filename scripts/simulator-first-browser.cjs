/** Real-Chrome check of the product structure: the simulator is the primary experience; Learn & Practice and
 *  Assessments are separate, secondary sections; a student can enter the simulator freely, with no exercise
 *  or assessment forced on them. Also checks the primary navigation is on every page and works on a phone.
 */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const text = sel => page.$eval(sel, e => e.textContent.trim());
  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    // 1. Home leads with the simulator, not with hiring or assessment.
    await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 20000 });
    const h1 = await text('h1');
    assert.match(h1, /virtual factory/i, `Headline should be about building a virtual factory: ${h1}`);
    const body = await page.evaluate(() => document.body.innerText);
    for (const bad of [/prove you can/i, /stop guessing who can do the work/i, /i'm hiring/i, /hiring tests the wrong thing/i])
      assert.ok(!bad.test(body), `Home must not lead with hiring/assessment copy: ${bad}`);
    assert.match(await text('[data-cta="simulator"]'), /Open the simulator/);
    const firstCta = await page.$eval('.cta-row a', a => a.getAttribute('href'));
    assert.equal(firstCta, '/sandbox', 'The first call to action is the simulator');
    // Assessments appear once, as a clearly secondary section placed after Simulator and Learn.
    const order = await page.$$eval('main section', s => s.map(x => x.id || 'hero'));
    assert.deepEqual(order, ['hero', 'simulator', 'learn', 'assessments']);
    assert.ok(/Where it is today/.test(body) && /not safety-rated/i.test(body), 'Limits are stated on the home page');

    // 2. The primary navigation is on every page, in the same order, Simulator first.
    for (const route of ['/', '/sandbox', '/learn', '/assess', '/trades', '/trade/plc', '/employer', '/take', '/labs']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('.primary-nav');
      const links = await page.$$eval('.primary-nav a', a => a.map(x => [x.textContent.trim(), x.getAttribute('href')]));
      assert.deepEqual(links, [['Simulator', '/sandbox'], ['Learn & Practice', '/learn'], ['Assessments', '/assess']], `primary nav on ${route}`);
    }

    // 3. Entering the simulator is free: an empty floor, no exercise, no assessment, no work order.
    await page.goto(base + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.click('[data-cta="simulator"]');
    await page.waitForSelector('.sandbox-toolbar', { timeout: 15000 });
    assert.equal(new URL(page.url()).pathname, '/sandbox');
    assert.equal(await page.$('[data-scenario]'), null, 'No work order is forced on the student');
    assert.equal(await page.$$eval('.sandbox-device', n => n.length), 0, 'The floor starts empty');
    assert.ok(await page.$eval('.primary-nav a.is-active', a => a.textContent.trim() === 'Simulator'));

    // 4. Learn & Practice is its own section with the scenarios and labs, and a way back to the simulator.
    await page.goto(base + '/learn', { waitUntil: 'networkidle0' });
    assert.equal(await page.$$eval('[data-learn-scenario]', n => n.length), 4);
    assert.ok((await page.$$eval('main a', a => a.map(x => x.getAttribute('href')))).includes('/sandbox'));
    assert.ok((await page.$$eval('main a', a => a.map(x => x.getAttribute('href')))).includes('/labs/pneumatics'));
    await page.click('[data-learn-scenario="plc-sbx-startstop"]');
    await page.waitForSelector('[data-scenario="plc-sbx-startstop"]', { timeout: 15000 });

    // 5. Assessments is a separate, secondary module that keeps both flows reachable and says its limits.
    await page.goto(base + '/assess', { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('[data-assess="employer"]', a => a.getAttribute('href')), '/employer');
    assert.equal(await page.$eval('[data-assess="candidate"]', a => a.getAttribute('href')), '/take');
    assert.match(await page.evaluate(() => document.body.innerText), /not tamper-proof/);
    await page.goto(base + '/employer', { waitUntil: 'networkidle0' });
    assert.ok(await page.$('select'), 'Employer assignment still works');

    // 6. Phone width: navigation wraps and nothing scrolls sideways, on the home page and the learn page.
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    for (const route of ['/', '/learn', '/assess']) {
      await page.goto(base + route, { waitUntil: 'networkidle0' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `no horizontal overflow on ${route}`);
      assert.ok(await page.$eval('.primary-nav a', a => a.getBoundingClientRect().right <= window.innerWidth));
    }
    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('Simulator-first product structure E2E PASS');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
