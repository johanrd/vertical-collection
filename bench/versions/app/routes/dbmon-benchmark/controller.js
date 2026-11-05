import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import getData from 'test-app/lib/get-data';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export default class extends Controller {
  @tracked databases = [];

  constructor() {
    super(...arguments);
    // Like the dbmon demo: new objects with the same keys in each update.
    const run = async (rowsFor) => {
      let longFrames = 0;
      let last = performance.now();
      for (let frame = 0; frame < 300; frame++) {
        this.databases = getData(rowsFor(frame)).databases;
        await nextFrame();
        const now = performance.now();
        if (now - last > 25) longFrames++;
        last = now;
      }
      return { longFrames };
    };
    window.__bench = {
      ready: async () => {
        while (!document.querySelector('.latest-data tr')) await nextFrame();
        for (let i = 0; i < 20; i++) await nextFrame();
        return true;
      },
      dbmonSteady: () => run(() => 100),
      dbmonGrowing: () => run((frame) => 100 + frame),
    };
  }
}
