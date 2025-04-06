// This is imported this way for typechecking purposes.
// Use `import { WebpackAssetsManifest } from 'webpack-assets-manifest';` in your code.
import { WebpackAssetsManifest } from '../src/plugin.js';

new WebpackAssetsManifest({
  output: 'custom-cdn-manifest.json',
  publicPath(filename, manifest) {
    switch (manifest.getExtension(filename).substring(1).toLowerCase()) {
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'png':
      case 'svg':
        return `https://img.cdn.example.com/${filename}`;
      case 'css':
        return `https://css.cdn.example.com/${filename}`;
      case 'js':
        return `https://js.cdn.example.com/${filename}`;
      default:
        return `https://cdn.example.com/${filename}`;
    }
  },
});
