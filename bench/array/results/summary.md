# Results

## Ember 6.12.0

Google Chrome 156.0.8078.80. 20 rounds, 300 scroll steps of 200 px, 10 000 rows, static height, production builds.

### Scrolling

| Build | Recycling | New row blocks | Script, median (p25 to p75) | All tasks, median (p25 to p75) |
|---|---|---|---|---|
| main, A() | on | 1 | 178 ms (132 to 205) | 530 ms (403 to 588) |
| main, A() | off | 1500 | 438 ms (314 to 466) | 782 ms (567 to 831) |
| #573, TrackedArray | on | 1 | 205 ms (173 to 218) | 566 ms (475 to 610) |
| #573, TrackedArray | off | 1500 | 478 ms (362 to 545) | 808 ms (636 to 912) |
| #573, trackedArray built-in | on | 1 | 198 ms (152 to 219) | 548 ms (423 to 614) |
| #573, trackedArray built-in | off | 1500 | 497 ms (429 to 552) | 842 ms (746 to 914) |

### Paired differences by round

Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.

| Comparison | Recycling | Script | All tasks |
|---|---|---|---|
| #573, TrackedArray minus main, A() | on | +13 ms (+5 to +32) | +23 ms (+6 to +64) |
| #573, TrackedArray minus main, A() | off | +55 ms (+15 to +103) | +40 ms (-21 to +105) |
| #573, trackedArray built-in minus main, A() | on | +12 ms (+4 to +26) | +22 ms (-10 to +53) |
| #573, trackedArray built-in minus main, A() | off | +80 ms (+47 to +109) | +82 ms (+27 to +127) |
| #573, trackedArray built-in minus #573, TrackedArray | on | -3 ms (-21 to +3) | +2 ms (-60 to +10) |
| #573, trackedArray built-in minus #573, TrackedArray | off | +29 ms (-15 to +57) | +33 ms (-20 to +76) |
| main, A(): recycling off minus on | both | +243 ms (+197 to +271) | +246 ms (+179 to +291) |
| #573, TrackedArray: recycling off minus on | both | +282 ms (+192 to +317) | +246 ms (+99 to +303) |
| #573, trackedArray built-in: recycling off minus on | both | +305 ms (+248 to +330) | +290 ms (+222 to +352) |

### One row change, array only

Median of 15 rounds of 20000 changes, with no rendering.

| Array | Production | Development |
|---|---|---|
| A() (main) | 1.60 µs | 1.69 µs |
| TrackedArray (#573) | 6.53 µs | 6.53 µs |
| trackedArray (built-in) | 5.33 µs | 5.40 µs |
| plain array (not reactive) | 0.35 µs | 0.39 µs |

## Ember 7.4.0

Google Chrome 156.0.8078.80. 20 rounds, 300 scroll steps of 200 px, 10 000 rows, static height, production builds.

### Scrolling

| Build | Recycling | New row blocks | Script, median (p25 to p75) | All tasks, median (p25 to p75) |
|---|---|---|---|---|
| main, A() | on | 1 | 183 ms (168 to 235) | 549 ms (497 to 670) |
| main, A() | off | 1500 | 378 ms (323 to 439) | 715 ms (617 to 775) |
| #573, TrackedArray | on | 1 | 191 ms (143 to 234) | 558 ms (414 to 653) |
| #573, TrackedArray | off | 1500 | 429 ms (416 to 504) | 752 ms (721 to 861) |
| #573, trackedArray built-in | on | 1 | 207 ms (159 to 232) | 565 ms (475 to 622) |
| #573, trackedArray built-in | off | 1500 | 435 ms (397 to 556) | 766 ms (703 to 956) |

### Paired differences by round

Median difference, with the 95% bootstrap interval. An interval that includes 0 shows no clear difference.

| Comparison | Recycling | Script | All tasks |
|---|---|---|---|
| #573, TrackedArray minus main, A() | on | +4 ms (0 to +19) | +11 ms (-34 to +36) |
| #573, TrackedArray minus main, A() | off | +62 ms (+26 to +84) | +64 ms (+14 to +94) |
| #573, trackedArray built-in minus main, A() | on | +17 ms (-15 to +28) | +18 ms (-55 to +59) |
| #573, trackedArray built-in minus main, A() | off | +78 ms (+46 to +114) | +82 ms (+48 to +140) |
| #573, trackedArray built-in minus #573, TrackedArray | on | +6 ms (-6 to +19) | +19 ms (-14 to +55) |
| #573, trackedArray built-in minus #573, TrackedArray | off | -8 ms (-21 to +56) | -8 ms (-23 to +85) |
| main, A(): recycling off minus on | both | +179 ms (+140 to +242) | +155 ms (+102 to +195) |
| #573, TrackedArray: recycling off minus on | both | +260 ms (+217 to +305) | +251 ms (+157 to +302) |
| #573, trackedArray built-in: recycling off minus on | both | +273 ms (+194 to +324) | +252 ms (+177 to +336) |

### One row change, array only

Median of 15 rounds of 20000 changes, with no rendering.

| Array | Production | Development |
|---|---|---|
| A() (main) | 1.59 µs | 1.73 µs |
| TrackedArray (#573) | 6.58 µs | 6.75 µs |
| trackedArray (built-in) | 5.40 µs | 5.57 µs |
| plain array (not reactive) | 0.35 µs | 0.41 µs |
