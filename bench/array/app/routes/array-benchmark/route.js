import Route from '@ember/routing/route';

export default class extends Route {
  model() {
    return Array.from({ length: Number(new URLSearchParams(location.search).get('rows') ?? 10000) }, (_, n) => ({ n }));
  }
}
