/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */

'use strict';

var fs    = require('fs');
var url   = require('url');
var path  = require('path');
var util  = require('util');
var merge = require('lodash.merge');
var keys  = require('lodash.keys');
var pick  = require('lodash.pick');
var find  = require('lodash.find');
var get   = require('lodash.get');
var has   = require('lodash.has');
var chalk = require('chalk');
var EventEmitter = require('events');
var CompilationAsset = require('./CompilationAsset');

/**
 * @param {object} options - configuration options
 * @constructor
 */
function WebpackAssetsManifest(options)
{
  EventEmitter.call(this);

  options = options || Object.create(null);

  var defaults = {
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
  };

  this.options = pick(
    merge({}, defaults, options),
    keys(defaults)
  );

  if ( has(options, 'emit') && ! has(options, 'writeToDisk') ) {
    console.warn( chalk.cyan('Webpack Assets Manifest: options.emit is deprecated - use options.writeToDisk instead') );
    this.options.writeToDisk = ! options.emit;
  }

  this.assets = options.assets || Object.create(null);
  this.compiler = null;
  this.stats = null;
  this.hmrRegex = null;

  [ 'apply', 'moduleAsset', 'processAssets', 'done' ].forEach( function(key) {
    if ( options[ key ] ) {
      this.on(key, options[ key ]);
    }
  }, this);
}

util.inherits(WebpackAssetsManifest, EventEmitter);

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

  if (this.options.fileExtRegex) {
    var ext = filename.match(this.options.fileExtRegex);

    return ext && ext.length ? ext[ 0 ] : '';
  }

  return path.extname(filename);
};

/**
 * Get JSON data from compilation stats.
 *
 * @param  {object} stats - compilation stats
 * @throws {TypeError} If stats is not an object
 * @return {object}
 */
WebpackAssetsManifest.prototype.getStatsData = function(stats)
{
  if (typeof stats !== 'object') {
    throw new TypeError('stats must be an object');
  }

  return this.stats = stats.toJson('verbose');
};

/**
 * Replace backslash with forward slash
 *
 * @return {string}
 */
WebpackAssetsManifest.prototype.fixKey = function(key)
{
  return key.replace( /\\/g, '/' );
};

/**
 * Determine if the filename matches the HMR filename pattern
 *
 * @return {boolean}
 */
WebpackAssetsManifest.prototype.isHMR = function(filename)
{
  return this.hmrRegex ? this.hmrRegex.test( filename ) : false;
};

/**
 * Add item to assets
 *
 * @param {string} key
 * @param {string} value
 * @return {object} this
 */
WebpackAssetsManifest.prototype.set = function(key, value)
{
  var originalValue = value;
  value = this.getPublicPath( value );

  if ( this.options.customize && typeof this.options.customize === 'function' ) {
    var custom = this.options.customize( key, value, originalValue, this );

    if ( custom === false ) {
      return this;
    }

    if ( typeof custom === 'object' ) {
      if ( has(custom, 'key') ) {
        key = custom.key;
      }

      if ( has(custom, 'value') ) {
        value = custom.value;
      }
    }
  }

  this.assets[ this.fixKey(key) ] = value;

  return this;
};

/**
 * Does an item exist in assets?
 *
 * @param {string} key
 * @return {boolean}
 */
WebpackAssetsManifest.prototype.has = function(key)
{
  return has(this.assets, this.fixKey(key));
};

/**
 * Get item from assets
 *
 * @param {string} key
 * @param {string} defaultValue
 * @return {*}
 */
WebpackAssetsManifest.prototype.get = function(key, defaultValue)
{
  return this.has(key) ? this.assets[ this.fixKey(key) ] : defaultValue || '';
};

/**
 * Delete item from assets
 *
 * @param {string} key
 */
