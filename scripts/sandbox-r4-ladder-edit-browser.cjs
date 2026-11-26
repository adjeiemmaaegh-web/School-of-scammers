/** R4.1 browser acceptance: duplicate, copy/paste, move, undo/redo (buttons and Ctrl+Z / Ctrl+Y) in the sandbox Ladder editor,
 *  each change accepted by the worker and visible in the saved project. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const KEY = 'efo-open-sandbox-project-v1';
const clickText = (page, label) => page.evaluate(text => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === text);
  if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;
}, label);
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 940 });
  const rungs = () => page.evaluate(k => (JSON.parse(localStorage.getItem(k) || '{}').program?.rungs ?? []).map(r => `${r.id}:${r.coil}`), KEY);
  const waitRungs = (expected, label) => page.waitForFunction((k, e) => JSON.stringify((JSON.parse(localStorage.getItem(k) || '{}').program?.rungs ?? []).map(r => `${r.id}:${r.coil}`)) === JSON.stringify(e), { timeout: 8000 }, KEY, expected)
    .catch(async () => { throw new Error(`${label}: expected ${JSON.stringify(expected)}, saved ${JSON.stringify(await rungs())}`); });
  const click = sel => page.$eval(sel, el => { el.scrollIntoView({ block: 'center' }); el.click(); });
  try {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.p5-dock-heading button', { timeout: 20000 });
    if (await page.$('.p5-dock-heading button[aria-expanded="false"]')) await click('.p5-dock-heading button[aria-expanded="false"]');
    await page.waitForSelector('.sandbox-device-list');
    assert.ok(await clickText(page, 'Place starter layout'), 'starter layout button');
    await page.waitForSelector('[data-rung-duplicate]', { timeout: 15000 });
    const start = await rungs();
    assert.ok(start.length >= 1, 'a starter program exists');
    const first = start[0].split(':')[0];
    // duplicate: the copy gets a fresh id and, because its coil is already driven, a new local tag
    await click(`[data-rung-duplicate="${first}"]`);
    await page.waitForFunction((k, n) => (JSON.parse(localStorage.getItem(k) || '{}').program?.rungs ?? []).length === n, { timeout: 8000 }, KEY, start.length + 1);
    const dup = await rungs();
    assert.equal(dup[0], start[0]); assert.match(dup[1], /^rung-\d+:Aux\d+$/);
    // undo / redo with the toolbar
    await click('[data-ladder-undo]'); await waitRungs(start, 'undo');
    await click('[data-ladder-redo]'); await waitRungs(dup, 'redo');
    // keyboard: Ctrl+Z inside the editor, then Ctrl+Y
    await page.$eval('[data-ladder-undo]', el => el.focus());
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await waitRungs(start, 'Ctrl+Z');
    // Undo just disabled itself (nothing left to undo) and lost focus; focus another editor control, as a person would click into it.
    await page.$eval('.sandbox-editor select', el => el.focus());
    await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control');
    await waitRungs(dup, 'Ctrl+Y');
    // move the copy up: scan order changes
    const copyId = dup[1].split(':')[0];
    await click(`[data-rung-up="${copyId}"]`);
    await waitRungs([dup[1], dup[0], ...dup.slice(2)], 'move up');
    // copy then paste at the end
    await click(`[data-rung-copy="${first}"]`);
    await page.waitForSelector('[data-ladder-paste]:not([disabled])', { timeout: 5000 });
    await click('[data-ladder-paste]');
    await page.waitForFunction((k, n) => (JSON.parse(localStorage.getItem(k) || '{}').program?.rungs ?? []).length === n, { timeout: 8000 }, KEY, dup.length + 1);
    const pasted = await rungs();
    assert.match(pasted[pasted.length - 1], /^rung-\d+:Aux\d+$/, 'the pasted rung is appended with its own output');
    assert.equal(new Set(pasted.map(r => r.split(':')[0])).size, pasted.length, 'rung ids stay unique');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('R4.1 LADDER EDIT BROWSER PASS: duplicate, undo/redo (buttons and keys), move, copy/paste, all saved through the worker');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
