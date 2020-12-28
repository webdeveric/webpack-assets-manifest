import('./hello.js').then( module => console.log( module ) );
import(/* webpackChunkName: "load-styles" */ './load-styles.mjs').then( module => console.log( module ) );
import(/* webpackPrefetch: true */ './prefetch.js').then( module => console.log( module ) );
import(/* webpackPreload: true */ './preload.js').then( module => console.log( module ) );

console.log('Complex');