WebpackAssetsManifest.prototype.delete = function(key)
{
  delete this.assets[ this.fixKey(key) ];
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

      if ( this.isHMR( filenames[ i ] ) ) {
        continue;
      }

      this.set( filename, filenames[ i ] );
    }
  }

  this.emit('processAssets', this, assets);

  return this.assets;
};

/**
 * Get the data for JSON.stringify
 *
 * @return {object}
 */
WebpackAssetsManifest.prototype.toJSON = function()
{
  if ( this.options.sortManifest ) {
    var keys = Object.keys(this.assets);

    if ( typeof this.options.sortManifest === 'function' ) {
      keys.sort( this.options.sortManifest.bind(this) );
    } else {
      keys.sort();
    }

    return keys.reduce(function (sorted, key) {
      sorted[ key ] = this.assets[ key ];
      return sorted;
    }.bind(this), Object.create(null));
  }

  return this.assets;
};

/**
 * JSON.stringify the manifest
 *
 * @return {string}
 */
WebpackAssetsManifest.prototype.toString = function()
{
  return JSON.stringify(this, this.options.replacer, this.options.space) || '{}';
};

/**
 * Merge data if the output file already exists
 */
WebpackAssetsManifest.prototype.maybeMerge = function()
{
  if ( this.options.merge ) {
    try {
      var data = JSON.parse(fs.readFileSync(this.getOutputPath()));

      for ( var key in data ) {
        if ( ! this.has(key) ) {
          this.set(key, data[ key ]);
        }
      }
    } catch (err) { // eslint-disable-line
    }
  }
};

/**
 * Return an item from an array if it matches the file extension
 *
 * @param  {array} files
 * @param  {string} ext
 * @param  {string} defaultValue
 * @return {string}
 */
WebpackAssetsManifest.prototype.pickFileByExtension = function(files, ext, defaultValue)
{
  return files.reduce( function(val, file) {
    return ext === this.getExtension(file) ? file : val;
  }.bind(this), defaultValue );
};

/**
 * Process an item from `compilation.entries`
 *
 * @param  {object} compilation
 * @param  {object} mod
 */
WebpackAssetsManifest.prototype.processCompilationEntry = function(compilation, mod)
{
  if ( mod.userRequest ) {
    var key = path.relative(this.compiler.context, mod.userRequest);

    var value = compilation.getPath( this.compiler.options.output.filename, {
      chunk: mod.chunks[0],
      filename: key,
    });

    value = this.pickFileByExtension(
      mod.chunks[0].files,
      this.getExtension(key),
      value
    );

    this.set(key, value);
  }
};

/**
 * Process `compilation.entries`
 *
 * @param  {object} compilation
 */
WebpackAssetsManifest.prototype.processCompilationEntries = function(compilation)
{
  compilation.entries.forEach( this.processCompilationEntry.bind(this, compilation) );
};

/**
 * Handle the `emit` event
 *
 * @param  {object} compilation - the Webpack compilation object
 * @param  {Function} callback
 */
WebpackAssetsManifest.prototype.handleEmit = function(compilation, callback)
{
  if ( this.options.contextRelativeKeys ) {
    this.processCompilationEntries(compilation);
  }

  this.processAssets(this.getStatsData(compilation.getStats()).assetsByChunkName);

  this.maybeMerge();

  var output = this.inDevServer() ?
    path.basename( this.getOutputPath() ) :
    path.relative( this.compiler.outputPath, this.getOutputPath() );

  output = compilation.getPath( output, { chunk: { name: 'manifest' }, filename: 'manifest.json' } );

  compilation.assets[ output ] = new CompilationAsset(this);

  callback();
};

/**
 * Handle the `after-emit` event
 *
 * @param  {object} compilation - the Webpack compilation object
 * @param  {Function} callback
 */
