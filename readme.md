# Webpack Assets Manifest

This Webpack plugin will generate a json file containing a mapping of source files to their hashed counterpart.

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
  emit: true
});
```
| option | type | default | description |
| :----- | :--- | :------ | :---------- |
| `output` | `string` | `manifest.json` | destination of manifest file |
| `replacer` | `null`, `function`, or `array` | `null` | [replacer reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter) |
| `space` | `int` | `0` | Number of spaces to use for pretty printing. |
| `emit` | `boolean` | `true` | Should this plugin hook into `complier emit`?<br />Setting this to `false` will cause the manifest file to be written during `compiler done`. |

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

## Output

The output is a JSON file that matches up the original filename with the hashed version.

### Sample output

```json
{
  "main.js": "main-9c68d5e8de1b810a80e4.js",
  "main.css": "main-9c68d5e8de1b810a80e4.css",
  "images/logo.svg": "images/logo-b111da4f34cefce092b965ebc1078ee3.svg"
}
```
