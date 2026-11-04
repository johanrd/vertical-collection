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
| Infinite scroll: append 20 rows at the end, 40 times | 47 | 52 | 53 | +3 (-1 to +5) | +3 (0 to +7) |
| Prepend 20 rows, 40 times | 20 | 22 | 21 | +1 (-1 to +2) | +2 (-1 to +2) |
| Filter and sort, 30 times | 25 | 25 | 25 | 0 (-1 to +1) | 0 (-1 to +1) |
| Mount, 10 000 rows | 22 | 23 | 23 | 0 (0 to +1) | 0 (0 to +1) |
| Mount with `@renderAll`, 5 000 rows | 34 | 80 | 34 | **+46 (+38 to +56)** | +1 (0 to +2) |

- **v5 and v7:** no clear difference in any scenario. The infinite scroll interval touches 0.
- **v6:** one clear difference, `@renderAll`, which adds 46 ms of script at 5 000 rows. All tasks go from 546 ms to 580 ms, about 6%.
- **Long frames over 25 ms:** the median is 0 in every scenario and build.
- **Scrolling is noisy.** The same build ranges from 181 to 417 ms in one scenario, and all builds drift together between rounds. Use the paired differences, not the medians. `233 ms` for v7 does not show that v7 is faster.

## Cause of the `@renderAll` difference

`@tracked` on the row components, not the array. Mount with `@renderAll`, 5 000 rows, 15 rounds, production builds:

| Build | Script, median (range) | All tasks, median (range) | JS from a CPU profile, median of 5 unminified runs |
|---|---|---|---|
| v5 | 34 ms (32 to 38) | 546 ms (519 to 632) | 421 ms |
| v6 | 80 ms (70 to 93) | 580 ms (543 to 636) | 462 ms |
| v6 with only the built-in array | 78 ms (71 to 104) | 588 ms (557 to 727) | 450 ms |
| v6 with only `tracked()` | 33 ms (32 to 37) | 538 ms (527 to 584) | 404 ms |
| v7 | 34 ms (31 to 39) | 557 ms (518 to 719) | 409 ms |

- It is about 8 µs for each row created, so it shows only when many rows are created at once. Normal lists create a few.
- No single function explains it in the profiles. The exact mechanism inside `@tracked` was not isolated.
- `ScriptDuration` shows only a part of the JS on mount. Use all tasks or the profile column for the total.
- The first mount results had a measurement error: metrics started after navigation, so a few runs lost most of their work. The mount numbers here are from [a rerun](results/mount-ember-7.4.0.json), with metrics started first. The mount rows in `results/ember-7.4.0.json` and the script column in `results/render-all-cause-ember-7.4.0.json` have that error.

Raw runs and profiles: [`results/render-all-cause-ember-7.4.0.json`](results/render-all-cause-ember-7.4.0.json). Run with `BENCH_CAUSE=1`.

## v6 without `tracked-built-ins` and `decorator-transforms`

A trial, in [`v6-without-dependencies.patch`](v6-without-dependencies.patch) on top of #574. Not a PR.

- The array is a plain array in a tracked field. Each change publishes a copy.
- `content` and `index` use the `tracked` function directly, in its decorator form, instead of `@tracked`.
- A helper sets the radar arguments, and `{{#each}}` reads the array directly. If one helper does both, each array change runs it again and the update loops.

The test suite passes, 243 of 243, on Ember 3.28, 6.12, 7.4 and 7.5 beta. The results below are for Ember 7.4, with 15 rounds, as differences paired by round with 95% bootstrap intervals. Raw runs: [`results/without-dependencies-ember-7.4.0.json`](results/without-dependencies-ember-7.4.0.json).

| Script time, the trial minus | v5 | v6 | v7 |
|---|---|---|---|
| Scroll, recycling on | -5 (-53 to +33) | 0 (-10 to +10) | +2 (-2 to +33) |
| Scroll, recycling off | 0 (-55 to +87) | **-87 (-160 to -30)** | -16 (-120 to +29) |
| Infinite scroll, append | +1 (0 to +5) | +1 (-2 to +3) | 0 (-2 to +4) |
| Prepend | 0 (-2 to +2) | -1 (-5 to +1) | -1 (-4 to 0) |
| Filter and sort | 0 (-3 to +2) | 0 (-2 to +1) | -1 (-3 to +2) |
| Mount, 10 000 rows | 0 (-1 to 0) | 0 (-1 to 0) | 0 (-1 to 0) |
| Mount with `@renderAll`, 5 000 rows | **+39 (+36 to +43)** | -2 (-4 to +3) | **+41 (+38 to +43)** |

- With recycling off, the trial is clearly faster than v6, and shows no clear difference from v5.
- The `@renderAll` difference stays. So it does not come from `decorator-transforms`, but from the field form of `tracked` compared with the `tracked()` function.
- This trial changes the array and the fields together. The next section tests the array alone.

## The plain array alone

#573 with only the plain array, in commit `20ebe9b`. The results are for Ember 7.4, with 15 rounds, as paired differences with 95% bootstrap intervals. The machine was slower in this run, so compare only within this table. Raw runs: [`results/plain-array-ember-7.4.0.json`](results/plain-array-ember-7.4.0.json).

| Script time | Plain array minus `TrackedArray` | Plain array minus v5 |
|---|---|---|
| Scroll, recycling on | +6 (-24 to +25) | -6 (-45 to +35) |
| Scroll, recycling off | -2 (-46 to +36) | +3 (-18 to +37) |
| Infinite scroll, append | -2 (-9 to +12) | +1 (-7 to +7) |
| Prepend | -3 (-6 to +3) | -1 (-6 to +2) |
| Filter and sort | +1 (-2 to +6) | +2 (-3 to +4) |
| Mount, 10 000 rows | 0 (-1 to 0) | 0 (0 to 0) |
| Mount with `@renderAll`, 5 000 rows | +1 (0 to +3) | **+40 (+38 to +42)** |

- The plain array gives no clear speed gain in script time. So the gain with recycling off in the trial above did not come from the array alone. It can come from the fields, or from noise.
- The reason to use a plain array is fewer dependencies and no Proxy, not speed.

## Rows that keep their keys (#585)

`main` at `52bbd57` against #585 at `bcb33ab`, on Ember 7.4. 25 rounds, 2 000 rows, `@key="id"`, as paired differences with 95% bootstrap intervals. Raw runs: [`results/key-update-ember-7.4.0.json`](results/key-update-ember-7.4.0.json).

| 40 changes | Script, #585 minus `main` | All tasks, #585 minus `main` |
|---|---|---|
| Append with the same objects | +2 ms (-7 to +12) | +2 ms (-18 to +16) |
| Prepend with the same objects | 0 ms (-2 to +2) | 0 ms (-10 to +8) |
| Refetch: new objects plus 20 rows | **+16 ms (+13 to +18)** | **+14 ms (+8 to +25)** |

- With the same objects, there is no clear cost.
- A refetch costs about 0.4 ms more each time, because #585 renders the new objects. `main` does less work there because it leaves the rows stale.

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
- Each build uses the test app of its own commit, at the same Ember version.

## Run it

Needs `pnpm` and Chrome. It takes about 40 minutes without other load on the machine.

```sh
node bench/versions/run.mjs --ember 7.4.0 --rounds 15
BENCH_ROW_CHANGE=1 node bench/versions/run.mjs --ember 7.4.0
BENCH_MOUNT=1 node bench/versions/run.mjs --ember 7.4.0
node bench/versions/summarize.mjs
```
