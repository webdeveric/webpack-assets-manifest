const WebpackAssetsManifest = require('webpack-assets-manifest');

const manifest = new WebpackAssetsManifest({
  output: 'transformed-manifest.json',
  transform(assets, manifest) {
    // Attach new properties to `assets` or return something else.
    // Just be sure it can be JSON stringified.

    const { name, version } = require('./package.json');

    assets.package = {
      name,
      version,
    };

    // You can call the customize hook if you need to.
    const { key, value } = manifest.hooks.customize.call({
      key: 'YourKey',
      value: 'YourValue',
    });

    assets[ key ] = value;
  },
});
