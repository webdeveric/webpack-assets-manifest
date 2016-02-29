# Webpack Assets Manifest

This Webpack plugin will generate a json file containing a mapping of source files to their hashed counterpart.

## Installation

```shell
npm install webdeveric/webpack-assets-manifest --save
```

## Usage

In your webpack config, require the plugin then added an instance to the `plugins` array.

```js
new WebpackAssetsManifest({
  output: 'manifest.json',
  replacer: null,
  space: 0,
  emit: true
});
```

- `output`: string - destination of manifest file
- `replacer`: null, function, or array - [replacer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter)
- `space`: int - Number of spaces to use for pretty printing. Defaults to 0.
- `emit`: boolean - Should this plugin hook into `complier emit`. Setting this to `false` will cause the manifest file to be written during `compiler done`.

If you're using `webpack-dev-server`, `emit` should probably be `false` so that the manifest file is actually written to disk and not kept only in memory.

## Example config

```js
var WebpackAssetsManifest = require('webpack-assets-manifest');

module.exports = {
  entry: {
    main: "./your-main-file",
  },

  output: {
    path: path.join( __dirname, "public", "assets" ),
    filename: '[name]-[hash].js',
    chunkFilename: '[id]-[hash].js',
    publicPath: 'assets/'
  },

  module: {
    // Your loader rules go here.
  },

  plugins: [
    new WebpackAssetsManifest({
      output: 'public/assets/manifest.json'
    })
  ]
};
```
