# Array benchmark

Compares the reactive array in `vertical-collection`, in real scrolling and in isolation.

| Build | Array | Source |
|---|---|---|
| `main` | `A()` from `@ember/array` | `24ee6d8` |
| #573 | `TrackedArray` from `tracked-built-ins` 4.1.2 | `7377e7a` |
| #573 with the built-in | `trackedArray` from `@ember/reactive/collections` | `7377e7a`, with `radar.js` patched by `run.mjs` |

Full results: [`results/summary.md`](results/summary.md). Every run: [`results/`](results/).

## Findings

Ember 6.12 and 7.4, 300 scroll steps, script time. Differences are paired by round, with 95% bootstrap intervals.

| Question | 6.12 | 7.4 | Result |
|---|---|---|---|
| Built-in minus `TrackedArray`, recycling on | -3 ms (-21 to +3) | +6 ms (-6 to +19) | No clear difference |
| Built-in minus `TrackedArray`, recycling off | +29 ms (-15 to +57) | -8 ms (-21 to +56) | No clear difference |
| `TrackedArray` minus `main`, recycling on | +13 ms (+5 to +32) | +4 ms (0 to +19) | Small |
| `TrackedArray` minus `main`, recycling off | +55 ms (+15 to +103) | +62 ms (+26 to +84) | #573 is slower |
| Recycling off minus on, `main` | +243 ms (+197 to +271) | +179 ms (+140 to +242) | Recycling saves more than half of the script time |
| Recycling off minus on, `TrackedArray` | +282 ms (+192 to +317) | +260 ms (+217 to +305) | Same |

- With recycling on, the array almost never changes during scrolling: 1 new row block in 300 steps. With recycling off, there are 1 500.
- In isolation, one row change costs 1.6 µs with `A()`, 6.5 µs with `TrackedArray` and 5.3 µs with the built-in (production build). This is the cost per row added and removed, not per scroll step.
- 1 500 row changes at about 5 µs more is about 7 ms. That is only part of the 55 to 62 ms that #573 adds with recycling off. This benchmark does not show where the rest goes.

## What it does

- **Scrolling:** 10 000 rows at a static height, 300 steps of 200 px, two frames per step. Each run is a new page. CPU time comes from Chrome's `Performance.getMetrics`. The order of the builds is shuffled in each round.
- **Array only:** remove one row and add one, then one tracked read of 20 rows, 20 000 times, with no rendering. This is 15 rounds in shuffled order, after one warm-up round.

## Limits

- One machine, headless Chrome 156, and synthetic rows. Other row content or a dynamic height can change the results.
- The intervals are not corrected for the number of comparisons.
- The `main` and #573 builds use the test app of their own commit, at the same Ember version.

## Run it

Needs `pnpm`, Chrome and a commit history with both sources. Without other load on the machine, it takes about 25 minutes for each Ember version.

```sh
node bench/array/run.mjs --ember 6.12.0 --rounds 20
node bench/array/run.mjs --ember 7.4.0 --rounds 20
node bench/array/summarize.mjs
```

Set `CHROME` or use `--chrome` if Chrome is not at the macOS default path.
