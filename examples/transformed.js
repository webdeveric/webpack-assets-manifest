import { WebpackAssetsManifest } from 'webpack-assets-manifest';

import { name, version } from 'webpack-assets-manifest/package.json';

const manifest = new WebpackAssetsManifest({
  output: 'transformed-manifest.json',
  transform(assets, manifest) {
    // Attach new properties to `assets` or return something else.
    // Just be sure it can be JSON stringified.
    assets.package = {
      name,
      version,
    };

    // You can call the customize hook if you need to.
    const { key, value } = manifest.hooks.customize.call({
      key: 'YourKey',
      value: 'YourValue',
    });

    assets[key] = value;
  },
});
