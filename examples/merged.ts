// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'merged-manifest.json',
  merge: true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  customize(entry, _original, manifest, _asset) {
    if (manifest.isMerging) {
      // Do something
    }

    return entry;
  },
});
