/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */

'use strict';

const fs    = require('fs');
const url   = require('url');
const path  = require('path');
const merge = require('lodash.merge');
const keys  = require('lodash.keys');
const pick  = require('lodash.pick');
const get   = require('lodash.get');
const has   = require('lodash.has');
const chalk = require('chalk');
const EventEmitter = require('events');
const CompilationAsset = require('./CompilationAsset');

const isMerging = Symbol('isMerging');

class WebpackAssetsManifest extends EventEmitter
{
  /**
   * @param {object} options - configuration options
   * @constructor
   */
  constructor(options)
  {
    super();

    options = options || Object.create(null);

    const defaults = {
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

    [ 'apply', 'moduleAsset', 'processAssets', 'done' ].forEach( key => {
      if ( options[ key ] ) {
        this.on(key, options[ key ]);
      }
    }, this);
  }

  get isMerging()
  {
    return this[ isMerging ] || false;
  }

  /**
   * Get the file extension.
   *
   * @param  {string} filename
   * @return {string}
   */
  getExtension(filename)
  {
    if (! filename) {
      return '';
    }

    filename = filename.split(/[?#]/)[0];

    if (this.options.fileExtRegex) {
      const ext = filename.match(this.options.fileExtRegex);

      return ext && ext.length ? ext[ 0 ] : '';
    }

    return path.extname(filename);
  }

  /**
   * Get JSON data from compilation stats.
   *
   * @param  {object} stats - compilation stats
   * @throws {TypeError} If stats is not an object
   * @return {object}
   */
  getStatsData(stats)
  {
    if (typeof stats !== 'object') {
      throw new TypeError('stats must be an object');
    }

    return this.stats = stats.toJson('verbose');
  }

  /**
   * Replace backslash with forward slash
   *
   * @return {string}
   */
  fixKey(key)
  {
    return key.replace( /\\/g, '/' );
  }

  /**
   * Determine if the filename matches the HMR filename pattern
   *
   * @return {boolean}
   */
  isHMR(filename)
  {
    return this.hmrRegex ? this.hmrRegex.test( filename ) : false;
  }

  /**
   * Add item to assets
   *
   * @param {string} key
   * @param {string} value
   * @return {object} this
   */
  set(key, value)
  {
    if ( this.isMerging && this.options.merge !== 'customize' ) {
      this.assets[ key ] = value;
      return this;
    }

    const originalValue = value;
    value = this.getPublicPath( value );

    if ( this.options.customize && typeof this.options.customize === 'function' ) {
      const custom = this.options.customize( key, value, originalValue, this );

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
  }

  /**
   * Does an item exist in assets?
   *
   * @param {string} key
   * @return {boolean}
   */
  has(key)
  {
    return has(this.assets, key) || has(this.assets, this.fixKey(key));
  }

  /**
   * Get item from assets
   *
   * @param {string} key
   * @param {string} defaultValue
   * @return {*}
   */
  get(key, defaultValue)
  {
    return this.has(key) ? this.assets[ this.fixKey(key) ] : defaultValue || '';
  }

  /**
   * Delete item from assets
   *
   * @param {string} key
   */
  delete(key)
  {
    delete this.assets[ this.fixKey(key) ];
  }

  /**
   * Process compilation assets.
   *
   * @param  {object} assets - assets by chunk name
   * @return {object}
   */
  processAssets(assets)
  {
    const keys = Object.keys(assets);
    let index = keys.length;

    while ( index-- ) {
      const name = keys[ index ];
      let filenames = assets[ name ];

      if ( ! Array.isArray( filenames ) ) {
        filenames = [ filenames ];
      }

      for ( let i = 0, l = filenames.length; i < l ; ++i ) {
        const filename = name + this.getExtension( filenames[ i ] );

        if ( this.isHMR( filenames[ i ] ) ) {
          continue;
        }

        this.set( filename, filenames[ i ] );
      }
    }

    this.emit('processAssets', this, assets);

    return this.assets;
  }

  /**
   * Get the data for JSON.stringify
   *
   * @return {object}
   */
  toJSON()
  {
    if ( this.options.sortManifest ) {
      const keys = Object.keys(this.assets);

      if ( typeof this.options.sortManifest === 'function' ) {
        keys.sort( this.options.sortManifest.bind(this) );
      } else {
        keys.sort();
      }

      return keys.reduce(
        (sorted, key) => (sorted[ key ] = this.assets[ key ], sorted),
        Object.create(null)
      );
    }

    return this.assets;
  }

  /**
   * JSON.stringify the manifest
   *
   * @return {string}
   */
  toString()
  {
    return JSON.stringify(this, this.options.replacer, this.options.space) || '{}';
  }

  /**
   * Merge data if the output file already exists
   */
  maybeMerge()
  {
    if ( this.options.merge ) {
      try {
        this[ isMerging ] = true;

        const data = JSON.parse(fs.readFileSync(this.getOutputPath()));

        for ( const key in data ) {
          if ( ! this.has(key) ) {
            this.set(key, data[ key ]);
          }
        }
      } catch (err) { // eslint-disable-line
      } finally {
        delete this[ isMerging ];
      }
    }
  }

  /**
   * Return an item from an array if it matches the file extension
   *
   * @param  {array} files
   * @param  {string} ext
   * @param  {string} defaultValue
   * @return {string}
   */
  pickFileByExtension(files, ext, defaultValue)
  {
    return files.reduce( (val, file) => ext === this.getExtension(file) ? file : val, defaultValue );
  }

  /**
   * Process an item from `compilation.entries`
   *
   * @param  {object} compilation
   * @param  {object} mod
   */
  processCompilationEntry(compilation, mod)
  {
    if ( mod.userRequest ) {
      const key = path.relative(this.compiler.context, mod.userRequest);

      const firstChunk = mod.getChunks ? mod.getChunks().shift() : mod.chunks[0];

      let value = compilation.getPath( this.compiler.options.output.filename, {
        chunk: firstChunk,
        filename: key,
      });

      value = this.pickFileByExtension(
        firstChunk.files,
        this.getExtension(key),
        value
      );

      this.set(key, value);
    }
  }

  /**
   * Process `compilation.entries`
   *
   * @param  {object} compilation
   */
  processCompilationEntries(compilation)
  {
    compilation.entries.forEach( this.processCompilationEntry.bind(this, compilation) );
  }

  /**
   * Handle the `emit` event
   *
   * @param  {object} compilation - the Webpack compilation object
   * @param  {Function} callback
   */
  handleEmit(compilation, callback)
  {
    if ( this.options.contextRelativeKeys ) {
      this.processCompilationEntries(compilation);
    }

    this.processAssets(this.getStatsData(compilation.getStats()).assetsByChunkName);

    this.maybeMerge();

    let output = this.inDevServer() ?
      path.basename( this.getOutputPath() ) :
      path.relative( this.compiler.outputPath, this.getOutputPath() );

    output = compilation.getPath( output, { chunk: { name: 'manifest' }, filename: 'manifest.json' } );

    compilation.assets[ output ] = new CompilationAsset(this);

    callback();
  }

  /**
   * Handle the `after-emit` event
   *
   * @param  {object} compilation - the Webpack compilation object
   * @param  {Function} callback
   */
  handleAfterEmit(compilation, callback)
  {
    if ( ! this.options.writeToDisk ) {
      callback();
      return;
    }

    const output = this.getOutputPath();

    require('mkdirp')(
      path.dirname(output),
      () => {
        fs.writeFile(
          output,
          this.toString(),
          () => {
            callback();
          }
        );
      }
    );
  }

  /**
   * Handle module assets
   *
   * @param  {object} module
   * @param  {string} hashedFile
   */
  handleModuleAsset(module, hashedFile)
  {
    let key = path.join(path.dirname(hashedFile), path.basename(module.userRequest));

    if ( this.isHMR( hashedFile ) ) {
      return;
    }

    if ( this.options.contextRelativeKeys ) {
      key = path.relative(this.compiler.context, module.userRequest);
    }

    this.set(key, hashedFile);

    this.emit('moduleAsset', this, key, hashedFile, module);
  }

  /**
   * Hook into the compilation object
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  handleCompilation(compilation)
  {
    compilation.plugin('module-asset', this.handleModuleAsset.bind(this));
  }

  /**
   * Determine if webpack-dev-server is being used
   *
   * @return {boolean}
   */
  inDevServer()
  {
    if ( process.argv.some( arg => arg.includes('webpack-dev-server') ) ) {
      return true;
    }

    return !!this.compiler && this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem';
  }

  /**
   * Get the file system path to the manifest
   *
   * @return {string} path to manifest file
   */
  getOutputPath()
  {
    if ( ! this.compiler ) {
      return '';
    }

    if ( path.isAbsolute( this.options.output ) ) {
      return this.options.output;
    }

    if ( this.inDevServer() ) {
      let outputPath = get( this, 'compiler.options.devServer.outputPath', get( this, 'compiler.outputPath', '/' ) );

      if( outputPath === '/' ) {
        console.warn( chalk.cyan('Webpack Assets Manifest: Please use an absolute path in options.output when using webpack-dev-server.') );
        outputPath = get( this, 'compiler.context', process.cwd() );
      }

      return path.resolve( outputPath, this.options.output );
    }

    return path.resolve( this.compiler.outputPath, this.options.output );
  }

  /**
   * Get the public path for the filename
   *
   * @param  {string} filePath
   */
  getPublicPath(filename)
  {
    const publicPath = this.options.publicPath;

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
  }

  /**
   * Hook into the Webpack compiler
   *
   * @param  {object} compiler - the Webpack compiler object
   */
  apply(compiler)
  {
    const output = compiler.options.output;

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
  }
}

module.exports = WebpackAssetsManifest;
