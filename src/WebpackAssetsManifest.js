/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */

'use strict';

const fs    = require('fs');
const url   = require('url');
const path  = require('path');
const get   = require('lodash.get');
const has   = require('lodash.has');
const crypto = require('crypto');
const { RawSource } = require('webpack-sources');
const { maybeArrayWrap, getSRIHash, warn } = require('./helpers.js');

const isMerging = Symbol('isMerging');
const PLUGIN_NAME = 'WebpackAssetsManifest';

class WebpackAssetsManifest
{
  /**
   * @param {object} options - configuration options
   * @constructor
   */
  constructor(options = {})
  {
    this.options = Object.assign(
      {
        output: 'manifest.json',
        replacer: null,
        space: 2,
        writeToDisk: false,
        fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
        sortManifest: true,
        merge: false,
        publicPath: null,
        customize: null, // customize( key, value, originalValue, manifest, currentAsset )
        done: null, // done( stats, manifest )
        entrypoints: false,
        entrypointsKey: 'entrypoints',
        // https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
        integrity: false,
        integrityHashes: [
          'sha256',
          'sha384',
          'sha512',
        ],
      },
      options
    );

    if ( this.options.hasOwnProperty('contextRelativeKeys') ) {
      warn('contextRelativeKeys has been removed. Please use customize() instead.');
    }

    this.options.integrityHashes = maybeArrayWrap(this.options.integrityHashes).filter( hash => {
      if ( ! crypto.getHashes().includes(hash) ) {
        warn(`${hash} is not a supported hash algorithm`);
        return false;
      }

      return true;
    });

    // This is what gets JSON stringified
    this.assets = options.assets || Object.create(null);

    // hashed filename : original filename
    this.assetNames = new Map();

    // This is passed to the customize() option
    this.currentAsset = null;

    // The Webpack compiler instance
    this.compiler = null;

    // compilation stats
    this.stats = null;

    // This is used to identify hot module replacement files
    this.hmrRegex = null;
  }