WebpackAssetsManifest.prototype.handleAfterEmit = function(compilation, callback)
{
  if ( ! this.options.writeToDisk ) {
    callback();
    return;
  }

  var output = this.getOutputPath();

  require('mkdirp')(
    path.dirname(output),
    function(/* err */) {
      fs.writeFile(
        output,
        this.toString(),
        function(/* err */) {
          callback();
        }.bind(this)
      );
    }.bind(this)
  );
};

/**
 * Handle module assets
 *
 * @param  {object} module
 * @param  {string} hashedFile
 */
WebpackAssetsManifest.prototype.handleModuleAsset = function(module, hashedFile)
{
  var key = path.join(path.dirname(hashedFile), path.basename(module.userRequest));

  if ( this.isHMR( hashedFile ) ) {
    return;
  }

  if ( this.options.contextRelativeKeys ) {
    key = path.relative(this.compiler.context, module.userRequest);
  }

  this.set(key, hashedFile);

  this.emit('moduleAsset', this, key, hashedFile, module);
};

/**
 * Hook into the compilation object
 *
 * @param  {object} compilation - the Webpack compilation object
 */
WebpackAssetsManifest.prototype.handleCompilation = function(compilation)
{
  compilation.plugin('module-asset', this.handleModuleAsset.bind(this));
};

/**
 * Determine if webpack-dev-server is being used
 *
 * @return {boolean}
 */
WebpackAssetsManifest.prototype.inDevServer = function()
{
  if ( find( process.argv, function(arg) { return arg.lastIndexOf('webpack-dev-server') > -1; } ) ) {
    return true;
  }

  return !!this.compiler && this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem';
};

/**
 * Get the file system path to the manifest
 *
 * @return {string} path to manifest file
 */
WebpackAssetsManifest.prototype.getOutputPath = function()
{
  if ( ! this.compiler ) {
    return '';
  }

  if ( path.isAbsolute( this.options.output ) ) {
    return this.options.output;
  }

  if ( this.inDevServer() ) {
    var outputPath = get( this, 'compiler.options.devServer.outputPath', get( this, 'compiler.outputPath', '/' ) );

    if( outputPath === '/' ) {
      console.warn( chalk.cyan('Webpack Assets Manifest: Please use an absolute path in options.output when using webpack-dev-server.') );
      outputPath = get( this, 'compiler.context', process.cwd() );
    }

    return path.resolve( outputPath, this.options.output );
  }

  return path.resolve( this.compiler.outputPath, this.options.output );
};

/**
 * Get the public path for the filename
 *
 * @param  {string} filePath
 */
WebpackAssetsManifest.prototype.getPublicPath = function(filename)
{
  var publicPath = this.options.publicPath;

  if ( typeof publicPath === 'function' ) {
    return publicPath( filename, this );
  }

  if ( typeof filename === 'string' ) {
    if ( typeof publicPath === 'string' ) {
      return url.resolve( publicPath, filename );
    }

    if ( publicPath === true ) {
      return url.resolve( this.compiler.options.output.publicPath, filename );
    }
  }

  return filename;
};

/**
 * Hook into the Webpack compiler
 *
 * @param  {object} compiler - the Webpack compiler object
 */
WebpackAssetsManifest.prototype.apply = function(compiler)
{
  var output = compiler.options.output;

  this.compiler = compiler;

  if ( output.filename !== output.hotUpdateChunkFilename ) {
    this.hmrRegex = new RegExp(
      output.hotUpdateChunkFilename
        .replace(/\./g, '\\.')
        .replace( /\[[a-z]+(:\d+)?\]/gi, function(m, n) {
          return '.' + ( n ? '{' + n.substr(1) + '}' : '+' );
        }) + '$',
      'i'
    );
  }

  compiler.plugin('compilation', this.handleCompilation.bind(this));
  compiler.plugin('emit', this.handleEmit.bind(this));
  compiler.plugin('after-emit', this.handleAfterEmit.bind(this));
  compiler.plugin('done', this.emit.bind(this, 'done', this));

  this.emit('apply', this);
};

module.exports = WebpackAssetsManifest;
