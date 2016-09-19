# Webpack Assets Manifest

[![Build Status](https://travis-ci.org/webdeveric/webpack-assets-manifest.svg?branch=master)](https://travis-ci.org/webdeveric/webpack-assets-manifest)
[![codecov](https://codecov.io/gh/webdeveric/webpack-assets-manifest/branch/master/graph/badge.svg)](https://codecov.io/gh/webdeveric/webpack-assets-manifest)
[![dependencies Status](https://david-dm.org/webdeveric/webpack-assets-manifest/status.svg)](https://david-dm.org/webdeveric/webpack-assets-manifest)
[![devDependencies Status](https://david-dm.org/webdeveric/webpack-assets-manifest/dev-status.svg)](https://david-dm.org/webdeveric/webpack-assets-manifest?type=dev)
[![peerDependencies Status](https://david-dm.org/webdeveric/webpack-assets-manifest/peer-status.svg)](https://david-dm.org/webdeveric/webpack-assets-manifest?type=peer)

This Webpack plugin will generate a JSON file that matches the original filename with the hashed version.

## Installation

```shell
npm install webpack-assets-manifest --save
```

## Usage

In your webpack config, require the plugin then added an instance to the `plugins` array.

```js
new WebpackAssetsManifest({
  output: 'manifest.json',
  replacer: null,
  space: 0,
  emit: true,
  sortManifest: true
});
```
| option | type | default | description |
| ------ | ---- | ------- | ----------- |
| `output` | `string` | `manifest.json` | Where to save the manifest file relative to `options.output.path`. |
| `replacer` | `null`, `function`, or `array` | `null` | [Replacer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter) |
| `space` | `int` | `0` | Number of spaces to use for pretty printing. |
| `emit` | `boolean` | `true` | Should this plugin hook into `complier emit`?<br />Setting this to `false` will cause the manifest file to be written during `compiler done`. |
| `fileExtRegex` | `regex` | `/\.\w{2,4}\.(?:map|gz)$|\.\w+$/i` | The regular expression used to find file extensions. You'll probably never need to change this. |
| `sortManifest` | `boolean`, `function` | `true` | Should the manifest be sorted? If a function is provided, it will be used as the comparison function. |

If you're using another language for your site and you're using `webpack-dev-server` to process your assets during development, you should probably set `emit` to `false` so the manifest file is actually written to disk and not kept only in memory.

## Example config

```js
var WebpackAssetsManifest = require('webpack-assets-manifest');

module.exports = {
  entry: {
    main: "./your-main-file",
  },

  output: {
    path: path.join( __dirname, 'public', 'assets' ),
    filename: '[name]-[hash].js',
    chunkFilename: '[id]-[hash].js',
    publicPath: 'assets/'
  },

  module: {
    // Your loader rules go here.
  },

  plugins: [
    new WebpackAssetsManifest({
      output: 'manifest.json'
    })
  ]
};
```

### Sorting the manifest

The manifest is sorted by default since I find it easier to read that way.

You can turn off sorting by setting `sortManifest` to `false`.

If you want more control over how the manifest is sorted, you can provide your own comparison function.
In the example below, the manifest will be sorted by file extension then alphabetically.

```js
new WebpackAssetsManifest({
  output: 'manifest.json',
  space: 2,
  sortManifest: function(a, b) {
    var extA = this.getExtension(a);
    var extB = this.getExtension(b);

    if ( extA > extB ) {
      return 1;
    }

    if ( extA < extB ) {
      return -1;
    }

    return a.localeCompare(b);
  }
});
```

## Sample output

```json
{
  "main.js": "main-9c68d5e8de1b810a80e4.js",
  "main.css": "main-9c68d5e8de1b810a80e4.css",
  "images/logo.svg": "images/logo-b111da4f34cefce092b965ebc1078ee3.svg"
}
```
