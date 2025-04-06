import pkg from 'webpack-assets-manifest/package.json' with { type: 'json' };

// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'transformed-manifest.json',
  transform(assets, manifest) {
    assets['package'] = {
      name: pkg.name,
      version: pkg.version,
    };

    // You can call the customize hook if you need to.
    const customized = manifest.hooks.customize.call(
      {
        key: 'YourKey',
        value: 'YourValue',
      },
      {
        key: 'YourKey',
        value: 'YourValue',
      },
      manifest,
      undefined,
    );

    if (manifest.utils.isKeyValuePair(customized) && typeof customized.key === 'string') {
      const { key, value } = customized;

      assets[key] = value;
    }

    return assets;
  },
});
