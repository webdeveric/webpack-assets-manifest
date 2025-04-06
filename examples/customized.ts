// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'customized-manifest.json',
  // This will allow you to customize each individual entry in the manifest.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  customize(entry, _original, manifest, _asset) {
    if (manifest.isMerging) {
      // Do something
    }

    if (manifest.utils.isKeyValuePair(entry)) {
      // You can prevent adding items to the manifest by returning false.
      if (typeof entry.key === 'string' && entry.key.toLowerCase().endsWith('.map')) {
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
    }

    return entry;
  },
});
