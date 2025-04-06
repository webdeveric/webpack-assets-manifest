// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'asset-size-manifest.json',
  customize(entry, _original, manifest, asset) {
    return manifest.utils.isKeyValuePair(entry)
      ? {
          value: {
            value: entry.value,
            // `asset` could be `undefined` when `manifest.set()` is manually called.
            // `size()` returns number of bytes
            size: asset?.source.size(),
          },
        }
      : entry;
  },
});
