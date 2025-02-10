import { WebpackAssetsManifest } from 'webpack-assets-manifest';

const manifest = new WebpackAssetsManifest({
  output: 'sorted-manifest.json',
  sortManifest(a, b) {
    // `this` is the manifest instance.

    return this.getExtension(a).localeCompare(this.getExtension(b)) || a.localeCompare(b);
  },
});
