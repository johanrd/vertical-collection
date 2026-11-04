# Version benchmark

Compares the proposed versions in more realistic use, on Ember 7.4. Rows have variable height, with a header, a conditional note, a list of tags and a button.

| Build | Source |
|---|---|
| v5 | `main`, `24ee6d8` |
| v6 | #574, `c7ed3f7` |
| v7 | #574 with `trackedArray` and `tracked()`, without `tracked-built-ins` and `decorator-transforms`. Patched by `run.mjs` |
| v7, Ember without index tags | v7, with the per-index tags removed from Ember's `trackedArray` |

Full results: [`results/summary.md`](results/summary.md). Every run: [`results/ember-7.4.0.json`](results/ember-7.4.0.json).

## Findings

Script time, median ms. 15 rounds, in production builds. The last two columns are differences paired by round, with 95% bootstrap intervals.

| Scenario | v5 | v6 | v7 | v6 minus v5 | v7 minus v5 |
|---|---|---|---|---|---|
| Scroll, recycling on | 294 | 269 | 233 | +5 (-25 to +19) | -8 (-75 to +11) |
| Scroll, recycling off | 355 | 347 | 350 | +17 (-12 to +29) | +19 (-18 to +60) |
| Infinite scroll: append 20 rows at the end, 40 times | 47 | 52 | 53 | +3 (-1 to +5) | +3 (+0 to +7) |
| Prepend 20 rows, 40 times | 20 | 22 | 21 | +1 (-1 to +2) | +2 (-1 to +2) |
| Filter and sort, 30 times | 25 | 25 | 25 | +0 (-1 to +1) | 0 (-1 to +1) |
| Mount, 10 000 rows | 21 | 22 | 21 | +0 (-1 to +1) | 0 (-1 to +1) |
| Mount with `@renderAll`, 5 000 rows | 33 | 72 | 32 | **+39 (+37 to +40)** | -1 (-3 to +1) |

- **v5 and v7:** no clear difference in any scenario. The infinite scroll interval touches 0.
- **v6:** one clear difference, `@renderAll`, which adds 39 ms of script and 37 ms of all tasks (about 7%) at 5 000 rows.
- **Long frames over 25 ms:** the median is 0 in every scenario and build.
- **Scrolling intervals are wide.** They do not exclude a difference of about 10% in either direction.

## Is this an upstream problem?

Not one that shows in this use. `trackedArray` has a tag per index, but each reader also consumes the collection tag, and each write dirties it. The index tags look redundant, from reading the code.

| Without the index tags | Result |
|---|---|
| One row change, 20 rows, array only | 5.31 µs to 4.88 µs |
| One row change, 2 000 rows, array only | 406 µs to 358 µs |
| All scenarios above | No clear difference |

The first two rows also show that the patch reached the bundle. Most of the cost compared with `A()` is the Proxy, which runs on each element access. It is how the feature is built, not a bug.

## Limits

- One fast machine, headless Chrome 156, and no CPU throttling. A slower device can have long frames where this one has none.
- Synthetic rows, not a real app. Only Ember 7.4.
- The intervals are not corrected for the number of comparisons.
- The cause of the `@renderAll` difference was not isolated. Changing only the array did not change it in [the array benchmark](../array/README.md), so it is probably `@tracked`, which v7 replaces.
- Each build uses the test app of its own commit, at the same Ember version.

## Run it

Needs `pnpm` and Chrome. It takes about 40 minutes without other load on the machine.

```sh
node bench/versions/run.mjs --ember 7.4.0 --rounds 15
BENCH_ROW_CHANGE=1 node bench/versions/run.mjs --ember 7.4.0
node bench/versions/summarize.mjs
```
