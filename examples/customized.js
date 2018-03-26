const WebpackAssetsManifest = require('webpack-assets-manifest');

const manifest = new WebpackAssetsManifest({
  output: 'customized-manifest.json',
  // This will allow you to customize each individual entry in the manifest.
  customize(entry, original, manifest, asset) {
    if ( manifest.isMerging ) {
      // Do something
    }

    // You can prevent adding items to the manifest by returning false.
    if ( entry.key.toLowerCase().endsWith('.map') ) {
      return false;
    }

    // You can directly modify key/value on the `entry` argument
    // or you can return a new object that has key and/or value properties.
    // If either the key or value is missing, the defaults will be used.
    //
    // The key should be a string and the value can be anything that can be JSON stringified.
    // If something else (or nothing) is returned, the manifest will add the entry normally.
    return {
      key: `src/${entry.key}`,
      value: `dist/${entry.value}`,
    };
  },
});
