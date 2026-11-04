// Usage: node bench/versions/run.mjs [--ember 7.4.0] [--rounds 12] [--chrome <path>]
import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    ember: { type: 'string', default: '7.4.0' },
    rounds: { type: 'string', default: '12' },
    chrome: { type: 'string', default: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  },
});
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const work = mkdtempSync(join(tmpdir(), 'vc-versions-'));
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
const edit = (file, change) => writeFileSync(file, change(readFileSync(file, 'utf8')));
const swap = (text, from, to) => {
  if (!text.includes(from)) throw new Error(`Missing: ${from}`);
  return text.replace(from, to);
};

const V5 = '24ee6d8';
const V6 = 'c7ed3f7';

// v6 with the built-in array and tracked(), without tracked-built-ins and decorator-transforms.
const useBuiltInArray = (dir) => {
  const addon = join(dir, 'vertical-collection');
  edit(join(addon, 'src/-private/data-view/radar/radar.ts'), (t) =>
    swap(swap(t, "import { TrackedArray } from 'tracked-built-ins';", "import { trackedArray } from '@ember/reactive/collections';"), 'new TrackedArray(', 'trackedArray('),
  );
};
const useTrackedFunction = (dir) => {
  const addon = join(dir, 'vertical-collection');
  edit(join(addon, 'src/-private/data-view/elements/virtual-component.ts'), (t) =>
    swap(t, '  @tracked content: T;\n  @tracked index: number;\n', `  #content = tracked<T>(undefined as T);
  #index = tracked<number>(0);

  get content(): T {
    return this.#content.value;
  }

  set content(value: T) {
    this.#content.value = value;
  }

  get index(): number {
    return this.#index.value;
  }

  set index(value: number) {
    this.#index.value = value;
  }

`),
  );
};
const toV7 = (dir) => {
  const addon = join(dir, 'vertical-collection');
  useBuiltInArray(dir);
  useTrackedFunction(dir);
  edit(join(addon, 'babel.config.mjs'), (t) =>
    t.replace(/\s*\[\s*'module:decorator-transforms',[\s\S]*?\n\s*\],/, ''),
  );
  edit(join(addon, 'package.json'), (t) => {
    const pkg = JSON.parse(t);
    delete pkg.dependencies['tracked-built-ins'];
    delete pkg.dependencies['decorator-transforms'];
    return JSON.stringify(pkg, null, 2) + '\n';
  });
};

// Ember's trackedArray without its per-index tags. A new file, so the pnpm store is not changed.
const withoutIndexTags = (dir) => {
  const ember = realpathSync(join(dir, 'test-app/node_modules/ember-source'));
  for (const mode of ['dev', 'prod']) {
    const file = join(ember, `dist/${mode}/packages/@ember/reactive/collections.js`);
    let text = readFileSync(file, 'utf8');
    text = swap(text, 'self.#readStorageFor(index);\n', '\n');
    text = swap(text, 'self.#dirtyStorageFor(index);\n', '\n');
    rmSync(file);
    writeFileSync(file, text);
  }
};

const BUILDS = [
  { name: 'v5 (main)', ref: V5 },
  { name: 'v6 (#574)', ref: V6 },
  { name: 'v7', ref: V6, patch: toV7 },
  { name: 'v7, Ember without index tags', ref: V6, patch: toV7, patchEmber: withoutIndexTags },
];

const LEAN = process.env.BENCH_LEAN;
const withoutDependencies = (dir) => sh(`git apply "${join(here, 'v6-without-dependencies.patch')}"`, dir);
const LEAN_BUILDS = [
  BUILDS[0],
  BUILDS[1],
  { name: 'v6, without dependencies', ref: V6, patch: withoutDependencies },
  BUILDS[2],
];
const CAUSE = process.env.BENCH_CAUSE;
const CAUSE_BUILDS = [
  BUILDS[0],
  BUILDS[1],
  { name: 'v6 + built-in array', ref: V6, patch: useBuiltInArray },
  { name: 'v6 + tracked()', ref: V6, patch: useTrackedFunction },
  BUILDS[2],
];

