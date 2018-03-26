const WebpackAssetsManifest = require('webpack-assets-manifest');

const manifest = new WebpackAssetsManifest({
  output: 'aws-s3-data-integrity-manifest.json',
  integrity: true,
  integrityHashes: [ 'md5' ],
  publicPath: 's3://some-bucket/some-folder/',
  customize(entry, original, manifest, asset) {
    return {
      key: entry.value,
      value: asset && asset.integrity.substr(4),
    };
  },
});
