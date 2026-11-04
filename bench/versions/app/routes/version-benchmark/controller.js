import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { trackedArray } from '@ember/reactive/collections';
import { createCache, getValue } from '@glimmer/tracking/primitives/cache';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const twoFrames = async () => {
  await nextFrame();
  await nextFrame();
};
const params = new URLSearchParams(location.search);

export const makeRows = (start, count) =>
  Array.from({ length: count }, (_, i) => {
    const id = start + i;
    return {
      id,
      title: `Equipment ${id}`,
      date: `2026-${String((id % 12) + 1).padStart(2, '0')}-14`,
      note: id % 3 === 0 ? 'Long note. '.repeat((id % 5) + 2) : null,
      tags: Array.from({ length: (id % 5) + 1 }, (_, t) => `tag ${t}`),
    };
  });

let nextId = 1_000_000;

export default class extends Controller {
  @tracked items = [];
  shouldRecycle = params.get('recycle') !== 'false';
  renderAll = params.get('renderAll') === 'true';

  constructor() {
    super(...arguments);
    const measureFrames = async (work) => {
      let longFrames = 0;
      let active = true;
      let last = performance.now();
      const watch = (now) => {
        if (now - last > 25) longFrames++;
        last = now;
        if (active) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
      await work();
      active = false;
      return { longFrames };
    };
    const repeat = (count, change) =>
      measureFrames(async () => {
        for (let i = 0; i < count; i++) {
          change(i);
          await twoFrames();
        }
      });
    const more = (count) => {
      const rows = makeRows(nextId, count);
      nextId += count;
      return rows;
    };
    window.__bench = {
      ready: async () => {
        while (!document.querySelector('.bench-row')) await nextFrame();
        for (let i = 0; i < 20; i++) await nextFrame();
        return true;
      },
      scroll: () =>
        measureFrames(async () => {
          const scroller = document.getElementById('bench-scroller');
          for (let i = 0; i < 300; i++) {
            scroller.scrollTop += 300;
            await twoFrames();
          }
        }),
      append: () =>
        repeat(40, () => {
          const scroller = document.getElementById('bench-scroller');
          scroller.scrollTop = scroller.scrollHeight;
          this.items = [...this.items, ...more(20)];
        }),
      prepend: () => repeat(40, () => (this.items = [...more(20), ...this.items])),
      refetchAppend: () =>
        repeat(40, () => {
          this.items = [...this.items.map((row) => ({ ...row })), ...more(20)];
        }),
      replace: () => {
        const all = this.items;
        return repeat(30, (i) => {
          this.items = i % 2 === 0 ? all.filter((row) => row.id % 2 === 0) : all.slice().reverse();
        });
      },
      // Ember's trackedArray alone: shows whether a build has the index tags.
      rowChange: (size, steps) => {
        const a = trackedArray(Array.from({ length: size }, (_, i) => ({ i })));
        const start = performance.now();
        for (let s = 0; s < steps; s++) {
          a.splice(a.indexOf(a[1]), 1);
          a.splice(a.length - 1, 0, { i: s });
          getValue(
            createCache(() => {
              let sum = a.length;
              for (const row of a) sum += row.i;
              return sum;
            }),
          );
        }
        return ((performance.now() - start) / steps) * 1000;
      },
    };
  }
}