function build({ name, ref, patch, patchEmber }) {
  const dir = join(work, name.replace(/\W+/g, '-'));
  sh(`git worktree add -q --detach "${dir}" ${ref}`, repo);
  patch?.(dir);
  cpSync(join(here, 'app'), join(dir, 'test-app/app'), { recursive: true });
  edit(join(dir, 'test-app/app/router.ts'), (t) => swap(t, "this.route('settings');", "this.route('settings');\n  this.route('version-benchmark');"));
  sh('pnpm install --no-frozen-lockfile', dir);
  sh(`pnpm add -D ember-source@${values.ember}`, join(dir, 'test-app'));
  if (patch) sh(`pnpm add -D ember-source@${values.ember}`, join(dir, 'vertical-collection'));
  sh('pnpm build', join(dir, 'vertical-collection'));
  sh('pnpm install --no-frozen-lockfile', dir);
  patchEmber?.(dir);
  sh(`pnpm exec vite build --mode production${CAUSE ? ' --minify false' : ''}`, join(dir, 'test-app'));
  return { dir, dist: join(dir, 'test-app/dist') };
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const serve = (dist) =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = new URL(req.url, 'http://x').pathname;
      const file = join(dist, path === '/' ? 'index.html' : path);
      if (!existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });

async function startChrome() {
  const chrome = spawn(values.chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${join(work, 'chrome')}`,
    '--window-size=1440,900', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', 'about:blank',
  ]);
  const url = await new Promise((resolve) => {
    let err = '';
    chrome.stderr.on('data', (d) => {
      err += d;
      const m = err.match(/ws:\/\/\S+/);
      if (m) resolve(m[0]);
    });
  });
  const ws = new WebSocket(url);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { chrome, ws, send };
}

async function openPage({ send }, url) {
  // Metrics start before navigation, so a mount is measured from its first task.
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 500));
    return result.value;
  };
  await call('Performance.enable');
  await call('Page.navigate', { url });
  for (let i = 0; i < 2400; i++) {
    const loaded = await evaluate('Boolean(window.__bench)').catch(() => false);
    if (loaded) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await evaluate('window.__bench.ready()');
  const metrics = async () => Object.fromEntries((await call('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  return { evaluate, metrics, close: () => send('Target.closeTarget', { targetId }) };
}

// A load scenario measures from navigation; the others measure one action on a loaded page.
const SCENARIOS = [
  { name: 'Scroll, recycling on', query: 'recycle=true&rows=10000', action: 'scroll' },
  { name: 'Scroll, recycling off', query: 'recycle=false&rows=10000', action: 'scroll' },
  { name: 'Infinite scroll: append 20 rows at the end, 40 times', query: 'rows=2000', action: 'append' },
  { name: 'Prepend 20 rows, 40 times', query: 'rows=2000', action: 'prepend' },
  { name: 'Filter and sort, 30 times', query: 'rows=2000', action: 'replace' },
  { name: 'Mount, 10 000 rows', query: 'rows=10000' },
  { name: 'Mount with @renderAll, 5 000 rows', query: 'rows=5000&renderAll=true' },
];

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const builds = [];
const trees = [];
for (const b of LEAN ? LEAN_BUILDS : CAUSE || process.env.BENCH_MOUNT ? CAUSE_BUILDS : process.env.BENCH_ROW_CHANGE ? BUILDS.slice(2) : BUILDS) {
  console.log(`build: ${b.name}`);
  const { dir, dist } = build(b);
  trees.push(dir);
  builds.push({ ...b, ...(await serve(dist)) });
}

const browser = await startChrome();
if (process.env.BENCH_ROW_CHANGE) {
  const rowChange = {};
  for (const size of [20, 2000]) {
    const steps = size === 20 ? 20000 : 500;
    for (let round = 0; round < 15; round++) {
      for (const b of shuffle(builds)) {
        const page = await openPage(browser, `http://localhost:${b.port}/?rows=100#/version-benchmark`);
        const value = await page.evaluate(`window.__bench.rowChange(${size}, ${steps})`);
        await page.close();
        ((rowChange[size] ??= {})[b.name] ??= []).push(value);
      }
    }
  }
  writeFileSync(join(here, 'results', `row-change-ember-${values.ember}.json`), JSON.stringify(rowChange, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(rowChange).map(([size, byBuild]) => [size, Object.fromEntries(Object.entries(byBuild).map(([n, l]) => [n, l.slice().sort((x, y) => x - y)[7]]))]))));
  browser.ws.close();
  browser.chrome.kill();
  for (const { server } of builds) server.close();
  for (const dir of trees) sh(`git worktree remove --force "${dir}"`, repo);
  process.exit(0);
}
if (CAUSE) {
  const query = 'rows=5000&renderAll=true';
  const cause = [];
  for (let round = 0; round < 15; round++) {
    for (const b of shuffle(builds)) {
      const started = performance.now();
      const page = await openPage(browser, `http://localhost:${b.port}/?${query}#/version-benchmark`);
      const wallMs = performance.now() - started;
      const m = await page.metrics();
      const rows = await page.evaluate("document.querySelectorAll('.bench-row').length");
      await page.close();
      cause.push({ round, build: b.name, rows, wallMs, scriptMs: m.ScriptDuration * 1000, taskMs: m.TaskDuration * 1000 });
      console.log(JSON.stringify(cause.at(-1)));
    }
  }
  const profiles = {};
  for (const b of builds) {
    const { send } = browser;
    const totals = [];
    const functions = {};
    for (let i = 0; i < 5; i++) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const call = (method, params) => send(method, params, sessionId);
      await call('Page.enable');
      await call('Runtime.enable');
      await call('Profiler.enable');
      await call('Profiler.setSamplingInterval', { interval: 200 });
      await call('Profiler.start');
      await call('Page.navigate', { url: `http://localhost:${b.port}/?${query}#/version-benchmark` });
      const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
      for (let t = 0; t < 2400 && !(await evaluate('Boolean(window.__bench)')); t++) await new Promise((resolve) => setTimeout(resolve, 50));
      await evaluate('window.__bench.ready()');
      const { profile } = await call('Profiler.stop');
      await send('Target.closeTarget', { targetId });
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const self = {};
      let js = 0;
      profile.samples.forEach((id, index) => {
        const { functionName, url, lineNumber } = byId.get(id).callFrame;
        const us = profile.timeDeltas[index];
        if (functionName === '(idle)' || functionName === '(program)' || functionName === '(root)') return;
        js += us;
        const key = `${functionName || '(anonymous)'} ${url.split('/').pop()}:${lineNumber}`;
        self[key] = (self[key] ?? 0) + us;
      });
      totals.push(js / 1000);
      for (const [key, us] of Object.entries(self)) (functions[key] ??= []).push(us / 1000);
    }
    profiles[b.name] = {
      jsMs: totals,
      top: Object.entries(functions).map(([key, list]) => [key, list.reduce((x, y) => x + y, 0) / 5]).sort((x, y) => y[1] - x[1]).slice(0, 18),
    };
  }
  writeFileSync(join(here, 'results', `render-all-cause-ember-${values.ember}.json`), JSON.stringify({ ember: values.ember, cause, profiles }, null, 2) + '\n');
  browser.ws.close();
  browser.chrome.kill();
  for (const { server } of builds) server.close();
  for (const dir of trees) sh(`git worktree remove --force "${dir}"`, repo);
  process.exit(0);
}
if (process.env.BENCH_MOUNT) {
  const mount = [];
  for (let round = 0; round < 15; round++) {
    for (const scenario of shuffle(SCENARIOS.filter((s) => !s.action))) {
      for (const b of shuffle(builds)) {
        const page = await openPage(browser, `http://localhost:${b.port}/?${scenario.query}#/version-benchmark`);
        const m = await page.metrics();
        const rows = await page.evaluate("document.querySelectorAll('.bench-row').length");
        await page.close();
        const run = { round, scenario: scenario.name, build: b.name, rows, scriptMs: m.ScriptDuration * 1000, taskMs: m.TaskDuration * 1000 };
        mount.push(run);
        console.log(JSON.stringify(run));
      }
    }
  }
  writeFileSync(join(here, 'results', `mount-ember-${values.ember}.json`), JSON.stringify({ ember: values.ember, chrome: execSync(`"${values.chrome}" --version`).toString().trim(), runs: mount }, null, 2) + '\n');
  browser.ws.close();
  browser.chrome.kill();
  for (const { server } of builds) server.close();
  for (const dir of trees) sh(`git worktree remove --force "${dir}"`, repo);
  process.exit(0);
}
const runs = [];
for (let round = 0; round < Number(values.rounds); round++) {
  for (const scenario of shuffle(SCENARIOS)) {
    for (const b of shuffle(builds)) {
      const page = await openPage(browser, `http://localhost:${b.port}/?${scenario.query}#/version-benchmark`);
      const before = scenario.action ? await page.metrics() : { ScriptDuration: 0, TaskDuration: 0 };
      const result = scenario.action ? await page.evaluate(`window.__bench.${scenario.action}()`) : { longFrames: null };
      const after = await page.metrics();
      const rows = await page.evaluate("document.querySelectorAll('.bench-row').length");
      await page.close();
      const run = {
        round, scenario: scenario.name, build: b.name, rows, longFrames: result.longFrames,
        scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
        taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
      };
      runs.push(run);
      console.log(JSON.stringify(run));
    }
  }
}
browser.ws.close();
browser.chrome.kill();
for (const { server } of builds) server.close();
for (const dir of trees) sh(`git worktree remove --force "${dir}"`, repo);
const out = join(here, 'results');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, `${LEAN ? 'without-dependencies-' : ''}ember-${values.ember}.json`),
  JSON.stringify({ ember: values.ember, rounds: Number(values.rounds), v5: V5, v6: V6, chrome: execSync(`"${values.chrome}" --version`).toString().trim(), runs }, null, 2) + '\n',
);
