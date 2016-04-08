/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */

'use strict';

var path  = require('path');
var merge = require('lodash.merge');
var keys  = require('lodash.keys');
var pick  = require('lodash.pick');

/**
 * @param {object} options - configuration options
 * @constructor
 */
function WebpackAssetsManifest(options)
{
  var defaults = {
    output: 'manifest.json',
    replacer: null,
    space: 0,
    emit: true
  };

  options = pick(
    merge({}, defaults, options || {}),
    keys(defaults)
  );

  merge(this, options);

  this.moduleAssets = {};
}

/**
 * Get the file extension.
 *
 * @param  {string} filename
 * @param  {number} num - number of extensions to return. For example, use 1 to get `.gz` and use 2 to get `.tar.gz`.
 * @return {string}
 */
WebpackAssetsManifest.prototype.getExtension = function(filename, num)
{
  if (! filename) {
    return '';
  }

  num = (num || 1) | 0;

  var parts = path.basename(filename).split(/\./);
  parts.shift(); // Remove the filename

  return parts.length ? '.' + parts.slice(-num).join('.') : '';
};

/**
 * Get JSON data from compilation stats.
 *
 * @param  {object} stats - compilation stats
 * @return {object}
 */
WebpackAssetsManifest.prototype.getStatsData = function(stats)
{
  return stats.toJson({
    assets: true,
    modulesSort: true,
    chunksSort: true,
    assetsSort: true,

    hash: false,
    version: false,
    timings: false,
    chunks: false,
    chunkModules: false,
    modules: false,
    children: false,
    cached: false,
    reasons: false,
    source: false,
    errorDetails: false,
    chunkOrigins: false
  });
};

/**
 * Process compilation assets.
 *
 * @param  {object} assets - assets by chunk name
 * @return {object}
 */
WebpackAssetsManifest.prototype.processAssets = function(assets)
{
  for (var name in assets) {

    var filenames = assets[ name ];

    if (! Array.isArray(filenames)) {
      filenames = [ filenames ];
    }

    for (var i = 0, l = filenames.length; i < l ; ++i ) {
      var filename = name + this.getExtension(filenames[ i ], 2);
      this.moduleAssets[ filename ] = filenames[ i ];
    }

  }

  return this.moduleAssets;
};

/**
 * JSON stringify module assets
 *
 * @return {string}
 */
WebpackAssetsManifest.prototype.toString = function()
{
  return JSON.stringify(this.moduleAssets, this.replacer, this.space);
};

/**
 * Handle the `emit` event
 *
 * @param  {object} compiler - the Webpack compiler object
 * @param  {string} output - file path
 * @param  {object} compilation - the Webpack compilation object
 * @param  {Function} callback
 */
WebpackAssetsManifest.prototype.handleEmit = function(compiler, output, compilation, callback)
{
  this.processAssets(this.getStatsData(compilation.getStats()).assetsByChunkName);

  var json = this.toString();

  output = path.relative(compiler.options.output.path, output);

  compilation.assets[ output ] = {
    source: function() {
      return json;
    },
    size: function() {
      return json.length;
    }
  };

  callback();
};

/**
 * Handle the `done` event
 *
 * @param  {string} output - file path
 * @param  {object} stats - compilation stats
 */
WebpackAssetsManifest.prototype.handleDone = function(output, stats)
{
  this.processAssets(this.getStatsData(stats).assetsByChunkName);

  var json = this.toString();
  var fs   = require('fs-extra');

  fs.mkdirsSync( path.dirname(output) );
  fs.writeFileSync(output, json);
};

/**
 * Hook into the Webpack compiler
 *
 * @param  {object} compiler - the Webpack compiler object
 */
WebpackAssetsManifest.prototype.apply = function(compiler)
{
  var self   = this;
  var output = path.resolve(compiler.context, this.output);

  compiler.plugin('compilation', function(compilation) {
    compilation.plugin('module-asset', function(module, hashedFile) {
      var file = path.join(path.dirname(hashedFile), path.basename(module.userRequest));
      self.moduleAssets[ file ] = hashedFile;
    });
  });

  if (this.emit) {

    compiler.plugin('emit', this.handleEmit.bind(this, compiler, output) );

  } else {

    compiler.plugin('done', this.handleDone.bind(this, output) );

  }
};

module.exports = WebpackAssetsManifest;
