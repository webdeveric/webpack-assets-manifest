# Webpack Assets Manifest

[![Build Status](https://travis-ci.org/webdeveric/webpack-assets-manifest.svg?branch=master)](https://travis-ci.org/webdeveric/webpack-assets-manifest)
[![codecov](https://codecov.io/gh/webdeveric/webpack-assets-manifest/branch/master/graph/badge.svg)](https://codecov.io/gh/webdeveric/webpack-assets-manifest)
[![dependencies Status](https://david-dm.org/webdeveric/webpack-assets-manifest/status.svg)](https://david-dm.org/webdeveric/webpack-assets-manifest)
[![devDependencies Status](https://david-dm.org/webdeveric/webpack-assets-manifest/dev-status.svg)](https://david-dm.org/webdeveric/webpack-assets-manifest?type=dev)

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
  space: 2,
  writeToDisk: false,
  fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
  sortManifest: true,
  merge: false,
  publicPath: null,
  customize: null,
  contextRelativeKeys: false,
});
```

## Options

| option | type | default | description |
| ------ | ---- | ------- | ----------- |
| `assets` | `object` | `{}` | Data is stored in this object. |
| `output` | `string` | `manifest.json` | Where to save the manifest file relative to your webpack `output.path`. |
| `replacer` | `null`, `function`, or `array` | `null` | [Replacer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter) |
| `space` | `int` | `2` | Number of spaces to use for pretty printing. |
| `writeToDisk` | `boolean` | `false` | Write the manifest to disk using `fs` during `after-emit` |
| `fileExtRegex` | `regex` | `/\.\w{2,4}\.(?:map|gz)$|\.\w+$/i` | The regular expression used to find file extensions. You'll probably never need to change this. |
| `sortManifest` | `boolean`, `function` | `true` | Should the manifest be sorted? If a function is provided, it will be used as the comparison function. |
| `merge` | `boolean` | `false` | If the output file already exists, should the data be merged with it? |
| `publicPath` | `string`, `function`, `boolean` | `null` | Value prefix or callback to customize the value. If `true`, your webpack config `output.publicPath` will be used as the prefix. |
| `customize` | `function` | `null` | Callback to customize the `key` and/or `value`. If `false` is returned, that item is not added to the manifest. |
| `contextRelativeKeys` | `boolean` | `false` | Should the `key` be relative to you compiler context? |

### Using `webpack-dev-server`

If you're using another language for your site and you're using `webpack-dev-server` to process your assets during development, you should set `writeToDisk` to `true` and provide an absolute path in `output` so the manifest file is actually written to disk and not kept only in memory.

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

The manifest is sorted alphabetically by default. You can turn off sorting by setting `sortManifest` to `false`.

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

### Add your CDN

You can customize the value that gets saved to the manifest by using `publicPath`.

One common use is to prefix your __CDN URL__ to the value.

```js
var manifest = new WebpackAssetsManifest({
  publicPath: '//cdn.example.com'
});
```

If you'd like to have more control, use a function.
The example below shows how you can prefix a different CDN based on the file extension.

```js
var manifest = new WebpackAssetsManifest({
  publicPath: function(val, manifest) {
    switch( manifest.getExtension( val ).substr(1).toLowerCase() ) {
      case 'jpg': case 'jpeg': case 'gif': case 'png': case 'svg':
        return '//img-cdn.example.com' + val;
        break;
      case 'css':
        return '//css-cdn.example.com' + val;
        break;
      case 'js':
        return '//js-cdn.example.com' + val;
        break;
      default:
        return '//cdn.example.com' + val;
    }
  }
});
```

---

## Customizing the manifest

You can customize the manifest by adding your own event listeners. The manifest is passed as the first argument so you can do whatever you need to with it.

You can use `has(key)`, `get(key)`, `set(key, value)`, and `delete(key)` methods on manifest plugin instance to manage what goes into the manifest.

```js
var manifest = new WebpackAssetsManifest();

manifest.on('apply', function(manifest) {
  manifest.set('some-key', 'some-value');
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

### `customize` callback

If you want more control over exactly what gets added to your manifest, then use the `customize` option.

> Be aware that keys and/or values may have been modified if you're using the `publicPath` or `contextRelativeKeys` options.

```js
new WebpackAssetsManifest({
  customize: function(key, value, originalValue, manifest) {
    // You can prevent adding items to the manifest by returning false.
    if ( key.toLowerCase().endsWith('.map') ) {
      return false;
    }

    // The manifest instance is available if you need it.
    if ( manifest.options.publicPath ) {
      // Do something
    }

    // originalValue is the value before the publicPath option was applied.
    if ( originalValue ) {
      // Do something
    }

    // To alter the key/value, return an object with a key/value property.
    // The key should be a string and the value can be anything that can be JSON stringified.
    // If something else (or nothing) is returned, this callback will have no affect and the
    // manifest will add the entry normally.
    return {
      key: key,
      value: value,
    };
  },
}),
```

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
