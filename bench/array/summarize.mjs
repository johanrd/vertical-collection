// Usage: node bench/array/summarize.mjs. Writes results/summary.md from results/ember-*.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'results');
const median = (list) => {
  const s = list.slice().sort((a, b) => a - b);
  const m = s.length / 2;
  return Number.isInteger(m) ? (s[m - 1] + s[m]) / 2 : s[Math.floor(m)];
};
const quantile = (list, q) => list.slice().sort((a, b) => a - b)[Math.floor((list.length - 1) * q)];

// A seeded bootstrap of the median of paired differences, so the summary is reproducible.
function pairedDifference(a, b) {
  let state = 42;
  const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const differences = a.map((value, i) => value - b[i]);
  const medians = Array.from({ length: 10000 }, () =>
    median(differences.map(() => differences[Math.floor(random() * differences.length)])),
  );
  return { median: median(differences), low: quantile(medians, 0.025), high: quantile(medians, 0.975) };
}
const ms = (n) => `${Math.round(n)} ms`;
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}`;

const lines = ['# Results', ''];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  lines.push(`## Ember ${data.ember}`, '', `${data.chrome}. ${data.rounds} rounds, ${data.scrollSteps} scroll steps of ${data.stepPixels} px, 10 000 rows, static height, production builds.`, '');

  lines.push('### Scrolling', '', '| Build | Recycling | New row blocks | Script, median (p25 to p75) | All tasks, median (p25 to p75) |', '|---|---|---|---|---|');
  for (const s of data.summary.scroll) {
    lines.push(`| ${s.build} | ${s.recycle ? 'on' : 'off'} | ${s.newBlocks.median} | ${ms(s.scriptMs.median)} (${Math.round(s.scriptMs.p25)} to ${Math.round(s.scriptMs.p75)}) | ${ms(s.taskMs.median)} (${Math.round(s.taskMs.p25)} to ${Math.round(s.taskMs.p75)}) |`);
  }
  const runs = (build, recycle, key) => data.scroll.filter((r) => r.build === build && r.recycle === recycle).sort((a, b) => a.round - b.round).map((r) => r[key]);
  const builds = [...new Set(data.summary.scroll.map((s) => s.build))];
  const pairs = [[builds[1], builds[0]], [builds[2], builds[0]], [builds[2], builds[1]]];
  lines.push('', '### Paired differences by round', '', 'Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.', '', '| Comparison | Recycling | Script | All tasks |', '|---|---|---|---|');
  for (const [a, b] of pairs) {
    for (const recycle of [true, false]) {
      const cell = (key) => {
        const d = pairedDifference(runs(a, recycle, key), runs(b, recycle, key));
        return `${signed(d.median)} ms (${signed(d.low)} to ${signed(d.high)})`;
      };
      lines.push(`| ${a} minus ${b} | ${recycle ? 'on' : 'off'} | ${cell('scriptMs')} | ${cell('taskMs')} |`);
    }
  }
  for (const build of builds) {
    const cell = (key) => {
      const d = pairedDifference(runs(build, false, key), runs(build, true, key));
      return `${signed(d.median)} ms (${signed(d.low)} to ${signed(d.high)})`;
    };
    lines.push(`| ${build}: recycling off minus on | both | ${cell('scriptMs')} | ${cell('taskMs')} |`);
  }

  lines.push('', '### One row change, array only', '', `Median of ${data.microRounds} rounds of ${data.rowChanges} changes, with no rendering.`, '', '| Array | Production | Development |', '|---|---|---|');
  for (const name of Object.keys(data.summary.rowChangeMicroseconds.production)) {
    lines.push(`| ${name} | ${data.summary.rowChangeMicroseconds.production[name].median.toFixed(2)} µs | ${data.summary.rowChangeMicroseconds.development[name].median.toFixed(2)} µs |`);
  }
  lines.push('');
}
writeFileSync(join(dir, 'summary.md'), lines.join('\n'));