  /**
   * @return {boolean}
   */
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
    if (! filename || typeof filename !== 'string') {
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
      const custom = this.options.customize( key, value, originalValue, this, this.currentAsset );

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
  get(key, defaultValue = '')
  {
    return this.has(key) ? this.assets[ this.fixKey(key) ] : defaultValue;
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
  processAssetsByChunkName(assets)
  {
    Object.keys(assets).forEach( chunkName => {
      maybeArrayWrap( assets[ chunkName ] )
        .filter( f => ! this.isHMR(f) ) // Remove hot module replacement files
        .forEach( filename => {
          this.assetNames.set( filename, chunkName + this.getExtension( filename ) );
        });
    });

    return this.assetNames;
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
   * @param {object} entrypoints from a compilation
   */
  getEntrypointFilesGroupedByExtension( entrypoints )
  {
    const files = Object.create(null);

    for( const [ name, entrypoint ] of entrypoints ) {
      entrypoint.getFiles().reduce( (files, file) => {
        const ext = this.getExtension(file).replace(/^\.+/, '').toLowerCase();

        files[ name ] = files[ name ] || Object.create(null);
        files[ name ][ ext ] = files[ name ][ ext ] || [];
        files[ name ][ ext ].push(file);

        return files;
      }, files );
    }

    return files;
  }

  /**
   * Handle the `emit` event
   *
   * @param  {object} compilation - the Webpack compilation object
   * @param  {Function} callback
   */
  handleEmit(compilation, callback)
  {
    this.stats = compilation.getStats().toJson();

    this.processAssetsByChunkName( this.stats.assetsByChunkName );

    for ( const [ hashedFile, filename ] of this.assetNames ) {
      this.currentAsset = compilation.assets[ hashedFile ];

      // `integrity` may have already been set by another plugin, like `webpack-subresource-integrity`.
      // Only generate the SRI hash if `integrity` is not found.
      if ( this.options.integrity && ! this.currentAsset.integrity ) {
        this.currentAsset.integrity = getSRIHash( this.options.integrityHashes, this.currentAsset.source() );
      }

      this.set( filename, hashedFile );

      const manifestEntry = this.assets[ filename ];

      if ( typeof manifestEntry === 'string' && this.options.integrity ) {
        this.assets[ filename ] = {
          src: manifestEntry,
          integrity: this.currentAsset.integrity,
        };
      }
    }

    this.currentAsset = null;

    this.maybeMerge();

    const output = this.getManifestPath(
      compilation,
      this.inDevServer() ?
        path.basename( this.getOutputPath() ) :
        path.relative( compilation.compiler.outputPath, this.getOutputPath() )
    );

    if ( this.options.entrypoints ) {
      const epFiles = this.getEntrypointFilesGroupedByExtension( compilation.entrypoints );

      if ( this.options.entrypointsKey ) {
        this.set(this.options.entrypointsKey, epFiles);
      } else {
        for ( const key in epFiles ) {
          this.set( key, epFiles[ key ] );
        }
      }
    }

    compilation.assets[ output ] = new RawSource(this.toString());

    callback();
  }

  getManifestPath(compilation, filename)
  {
    return compilation.getPath( filename, { chunk: { name: 'manifest', }, filename: 'manifest.json' } );
  }

  /**
   * Write to disk using `fs`.
   *
   * This is likely only needed if you're using webpack-dev-server
   * and you don't want to keep the manifest file only in memory.
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  handleAfterEmit(compilation) // eslint-disable-line
  {
    if ( ! this.options.writeToDisk ) {
      return Promise.resolve();
    }

    return new Promise( (resolve, reject) => {
      const output = this.getManifestPath( compilation, this.getOutputPath() );

      require('mkdirp')(
        path.dirname(output),
        err => {
          if ( err ) {
            reject( err );
            return;
          }

          fs.writeFile( output, this.toString(), resolve );
        }
      );
    });
  }

  /**
   * Handle module assets
   *
   * @param  {object} compilation
   * @param  {object} module
   * @param  {string} hashedFile
   */
  handleModuleAsset(compilation, module, hashedFile)
  {
    if ( this.isHMR( hashedFile ) ) {
      return;
    }

    const filename = path.join(
      path.dirname(hashedFile),
      path.basename(module.userRequest)
    );

    this.assetNames.set(hashedFile, filename);
  }

  /**
   * Hook into the compilation object
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  handleCompilation(compilation)
  {
    compilation.hooks.moduleAsset.tap(PLUGIN_NAME, this.handleModuleAsset.bind(this, compilation));
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
        warn.once('Please use an absolute path in options.output when using webpack-dev-server.');
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
    if ( typeof filename === 'string' ) {
      const publicPath = this.options.publicPath;

      if ( typeof publicPath === 'function' ) {
        return publicPath( filename, this );
      }

      if ( typeof publicPath === 'string' ) {
        return url.resolve( publicPath, filename );
      }

      if ( publicPath === true ) {
        return url.resolve(
          get( this, 'compiler.options.output.publicPath', '' ),
          filename
        );
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
    this.compiler = compiler;

    const { output: { filename, hotUpdateChunkFilename } } = compiler.options;

    if ( filename !== hotUpdateChunkFilename && typeof hotUpdateChunkFilename === 'string' ) {
      this.hmrRegex = new RegExp(
        hotUpdateChunkFilename
          .replace(/\./g, '\\.')
          .replace(/\[[a-z]+(:\d+)?\]/gi, (m, n) => (n ? `.{${n.substr(1)}}` : '.+')) + '$',
        'i'
      );
    }

    // compilation.assets contains the results of the build
    compiler.hooks.compilation.tap(PLUGIN_NAME, this.handleCompilation.bind(this));

    // Add manifest.json to compiler.assets
    compiler.hooks.emit.tapAsync(PLUGIN_NAME, this.handleEmit.bind(this));

    // Use fs to write the manifest.json to disk
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, this.handleAfterEmit.bind(this));

    // Call user provided `done` callback
    if ( typeof this.options.done === 'function' ) {
      compiler.hooks.done.tap(PLUGIN_NAME, stats => this.options.done(stats, this) );
    }
  }
}

module.exports = WebpackAssetsManifest;
