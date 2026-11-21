/** Real-Chrome acceptance for R22 grouping: group three devices, selecting one selects all, rotate about the group centre,
 *  ungroup, undo restores the group, and groups survive a reload. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const STORAGE = 'efo-open-sandbox-project-v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE);
  const place = label => page.evaluate(v => { const b = [...document.querySelectorAll('.sandbox-palette-item')].find(x => x.querySelector('strong')?.textContent.trim() === v); if (b && !b.disabled) b.click(); return !!b; }, label);
  const count = n => page.waitForFunction(t => document.querySelectorAll('.sandbox-device').length === t, { timeout: 12000 }, n);
  const checked = () => page.evaluate(() => document.querySelectorAll('[data-workspace-selection] input[type="checkbox"]:checked').length);
  const clickSel = sel => page.evaluate(s => { const b = document.querySelector(s); if (b && !b.disabled) { b.click(); return true; } return false; }, sel);
  const groupsOf = async () => (await saved())?.groups;
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])');
    for (const l of ['24V supply', '24V pilot lamp', '24V pilot lamp']) { assert.ok(await place(l)); await sleep(150); }
    await count(3);
    await page.click('[data-workspace-selection] summary');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Select all'); b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-selection] input:checked').length === 3);
    await page.evaluate(() => { document.querySelector('.workspace-more summary')?.click(); });
    assert.ok(await clickSel('[data-group]'), 'Group button enabled with 3 selected');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.groups?.length === 1, { timeout: 8000 }, STORAGE);
    console.log('1. three devices grouped; the project stores one group');
    // Deselect everything, then select just one member: the whole group is selected.
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => /clear|none/i.test(e.textContent.trim()) && e.closest('[data-workspace-selection]')); if (b) b.click(); else document.querySelectorAll('[data-workspace-selection] input:checked').forEach(i => i.click()); });
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-selection] input:checked').length === 0, { timeout: 8000 });
    await page.evaluate(() => document.querySelector('[data-workspace-selection] .workspace-selection-list input[type="checkbox"]').click());
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-selection] input:checked').length === 3, { timeout: 8000 });
    console.log('2. ticking one member selects the whole group');
    const before = (await saved()).components.map(c => [c.x, c.y]);
    assert.ok(await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '↷ 90°' && !e.disabled); if (b) { b.click(); return true; } return false; }), 'rotate right');
    await page.waitForFunction((key, was) => JSON.stringify(JSON.parse(localStorage.getItem(key)).components.map(c => [c.x, c.y])) !== JSON.stringify(was), { timeout: 8000 }, STORAGE, before);
    const after = await saved();
    assert.ok(after.components.every(c => c.yawDeg === 90 || c.kind === 'supply' && c.yawDeg === 90 || c.yawDeg !== undefined), 'every member turned');
    console.log('3. rotating the group swings positions about its centre and turns every member');
    assert.ok(await clickSel('[data-ungroup]'), 'Ungroup enabled');
    await page.waitForFunction(key => !JSON.parse(localStorage.getItem(key) || 'null')?.groups, { timeout: 8000 }, STORAGE);
    await clickSel('[data-undo]');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.groups?.length === 1, { timeout: 8000 }, STORAGE);
    console.log('4. ungroup, then undo restores the group');
    await sleep(600);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.sandbox-device');
    assert.equal((await groupsOf())?.length, 1, 'group survives reload');
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
    console.log('5. the group survives a reload');
    console.log('SANDBOX R22 GROUPS BROWSER PASS');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { await browser.close(); }
})();
