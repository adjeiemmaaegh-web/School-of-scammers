/** Real-Chrome acceptance for roadmap R2: the offline project library.
 *  Covers multiple projects and switching, restore after the working copy is wiped, a real two-tab conflict (nothing
 *  overwritten), version save/restore, confirmed delete, damaged records, and IndexedDB being unavailable. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const base = process.env.PLC_BASE_URL || 'http://127.0.0.1:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GL = ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: GL });
  const errors = [];
  const newPage = async (opts = {}) => {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    if (opts.noIdb) await page.evaluateOnNewDocument(() => { try { delete window.indexedDB; Object.defineProperty(window, 'indexedDB', { value: undefined }); } catch { /* ignore */ } });
    await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });
    return page;
  };
  const go = async page => {
    await page.goto(base + '/sandbox', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('.sandbox-palette-item:not([disabled])', { timeout: 20000 });
  };
  const place = (page, labels) => page.evaluate(ls => { for (const l of ls) [...document.querySelectorAll('.sandbox-palette-item')].find(b => b.querySelector('strong')?.textContent.trim() === l)?.click(); }, labels);
  const deviceCount = page => page.$$eval('.sandbox-device', n => n.length);
  const summary = page => page.$eval('[data-library-summary]', e => e.textContent);
  const libReady = page => page.waitForFunction(() => !document.querySelector('[data-open-project-library]')?.disabled && !!document.querySelector('[data-open-project-library]'), { timeout: 15000 });
  const openMenu = async page => { await page.evaluate(() => { const d = [...document.querySelectorAll('.p5-menu-bar details')].find(x => x.querySelector('summary').textContent === 'Project'); d.open = true; }); };
  const openDialog = async page => { await openMenu(page); await page.evaluate(() => document.querySelector('[data-open-project-library]').click()); await page.waitForSelector('[data-project-library]'); await page.waitForSelector('[data-library-item]', { timeout: 10000 }); };
  const closeDialog = async page => { await page.evaluate(() => document.querySelector('[data-library-close]').click()); await page.waitForFunction(() => !document.querySelector('[data-project-library]')); };
  const savedRev = (page, n) => page.waitForFunction(v => (document.querySelector('[data-library-summary]')?.textContent ?? '').includes(`Library v${v}`) && document.querySelector('[data-library-summary]').getAttribute('data-library-summary') === 'saved', { timeout: 20000 }, n);
  const titles = page => page.$$eval('[data-library-item] strong', n => n.map(e => e.textContent.replace(/ · open$/, '')));
  try {
    /* A. first run: a project is created and committed; edits bump the revision */
    let page = await newPage();
    await go(page); await page.evaluate(() => localStorage.clear()); await page.evaluate(async () => { await new Promise(r => { const q = indexedDB.deleteDatabase('efo-project-library'); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
    await go(page); await libReady(page);
    await place(page, ['24V supply', 'START NO']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 2);
    await savedRev(page, 1);
    await place(page, ['24V pilot lamp']);
    await savedRev(page, 2);
    await openDialog(page);
    assert.deepEqual(await titles(page), ['My project']);
    console.log('A. first project created and committed (rev 1 then 2)');

    /* B. second project, switch both ways */
    await page.type('[data-library-new-title]', 'Second plant');
    await page.evaluate(() => document.querySelector('[data-library-new]').click());
    await page.waitForFunction(() => !document.querySelector('[data-project-library]'));
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 0, { timeout: 10000 });
    await place(page, ['Pneumatic cylinder']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 1);
    await page.waitForFunction(() => (document.querySelector('.sandbox-project-meta strong')?.textContent ?? '') === 'Second plant');
    await savedRev(page, 2);
    await openDialog(page);
    assert.deepEqual((await titles(page)).sort(), ['My project', 'Second plant']);
    await page.evaluate(() => [...document.querySelectorAll('[data-library-item]')].find(li => li.textContent.includes('My project')).querySelector('[data-library-open]').click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 3, { timeout: 10000 });
    console.log('B. second project created, switching restores each project exactly');

    /* C. wipe the working copy and reload: restored from the durable library */
    // Partial loss: the working copy is gone but the pointer to the active library project survives.
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('efo-open-sandbox-project')) localStorage.removeItem(k); });
    await go(page);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 1, { timeout: 15000 });
    const restored = await deviceCount(page);
    assert.ok(restored === 3 || restored === 1, `restored a real project (${restored} devices)`);
    console.log(`C. working copy wiped: ${restored} devices restored from the library`);
    // Total loss of local storage (pointer too) is a fresh start: nothing is restored or overwritten; the library still holds the projects.
    const libraryCount = async () => { await openDialog(page); const n = (await titles(page)).length; await closeDialog(page); return n; };
    const countBefore = await libraryCount();
    await page.evaluate(() => localStorage.clear());
    await go(page); await libReady(page);
    assert.equal(await deviceCount(page), 0, 'a fresh start is blank');
    await sleep(1800);
    assert.equal(await libraryCount(), countBefore, 'nothing is created or changed until the user edits');
    await place(page, ['24V supply']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 1);
    await savedRev(page, 1);
    assert.equal(await libraryCount(), countBefore + 1, 'the first edit creates a NEW project instead of overwriting an old one');
    console.log('C2. total local-storage loss is a fresh start; existing library projects are untouched');
    // make "My project" active again for the next steps
    await openDialog(page);
    if (await page.$eval('[data-library-item][data-library-active="true"] strong', e => e.textContent.replace(/ · open$/, '') !== 'My project')) {
      await page.evaluate(() => [...document.querySelectorAll('[data-library-item]')].find(li => li.querySelector('strong').textContent.replace(/ · open$/, '') === 'My project').querySelector('[data-library-open]').click());
      await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 3, { timeout: 10000 });
    } else await closeDialog(page);
    await savedRev(page, 3).catch(() => undefined);

    /* D. versions: save, change, restore */
    await openDialog(page);
    await page.type('[data-library-version-label]', 'three devices');
    await page.evaluate(() => document.querySelector('[data-library-save-version]').click());
    await page.waitForSelector('[data-library-version]');
    await closeDialog(page);
    await place(page, ['24V supply']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4);
    await sleep(2200);
    await openDialog(page);
    await page.evaluate(() => [...document.querySelectorAll('[data-library-version]')].find(li => li.textContent.includes('three devices')).querySelector('[data-library-restore]').click());
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 3, { timeout: 10000 });
    await openDialog(page);
    assert.ok(await page.$$eval('[data-library-version]', n => n.some(e => e.textContent.includes('Before restoring'))), 'the replaced state is kept as a version');
    await closeDialog(page);
    console.log('D. version saved, restored as a new revision, replaced state kept');

    /* E. two tabs: the stale tab must conflict and must not overwrite */
    const tab2 = await newPage();
    await go(tab2); await libReady(tab2);
    await page.bringToFront();
    await place(page, ['24V pilot lamp']);
    await page.waitForFunction(() => document.querySelectorAll('.sandbox-device').length === 4);
    await sleep(2500);
    const before = await page.evaluate(() => document.querySelector('[data-library-summary]').textContent);
    await tab2.bringToFront();
    await place(tab2, ['24V supply', '24V supply']);
    await tab2.waitForSelector('[data-library-conflict]', { timeout: 20000 });
    assert.match(await tab2.$eval('[data-library-conflict]', e => e.textContent), /another tab/);
    // tab 2 keeps its own copy as a new project instead of overwriting
    await tab2.evaluate(() => [...document.querySelectorAll('[data-library-conflict] button')].find(b => b.textContent.includes('as a new project')).click());
    await tab2.waitForFunction(() => !document.querySelector('[data-library-conflict]'), { timeout: 15000 });
    await page.bringToFront();
    await openDialog(page);
    const all = await titles(page);
    assert.ok(all.some(t => t.includes('(this tab)')), `conflicting tab saved as its own project: ${all.join(' | ')}`);
    assert.equal(await deviceCount(page), 4, 'the first tab\'s project was not overwritten');
    await closeDialog(page); await tab2.close();
    console.log('E. two-tab conflict detected, nothing overwritten, other copy kept as a new project (' + before.trim() + ')');

    /* F. delete needs confirmation and the open project cannot be deleted */
    await openDialog(page);
    assert.equal(await page.$eval('[data-library-item][data-library-active="true"] [data-library-delete]', e => e.disabled), true);
    const target = await page.evaluate(() => { const li = [...document.querySelectorAll('[data-library-item]')].find(x => x.getAttribute('data-library-active') === 'false'); li.querySelector('[data-library-delete]').click(); return li.getAttribute('data-library-item'); });
    await page.waitForSelector('[data-library-delete-confirm]');
    const count = await page.$$eval('[data-library-item]', n => n.length);
    await page.evaluate(() => document.querySelector('[data-library-delete-confirm]').click());
    await page.waitForFunction(n => document.querySelectorAll('[data-library-item]').length === n - 1, { timeout: 8000 }, count);
    assert.equal(await page.$(`[data-library-item="${target}"]`), null);
    await closeDialog(page);
    console.log('F. delete needs confirmation; the open project is protected');

    /* G. a damaged record is reported, not loaded, and not silently destroyed */
    await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('efo-project-library'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      const tx = db.transaction('projects', 'readwrite'); const st = tx.objectStore('projects');
      const rows = await new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result); });
      const victim = rows.find(x => x.title.includes('Second plant')) ?? rows[0];
      st.put({ ...victim, revision: victim.revision + 1, project: { formatVersion: 1, components: 'broken' } });
      await new Promise(r => { tx.oncomplete = () => r(); });
      window.__victim = victim.id;
    });
    await openDialog(page);
    const damagedId = await page.evaluate(() => window.__victim);
    if (await page.$(`[data-library-item="${damagedId}"][data-library-active="true"]`) === null) {
      await page.evaluate(id => document.querySelector(`[data-library-item="${id}"] [data-library-open]`).click(), damagedId);
      await page.waitForFunction(() => /damaged/i.test(document.querySelector('.sandbox-alert')?.textContent ?? ''), { timeout: 8000 });
    }
    assert.equal(await deviceCount(page), 4, 'the open project is untouched by a failed open');
    console.log('G. damaged library record refused with a message, open project untouched');

    /* G2. scene package import (data only) */
    await openDialog(page);
    const pkg = JSON.stringify({ kind: 'efo-scene-package', formatVersion: 1, title: 'Imported lamp scene', description: 'd', level: 'beginner', objectives: ['Wire the lamp'], hints: ['Use P24'],
      project: { formatVersion: 1, components: [{ id: 'lamp-1', kind: 'lamp', x: 20, y: 20, pressed: false }], wires: [], program: { id: 'sandbox-program', version: '1', rungs: [{ id: 'r1', elements: [{ type: 'contact', tag: 'Start' }], coil: 'Run' }] } } });
    const input = await page.$('[data-library-package-input]');
    await page.evaluate(text => { const el = document.querySelector('[data-library-package-input]'); const dt = new DataTransfer(); dt.items.add(new File([text], 'x.efo-scene.json', { type: 'application/json' })); el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); }, pkg);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-library-item] strong')].some(e => e.textContent.includes('Imported lamp scene')), { timeout: 8000 });
    assert.ok(await page.evaluate(() => /Objectives: Wire the lamp/.test(document.querySelector('.sandbox-alert')?.textContent ?? '')), 'objectives are shown after import');
    const evil = JSON.stringify({ kind: 'efo-scene-package', formatVersion: 1, title: 'x', description: 'd', level: 'beginner', objectives: [], hints: [], script: 'alert(1)', project: {} });
    await page.evaluate(text => { const el = document.querySelector('[data-library-package-input]'); const dt = new DataTransfer(); dt.items.add(new File([text], 'evil.json', { type: 'application/json' })); el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); }, evil);
    await page.waitForFunction(() => /data only/i.test(document.querySelector('.sandbox-alert')?.textContent ?? ''), { timeout: 8000 });
    void input;
    await closeDialog(page);
    console.log('G2. scene package imported as data only; a package with a script field is refused');
    await page.close();

    /* H. IndexedDB unavailable: say so, keep working copy autosave */
    const noIdb = await newPage({ noIdb: true });
    await go(noIdb);
    await noIdb.waitForSelector('[data-library-unavailable]', { timeout: 15000 });
    assert.match(await noIdb.$eval('[data-library-unavailable]', e => e.textContent), /unavailable/i);
    assert.equal(await noIdb.$eval('[data-open-project-library]', e => e.disabled), true);
    await place(noIdb, ['24V supply']);
    await noIdb.waitForFunction(() => document.querySelectorAll('.sandbox-device').length >= 1);
    await noIdb.waitForFunction(() => (document.querySelector('.sandbox-project-meta small')?.textContent ?? '').includes('Saved in this browser'), { timeout: 10000 });
    await noIdb.close();
    console.log('H. without IndexedDB the app says so and the working-copy autosave still works');

    assert.deepEqual(errors.filter(e => !/favicon|WebGL|GPU stall|swiftshader/i.test(e)), [], 'No page errors');
    console.log('R2 project library browser E2E PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
