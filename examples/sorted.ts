// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'sorted-manifest.json',
  sortManifest(left, right) {
    // `this` is the manifest instance.

    return this.getExtension(left).localeCompare(this.getExtension(right)) || left.localeCompare(right);
  },
});
