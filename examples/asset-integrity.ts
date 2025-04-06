// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'asset-integrity-manifest.json',
  integrity: true,
  publicPath: true,
  customize(entry, _original, manifest, asset) {
    return manifest.utils.isKeyValuePair(entry)
      ? {
          key: entry.value,
          value: asset && asset.info['integrity'],
        }
      : entry;
  },
});
