import { WebpackAssetsManifest } from 'webpack-assets-manifest';

const manifest = new WebpackAssetsManifest({
  output: 'merged-manifest.json',
  merge: true,
  customize(entry, original, manifest, asset) {
    if (manifest.isMerging) {
      // Do something
    }
  },
});
