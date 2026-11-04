// Usage: node bench/array/run.mjs [--ember 6.12.0] [--rounds 10] [--chrome <path>]
import { spawn, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    ember: { type: 'string', default: '6.12.0' },
    rounds: { type: 'string', default: '10' },
    chrome: {
      type: 'string',
      default: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
  },
});
const ROUNDS = Number(values.rounds);
const SCROLL_STEPS = 300;
const STEP_PIXELS = 200;
const ROW_CHANGES = 20000;
const MICRO_ROUNDS = 15;

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../..');
const work = mkdtempSync(join(tmpdir(), 'vc-array-bench-'));
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });

const MAIN = '24ee6d8';
const GLIMMER = '7377e7a';
const useBuiltIn = (dir) => {
  const file = join(dir, 'vertical-collection/src/-private/data-view/radar/radar.js');
  writeFileSync(
    file,
    readFileSync(file, 'utf8')
      .replace("import { TrackedArray } from 'tracked-built-ins';", "import { trackedArray } from '@ember/reactive/collections';")
      .replace('new TrackedArray(', 'trackedArray('),
  );
};
const BUILDS = [
  { name: 'main, A()', ref: MAIN },
  { name: '#573, TrackedArray', ref: GLIMMER },
  { name: '#573, trackedArray built-in', ref: GLIMMER, patch: useBuiltIn },
];

function build({ name, ref, patch }, mode) {
  const dir = join(work, `${name.replace(/\W+/g, '-')}-${mode}`);
  sh(`git worktree add -q --detach "${dir}" ${ref}`, repo);
  patch?.(dir);
  cpSync(join(here, 'app'), join(dir, 'test-app/app'), { recursive: true });
  const router = join(dir, 'test-app/app/router.ts');
  writeFileSync(router, readFileSync(router, 'utf8').replace("this.route('settings');", "this.route('settings');\n  this.route('array-benchmark');"));
  sh('pnpm install --no-frozen-lockfile', dir);
  sh(`pnpm add -D tracked-built-ins@4.1.2 ember-source@${values.ember}`, join(dir, 'test-app'));
  sh('pnpm build', join(dir, 'vertical-collection'));
  sh('pnpm install --no-frozen-lockfile', dir);
  sh(`pnpm exec vite build --mode ${mode}`, join(dir, 'test-app'));
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
  const { targetId } = await send('Target.createTarget', { url });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 500));
    return result.value;
  };
  await call('Performance.enable');
  for (let i = 0; i < 200 && !(await evaluate('Boolean(window.__bench)')); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await evaluate('window.__bench.ready()');
  const metrics = async () =>
    Object.fromEntries((await call('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  return { evaluate, metrics, close: () => send('Target.closeTarget', { targetId }) };
}

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const quantile = (list, q) => list.slice().sort((a, b) => a - b)[Math.floor((list.length - 1) * q)];
const stats = (list) => ({ p25: quantile(list, 0.25), median: quantile(list, 0.5), p75: quantile(list, 0.75) });

const builds = [];
const trees = [];
for (const b of BUILDS) {
  console.log(`build: ${b.name}`);
  const { dir, dist } = build(b, 'production');
  trees.push(dir);
  builds.push({ ...b, ...(await serve(dist)) });
}
console.log('build: development, for the array test');
const devTree = build(BUILDS[1], 'development');
trees.push(devTree.dir);
const dev = await serve(devTree.dist);

const browser = await startChrome();

async function micro(port) {
  const page = await openPage(browser, `http://localhost:${port}/#/array-benchmark`);
  const names = await page.evaluate('window.__bench.implementations');
  const raw = Object.fromEntries(names.map((n) => [n, []]));
  for (const n of names) await page.evaluate(`window.__bench.rowChange(${JSON.stringify(n)}, ${ROW_CHANGES})`);
  for (let r = 0; r < MICRO_ROUNDS; r++) {
    for (const n of shuffle(names)) {
      raw[n].push(await page.evaluate(`window.__bench.rowChange(${JSON.stringify(n)}, ${ROW_CHANGES})`));
    }
  }
  await page.close();
  return raw;
}
console.log('array test');
const rowChange = { production: await micro(builds[1].port), development: await micro(dev.port) };

const scroll = [];
for (let round = 0; round < ROUNDS; round++) {
  for (const recycle of shuffle([true, false])) {
    for (const b of shuffle(builds)) {
      const page = await openPage(browser, `http://localhost:${b.port}/?recycle=${recycle}#/array-benchmark`);
      const before = await page.metrics();
      const { newBlocks, scrollTop } = await page.evaluate(`window.__bench.scroll(${SCROLL_STEPS}, ${STEP_PIXELS})`);
      const after = await page.metrics();
      await page.close();
      const run = {
        round, build: b.name, recycle, newBlocks, scrollTop,
        scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
        taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
      };
      scroll.push(run);
      console.log(JSON.stringify(run));
    }
  }
}
browser.ws.close();
browser.chrome.kill();
for (const { server } of [...builds, dev]) server.close();
for (const dir of trees) sh(`git worktree remove --force "${dir}"`, repo);

const summary = {
  rowChangeMicroseconds: Object.fromEntries(Object.entries(rowChange).map(([mode, raw]) => [mode, Object.fromEntries(Object.entries(raw).map(([n, l]) => [n, stats(l)]))])),
  scroll: BUILDS.flatMap(({ name }) => [true, false].map((recycle) => {
    const runs = scroll.filter((r) => r.build === name && r.recycle === recycle);
    return { build: name, recycle, newBlocks: stats(runs.map((r) => r.newBlocks)), scriptMs: stats(runs.map((r) => r.scriptMs)), taskMs: stats(runs.map((r) => r.taskMs)) };
  })),
};
const out = join(here, 'results');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, `ember-${values.ember}.json`),
  JSON.stringify({ ember: values.ember, rounds: ROUNDS, scrollSteps: SCROLL_STEPS, stepPixels: STEP_PIXELS, rowChanges: ROW_CHANGES, microRounds: MICRO_ROUNDS, main: MAIN, glimmer: GLIMMER, chrome: await chromeVersion(), summary, rowChange, scroll }, null, 2) + '\n',
);
console.log(JSON.stringify(summary, null, 2));

async function chromeVersion() {
  return execSync(`"${values.chrome}" --version`).toString().trim();
}
