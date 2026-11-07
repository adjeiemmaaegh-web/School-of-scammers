/** UX-first review checks for the real 3D workbench.
 * Maintains a separate evidence trail from the deterministic PLC integration suite.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-workflow');
    assert.equal(await page.$eval('.sandbox-workflow', el => el.querySelectorAll('button').length), 4,
      'Real Build, Wire, Program, Test navigation exists');

    const search = await page.$('input[aria-label="Search component library"]');
    assert.ok(search, 'Component search is keyboard accessible');
    await search.type('motor');
    await page.waitForFunction(() => [...document.querySelectorAll('.sandbox-palette-item')]
      .some(el => el.textContent.includes('Reversible 24V motor')));
    const motorResults=await page.$$eval('.sandbox-palette-item', els=>els.map(el=>el.textContent));
    assert.ok(motorResults.some(text=>text.includes('24V motor')),'Legacy motor still searchable');
    assert.ok(motorResults.some(text=>text.includes('Reversible 24V motor')),'New reversing motor searchable');
    await search.focus();
    await search.evaluate(el => el.select());
    await page.keyboard.press('Backspace');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-palette-item').length >= 13);

    const placed = await page.evaluate(() => {
      const button = [...document.querySelectorAll('.sandbox-toolbar button')].find(
        el => el.textContent?.trim() === 'Place starter layout');
      button?.click();
      return !!button;
    });
    assert.ok(placed, 'Starter layout is accessible from project toolbar');
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 6);

    await page.click('[data-device-id="motor-4"] .sandbox-inspect-link');
    await page.waitForFunction(() => document.querySelector('.sandbox-inspector h2')?.textContent?.includes('24V motor'));
    assert.match(await page.$eval('.sandbox-inspector', el => el.textContent), /Device ID/);
    await page.click('[data-inspector-terminal-id="motor-4.L+"]');
    await page.waitForFunction(() => document.querySelector('[data-terminal-id="motor-4.L+"]')?.classList.contains('selected'),
      { timeout: 4000 });
    await page.click('.sandbox-inspector .sandbox-pending-wire button');
    await page.waitForFunction(() => !document.querySelector('[data-terminal-id="motor-4.L+"]')?.classList.contains('selected'));

    const chooseStage = async (stage) => {
      const didClick = await page.evaluate(label => {
        const button = [...document.querySelectorAll('.sandbox-workflow button')].find(b =>
          b.querySelector('strong')?.textContent?.trim() === label);
        button?.click();
        return !!button;
      }, stage);
      assert.ok(didClick, `Navigation shortcut ${stage} exists`);
      await page.waitForFunction(label =>
        [...document.querySelectorAll('.sandbox-workflow button')].some(b =>
          b.getAttribute('aria-pressed') === 'true' && b.querySelector('strong')?.textContent?.trim() === label),
      { timeout: 4000 }, stage);
    };
    await chooseStage('Program');
    assert.ok(await page.$('#sandbox-stage-program .sandbox-editor'), 'Program shortcut leads to editable Ladder section');
    await chooseStage('Wire');
    assert.ok(await page.$('#sandbox-stage-wire [data-terminal-id="plc-2.I0.0"]'),
      'Wire shortcut leads to actual patch terminals');
    await chooseStage('Test');
    assert.ok(await page.$('#sandbox-stage-test .sandbox-wire-list'), 'Test shortcut leads to live instrumentation');
    await chooseStage('Build');

    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('efo-open-sandbox-project-v1') || 'null'));
    assert.equal(persisted?.components?.length, 6, 'Design changes must retain real local project persistence');
    fs.mkdirSync('qa-artifacts', { recursive: true });
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: 'qa-artifacts/sandbox-ux-desktop.png', fullPage: true });

    await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1 });
    await page.waitForFunction(() => document.querySelector('.sandbox-ux')?.getBoundingClientRect().width <= 392);
    const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(size.page <= size.viewport + 2,
      `Mobile UX overflow: document ${size.page}px; viewport ${size.viewport}px`);
    assert.ok(await page.$('.sandbox-inspector'), 'Inspector remains available on mobile');
    await page.screenshot({ path: 'qa-artifacts/sandbox-ux-mobile.png', fullPage: true });

    assert.deepEqual(errors, [], 'No uncaught UI browser errors');
    console.log('SANDBOX UX PASS: search, stage shortcuts, inspector, terminal selection, local persistence and 390px mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error('SANDBOX UX ACCEPTANCE FAIL', error.stack || String(error)); process.exitCode = 1; });
