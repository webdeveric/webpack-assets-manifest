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
    emit: true,
    fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
    sortManifest: true
  };

  options = pick(
    merge({}, defaults, options || {}),
    keys(defaults)
  );

  merge(this, options);

  this.moduleAssets = Object.create(null);
}

/**
 * Get the file extension.
 *
 * @param  {string} filename
 * @return {string}
 */
WebpackAssetsManifest.prototype.getExtension = function(filename)
{
  if (! filename) {
    return '';
  }

  filename = filename.split(/[?#]/)[0];

  if (this.fileExtRegex) {
    var ext = filename.match(this.fileExtRegex);

    return ext && ext.length ? ext[ 0 ] : '';
  }

  return path.extname(filename);
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
  var keys = Object.keys(assets);
  var index = keys.length;

  while ( index-- ) {
    var name = keys[ index ];
    var filenames = assets[ name ];

    if ( ! Array.isArray( filenames ) ) {
      filenames = [ filenames ];
    }

    for ( var i = 0, l = filenames.length; i < l ; ++i ) {
      var filename = name + this.getExtension( filenames[ i ] );
      this.moduleAssets[ filename ] = filenames[ i ];
    }
  }

  return this.moduleAssets;
};

/**
 * Get the data
 *
 * @return {object}
 */
WebpackAssetsManifest.prototype.getData = function()
{
  if ( this.sortManifest ) {
    var keys = Object.keys(this.moduleAssets);

    if ( typeof this.sortManifest === 'function' ) {
      keys.sort( this.sortManifest.bind(this) );
    } else {
      keys.sort();
    }

    return keys.reduce(function (sorted, key) {
      sorted[ key ] = this.moduleAssets[ key ];
      return sorted;
    }.bind(this), Object.create(null));
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
  return JSON.stringify(this.getData(), this.replacer, this.space);
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
