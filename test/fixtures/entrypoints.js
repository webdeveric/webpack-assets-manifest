import './styles.css';
import(/* webpackChunkName: "prefetch-js" */ /* webpackPrefetch: true */ './entrypoints-prefetch');
import(/* webpackChunkName: "preload-js" */ /* webpackPreload: true */ './entrypoints-preload');
import(/* webpackChunkName: "prefetch-css" */ /* webpackPrefetch: true */ './entrypoints-prefetch.css');
import(/* webpackChunkName: "preload-css" */ /* webpackPreload: true */ './entrypoints-preload.css');

// this should not be in "entrypoints", since it's neither preloaded or prefetched
import(/* webpackChunkName: "async" */ './entrypoints-async.js');

export default function(name) {
  return 'Hello ' + name;
}
