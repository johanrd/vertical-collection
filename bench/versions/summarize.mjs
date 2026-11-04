// Usage: node bench/versions/summarize.mjs. Writes results/summary.md from results/ember-*.json.
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

function paired(a, b) {
  let state = 42;
  const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const differences = a.map((value, i) => value - b[i]);
  const medians = Array.from({ length: 10000 }, () =>
    median(differences.map(() => differences[Math.floor(random() * differences.length)])),
  );
  return { median: median(differences), low: quantile(medians, 0.025), high: quantile(medians, 0.975) };
}
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}`;

const lines = ['# Results', ''];
for (const file of readdirSync(dir).filter((f) => f.startsWith('ember-')).sort()) {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const builds = [...new Set(data.runs.map((r) => r.build))].sort();
  const scenarios = [...new Set(data.runs.map((r) => r.scenario))].sort();
  const values = (scenario, build, key) => data.runs.filter((r) => r.scenario === scenario && r.build === build).sort((a, b) => a.round - b.round).map((r) => r[key]);
  lines.push(`## Ember ${data.ember}`, '', `${data.chrome}. ${data.rounds} rounds, production builds.`, '');
  for (const [title, key] of [['Script', 'scriptMs'], ['All tasks', 'taskMs']]) {
    lines.push(`### ${title}, median ms`, '', `| Scenario | ${builds.join(' | ')} |`, `|---|${builds.map(() => '---').join('|')}|`);
    for (const s of scenarios) lines.push(`| ${s} | ${builds.map((b) => Math.round(median(values(s, b, key)))).join(' | ')} |`);
    lines.push('');
  }
  lines.push('### Long frames over 25 ms, median', '', `| Scenario | ${builds.join(' | ')} |`, `|---|${builds.map(() => '---').join('|')}|`);
  for (const s of scenarios.filter((s) => values(s, builds[0], 'longFrames')[0] !== null)) {
    lines.push(`| ${s} | ${builds.map((b) => median(values(s, b, 'longFrames'))).join(' | ')} |`);
  }
  const v5 = builds.find((b) => b.startsWith('v5'));
  const v6 = builds.find((b) => b.startsWith('v6'));
  const v7 = builds.find((b) => b === 'v7');
  const lean = builds.find((b) => b.includes('without'));
  const pairs = [[v6, v5], [v7, v5], [v7, v6], [lean, v7]];
  for (const [title, key] of [['Script', 'scriptMs'], ['All tasks', 'taskMs']]) {
    lines.push('', `### ${title}, paired differences by round`, '', 'Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.', '', `| Scenario | ${pairs.map(([a, b]) => `${a} minus ${b}`).join(' | ')} |`, `|---|${pairs.map(() => '---').join('|')}|`);
    for (const s of scenarios) {
      lines.push(`| ${s} | ${pairs.map(([a, b]) => {
        const d = paired(values(s, a, key), values(s, b, key));
        return `${signed(d.median)} (${signed(d.low)} to ${signed(d.high)})`;
      }).join(' | ')} |`);
    }
  }
  lines.push('');
}
writeFileSync(join(dir, 'summary.md'), lines.join('\n'));
