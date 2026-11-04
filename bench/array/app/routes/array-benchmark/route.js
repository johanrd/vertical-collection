import Route from '@ember/routing/route';

export default class extends Route {
  model() {
    return Array.from({ length: 10000 }, (_, n) => ({ n }));
  }
}
