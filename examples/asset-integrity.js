const WebpackAssetsManifest = require('webpack-assets-manifest');

const manifest = new WebpackAssetsManifest({
  output: 'asset-integrity-manifest.json',
  integrity: true,
  publicPath: true,
  customize(entry, original, manifest, asset) {
    return {
      key: entry.value,
      value: asset && asset.info.integrity,
    };
  },
});
