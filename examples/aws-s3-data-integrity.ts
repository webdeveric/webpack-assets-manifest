// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'aws-s3-data-integrity-manifest.json',
  integrity: true,
  integrityHashes: ['md5'],
  integrityPropertyName: 'md5',
  publicPath: 's3://some-bucket/some-folder/',
  customize(entry, _original, manifest, asset) {
    return manifest.utils.isKeyValuePair(entry)
      ? {
          key: entry.value,
          value: asset && asset.info['md5'].substr(4),
        }
      : entry;
  },
});
