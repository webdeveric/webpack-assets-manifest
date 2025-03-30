import('./hello.js').then((module) => console.log(module)).catch(console.error);
import(/* webpackChunkName: "load-styles" */ './load-styles.mjs')
  .then((module) => console.log(module))
  .catch(console.error);
import(/* webpackPrefetch: true */ './prefetch.js').then((module) => console.log(module)).catch(console.error);
import(/* webpackPreload: true */ './preload.js').then((module) => console.log(module)).catch(console.error);

console.log('Complex');
