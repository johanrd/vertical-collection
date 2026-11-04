# Results

## Ember 7.4.0

Google Chrome 156.0.8078.80. 15 rounds, production builds.

### Script, median ms

| Scenario | v5 (main) | v6 (#574) | v7 | v7, Ember without index tags |
|---|---|---|---|---|
| Filter and sort, 30 times | 25 | 25 | 25 | 25 |
| Infinite scroll: append 20 rows at the end, 40 times | 47 | 52 | 53 | 54 |
| Mount with @renderAll, 5 000 rows | 33 | 72 | 32 | 33 |
| Mount, 10 000 rows | 21 | 22 | 21 | 22 |
| Prepend 20 rows, 40 times | 20 | 22 | 21 | 20 |
| Scroll, recycling off | 355 | 347 | 350 | 303 |
| Scroll, recycling on | 294 | 269 | 233 | 243 |

### All tasks, median ms

| Scenario | v5 (main) | v6 (#574) | v7 | v7, Ember without index tags |
|---|---|---|---|---|
| Filter and sort, 30 times | 81 | 82 | 80 | 81 |
| Infinite scroll: append 20 rows at the end, 40 times | 144 | 153 | 169 | 159 |
| Mount with @renderAll, 5 000 rows | 516 | 550 | 510 | 520 |
| Mount, 10 000 rows | 56 | 56 | 56 | 57 |
| Prepend 20 rows, 40 times | 89 | 79 | 83 | 74 |
| Scroll, recycling off | 766 | 740 | 782 | 671 |
| Scroll, recycling on | 764 | 716 | 611 | 641 |

### Long frames over 25 ms, median

| Scenario | v5 (main) | v6 (#574) | v7 | v7, Ember without index tags |
|---|---|---|---|---|
| Filter and sort, 30 times | 0 | 0 | 0 | 0 |
| Infinite scroll: append 20 rows at the end, 40 times | 0 | 0 | 0 | 0 |
| Prepend 20 rows, 40 times | 0 | 0 | 0 | 0 |
| Scroll, recycling off | 0 | 0 | 0 | 0 |
| Scroll, recycling on | 0 | 0 | 0 | 0 |

### Script, paired differences by round

Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.

| Scenario | v6 (#574) minus v5 (main) | v7 minus v5 (main) | v7 minus v6 (#574) | v7, Ember without index tags minus v7 |
|---|---|---|---|---|
| Filter and sort, 30 times | +0 (-1 to +1) | 0 (-1 to +1) | -1 (-2 to +1) | +0 (0 to +2) |
| Infinite scroll: append 20 rows at the end, 40 times | +3 (-1 to +5) | +3 (+0 to +7) | 0 (-2 to +6) | 0 (-4 to +2) |
| Mount with @renderAll, 5 000 rows | +39 (+37 to +40) | -1 (-3 to +1) | -40 (-41 to -38) | +0 (-1 to +2) |
| Mount, 10 000 rows | +0 (-1 to +1) | 0 (-1 to +1) | 0 (-1 to +0) | 0 (-1 to +1) |
| Prepend 20 rows, 40 times | +1 (-1 to +2) | +2 (-1 to +2) | 0 (-3 to +3) | +0 (-3 to +1) |
| Scroll, recycling off | +17 (-12 to +29) | +19 (-18 to +60) | +1 (-92 to +49) | +4 (-12 to +25) |
| Scroll, recycling on | +5 (-25 to +19) | -8 (-75 to +11) | -8 (-61 to +6) | +1 (-11 to +44) |

### All tasks, paired differences by round

Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.

| Scenario | v6 (#574) minus v5 (main) | v7 minus v5 (main) | v7 minus v6 (#574) | v7, Ember without index tags minus v7 |
|---|---|---|---|---|
| Filter and sort, 30 times | -1 (-7 to +3) | +0 (-4 to +5) | -1 (-4 to +3) | +0 (-2 to +7) |
| Infinite scroll: append 20 rows at the end, 40 times | +5 (-5 to +14) | +5 (0 to +19) | -1 (-4 to +16) | +0 (-9 to +6) |
| Mount with @renderAll, 5 000 rows | +37 (+22 to +45) | -4 (-39 to +10) | -38 (-47 to -28) | +9 (-6 to +24) |
| Mount, 10 000 rows | 0 (-2 to +2) | +0 (-2 to +3) | +0 (-2 to +4) | 0 (-3 to +2) |
| Prepend 20 rows, 40 times | 0 (-10 to +4) | +2 (-9 to +4) | +0 (-17 to +10) | -1 (-9 to +4) |
| Scroll, recycling off | +17 (-36 to +43) | +16 (-48 to +73) | +1 (-139 to +109) | +4 (-19 to +21) |
| Scroll, recycling on | +8 (-48 to +30) | -19 (-195 to +18) | +1 (-153 to +27) | -1 (-19 to +72) |
