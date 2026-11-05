import Controller from '@ember/controller';
import { A } from '@ember/array';
import { TrackedArray } from 'tracked-built-ins';
import { trackedArray } from '@ember/reactive/collections';
import { createCache, getValue } from '@glimmer/tracking/primitives/cache';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// One row change: what the radar does when a row component is removed and a new one added.
const spliceStep = (a, row) => {
  a.splice(a.indexOf(a[1]), 1);
  a.splice(a.length - 1, 0, row);
};
const emberArrayStep = (a, row) => {
  a.removeObject(a[1]);
  a.insertAt(a.length - 1, row);
};
const IMPLEMENTATIONS = {
  'A() (main)': [(rows) => A(rows), emberArrayStep],
  'TrackedArray (#573)': [(rows) => new TrackedArray(rows), spliceStep],
  'trackedArray (built-in)': [(rows) => trackedArray(rows), spliceStep],
  'plain array (not reactive)': [(rows) => rows, spliceStep],
};

function rowChangeMicroseconds(name, steps, size = 20) {
  const [make, step] = IMPLEMENTATIONS[name];
  const a = make(Array.from({ length: size }, (_, i) => ({ i })));
  const start = performance.now();
  for (let s = 0; s < steps; s++) {
    step(a, { i: s });
    getValue(
      createCache(() => {
        let sum = a.length;
        for (const row of a) sum += row.i;
        return sum;
      }),
    );
  }
  return ((performance.now() - start) / steps) * 1000;
}

window.__bench = {
  ready: async () => {
    while (!document.querySelector('.bench-row')) await nextFrame();
    for (let i = 0; i < 20; i++) await nextFrame();
    return true;
  },
  implementations: Object.keys(IMPLEMENTATIONS),
  rowChange: rowChangeMicroseconds,
  scroll: async (steps, stepPixels) => {
    const scroller = document.getElementById('bench-scroller');
    const seen = new WeakSet(document.querySelectorAll('.bench-row'));
    let newBlocks = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.classList?.contains('bench-row') && !seen.has(node)) {
            seen.add(node);
            newBlocks++;
          }
        }
      }
    });
    observer.observe(scroller, { childList: true, subtree: true });
    for (let i = 0; i < steps; i++) {
      scroller.scrollTop += stepPixels;
      await nextFrame();
      await nextFrame();
    }
    observer.disconnect();
    return { newBlocks, scrollTop: scroller.scrollTop };
  },
};

export default class extends Controller {
  renderAll = new URLSearchParams(location.search).get('renderAll') === 'true';
  shouldRecycle = new URLSearchParams(location.search).get('recycle') !== 'false';
}
