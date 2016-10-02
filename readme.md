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

In your webpack config, require the plugin then add an instance to the `plugins` array.

```js
new WebpackAssetsManifest({
  output: 'manifest.json',
  replacer: null,
  space: 0,
  writeToDisk: false,
  fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
  sortManifest: true,
  merge: false
});
```

## Options

| option | type | default | description |
| ------ | ---- | ------- | ----------- |
| `assets` | `object` | `{}` | Data is stored in this object. |
| `output` | `string` | `manifest.json` | Where to save the manifest file relative to your webpack `output.path`. |
| `replacer` | `null`, `function`, or `array` | `null` | [Replacer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter) |
| `space` | `int` | `0` | Number of spaces to use for pretty printing. |
| `writeToDisk` | `boolean` | `false` | Write the manifest to disk using `fs` during `after-emit` |
| `fileExtRegex` | `regex` | `/\.\w{2,4}\.(?:map|gz)$|\.\w+$/i` | The regular expression used to find file extensions. You'll probably never need to change this. |
| `sortManifest` | `boolean`, `function` | `true` | Should the manifest be sorted? If a function is provided, it will be used as the comparison function. |
| `merge` | `boolean` | `false` | If the output file already exists, should the data be merged with it? |

If you're using another language for your site and you're using `webpack-dev-server` to process your assets during development, you should probably set `writeToDisk` to `true` so the manifest file is actually written to disk and not kept only in memory.

### Sharing data

You can share data between instances by passing in your own object in the `assets` option.
This is useful in [multi-compiler mode](https://github.com/webpack/webpack/tree/master/examples/multi-compiler).

```js
var data = Object.create(null);

var manifest1 = new WebpackAssetsManifest({
  assets: data
});

var manifest2 = new WebpackAssetsManifest({
  assets: data
});
```

### Merging data

If you have a `json` file you'd like to add to, you can do that with the `merge` option.
If your `json` file is not in `${output.path}/manifest.json`, you should specify where the file is with the `output` option.

```js
new WebpackAssetsManifest({
  output: '/path/to/manifest.json',
  merge: true
});
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

---

## Customizing the manifest

You can customize the manifest by adding your own event listeners. The manifest is passed as the first argument so you can do whatever you need to with it.

You can use `has(key)`, `get(key)`, `set(key, value)`, and `delete(key)` to manage what goes into the manifest.

```js
var manifest = new WebpackAssetsManifest();

manifest.on('apply', function(manifest, stats) {
  manifest.add('some-key', 'some-value');
});

manifest.on('done', function(manifest, stats) {
  console.log(`The manifest has been written to ${manifest.getOutputPath()}`);
  console.log(stats); // Compilation stats
});
```

These event listeners can also be set by passing them in the constructor options.

```js
new WebpackAssetsManifest({
  done: function(manifest, stats) {
    console.log(`The manifest has been written to ${manifest.getOutputPath()}`);
    console.log(stats); // Compilation stats
  }
});
```

### Events

| name | listener signature |
| ---- | --------- |
| `apply` | `function(manifest){}` |
| `moduleAsset` | `function(manifest, key, hashedFile, module){}` |
| `processAssets` | `function(manifest, assets){}` |
| `done` | `function(manifest, stats){}` |

---

## Example config

In this example, `manifest.json` will be saved in the folder defined in `output.path`.

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
    new WebpackAssetsManifest()
  ]
};
```

---

## Sample output

```json
{
  "main.js": "main-9c68d5e8de1b810a80e4.js",
  "main.css": "main-9c68d5e8de1b810a80e4.css",
  "images/logo.svg": "images/logo-b111da4f34cefce092b965ebc1078ee3.svg"
}
```
