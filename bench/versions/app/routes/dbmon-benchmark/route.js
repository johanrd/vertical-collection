import Route from '@ember/routing/route';
import getData from 'test-app/lib/get-data';

export default class extends Route {
  model() {
    return getData(100).databases;
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.databases = model;
  }
}
