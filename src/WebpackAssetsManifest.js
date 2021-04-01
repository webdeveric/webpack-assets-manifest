/**
 * Webpack Assets Manifest
 *
 * @author Eric King <eric@webdeveric.com>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const get = require('lodash.get');
const has = require('lodash.has');
const { validate } = require('schema-utils');
const { AsyncSeriesHook, SyncHook, SyncWaterfallHook } = require('tapable');
const { Compilation, NormalModule, sources: { RawSource } } = require('webpack');

const {
  maybeArrayWrap,
  filterHashes,
  getSRIHash,
  warn,
  varType,
  isObject,
  getSortedObject,
  templateStringToRegExp,
  group,
  findMapKeysByValue,
  lock,
  unlock,
  lockSync,
  unlockSync,
} = require('./helpers.js');

/** @type {object} */
const optionsSchema = require('./options-schema.json');

const IS_MERGING = Symbol('isMerging');
const PLUGIN_NAME = 'WebpackAssetsManifest';

class WebpackAssetsManifest
{
  /**
   * @param {object} options - configuration options
   * @constructor
   */
  constructor(options = {})
  {
    /**
     * This is using hooks from {@link https://github.com/webpack/tapable Tapable}.
     */
    this.hooks = Object.freeze({
      apply: new SyncHook([ 'manifest' ]),
      customize: new SyncWaterfallHook([ 'entry', 'original', 'manifest', 'asset' ]),
      transform: new SyncWaterfallHook([ 'assets', 'manifest' ]),
      done: new AsyncSeriesHook([ 'manifest', 'stats' ]),
      options: new SyncWaterfallHook([ 'options' ]),
      afterOptions: new SyncHook([ 'options' ]),
    });

    this.hooks.transform.tap(PLUGIN_NAME, assets => {
      const { sortManifest } = this.options;

      return sortManifest ? getSortedObject(
        assets,
        typeof sortManifest === 'function' ? sortManifest.bind(this) : undefined,
      ) : assets;
    });

    this.hooks.afterOptions.tap(PLUGIN_NAME, options => {
      this.options = Object.assign( this.defaultOptions, options );
      this.options.integrityHashes = filterHashes( this.options.integrityHashes );

      validate(optionsSchema, this.options, { name: PLUGIN_NAME });

      this.options.output = path.normalize( this.options.output );

      // Copy over any entries that may have been added to the manifest before apply() was called.
      // If the same key exists in assets and options.assets, options.assets should be used.
      this.assets = Object.assign(this.options.assets, this.assets, this.options.assets);

      [ 'apply', 'customize', 'transform', 'done' ].forEach( hookName => {
        if ( typeof this.options[ hookName ] === 'function' ) {
          this.hooks[ hookName ].tap(`${PLUGIN_NAME}.option.${hookName}`, this.options[ hookName ] );
        }
      });
    });

    this.options = Object.assign( this.defaultOptions, options );

    // This is what gets JSON stringified
    this.assets = this.options.assets;

    // original filename : hashed filename
    this.assetNames = new Map();

    // This is passed to the customize() hook
    this.currentAsset = null;

    // The Webpack compiler instance
    this.compiler = null;

    // This is used to identify hot module replacement files
    this.hmrRegex = null;

    // Is a merge happening?
    this[ IS_MERGING ] = false;
  }

  /**
   * Hook into the Webpack compiler
   *
   * @param  {object} compiler - The Webpack compiler object
   */
  apply(compiler)
  {
    if ( ! this.options.enabled ) {
      return;
    }

    this.compiler = compiler;

    // Allow hooks to modify options
    this.options = this.hooks.options.call(this.options);

    // Ensure options contain defaults and are valid
    this.hooks.afterOptions.call(this.options);

    const { output: { filename, hotUpdateChunkFilename } } = compiler.options;

    if ( filename !== hotUpdateChunkFilename && typeof hotUpdateChunkFilename === 'string' ) {
      this.hmrRegex = templateStringToRegExp( hotUpdateChunkFilename, 'i' );
    }

    compiler.hooks.watchRun.tap(PLUGIN_NAME, this.handleWatchRun.bind(this));

    compiler.hooks.compilation.tap(PLUGIN_NAME, this.handleCompilation.bind(this));

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, this.handleThisCompilation.bind(this));

    // Use fs to write the manifest.json to disk if `options.writeToDisk` is true
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, this.handleAfterEmit.bind(this));

    // The compilation has finished
    compiler.hooks.done.tapPromise(PLUGIN_NAME, async stats => await this.hooks.done.promise(this, stats) );

    // Setup is complete.
    this.hooks.apply.call(this);
  }

  /**
   * Get the default options.
   *
   * @return {object}
   */
  get defaultOptions()
  {
    return {
      enabled: true,
      assets: Object.create(null),
      output: 'assets-manifest.json',
      replacer: null, // Its easier to use the transform hook instead.
      space: 2,
      writeToDisk: 'auto',
      fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
      sortManifest: true,
      merge: false,
      publicPath: null,
      contextRelativeKeys: false,

      // Hooks
      apply: null,     // After setup is complete
      customize: null, // Customize each entry in the manifest
      transform: null, // Transform the entire manifest
      done: null,      // Compilation is done and the manifest has been written

      // Include `compilation.entrypoints` in the manifest file
      entrypoints: false,
      entrypointsKey: 'entrypoints',
      entrypointsUseAssets: false,

      // https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
      integrity: false,
      integrityHashes: [ 'sha256', 'sha384', 'sha512' ],
      integrityPropertyName: 'integrity',
    };
  }

  /**
   * Determine if the manifest data is currently being merged.
   *
   * @return {boolean}
   */
  get isMerging()
  {
    return this[ IS_MERGING ];
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

    filename = filename.split(/[?#]/)[ 0 ];

    if (this.options.fileExtRegex) {
      const ext = filename.match(this.options.fileExtRegex);

      return ext && ext.length ? ext[ 0 ] : '';
    }

    return path.extname(filename);
  }

  /**
   * Replace backslash with forward slash.
   *
   * @return {string}
   */
  fixKey(key)
  {
    return typeof key === 'string' ? key.replace( /\\/g, '/' ) : key;
  }

  /**
   * Determine if the filename matches the HMR filename pattern.
   *
   * @return {boolean}
   */
  isHMR(filename)
  {
    return this.hmrRegex ? this.hmrRegex.test( filename ) : false;
  }

  /**
   * Add item to assets without modifying the key or value.
   *
   * @param {string} key
   * @param {any} value
   * @return {object} this
   */
  setRaw(key, value)
  {
    this.assets[ key ] = value;

    return this;
  }

  /**
   * Add an item to the manifest.
   *
   * @param {string} key
   * @param {any} value
   * @return {object} this
   */
  set(key, value)
  {
    if ( this.isMerging && this.options.merge !== 'customize' ) {
      // Do not fix the key if merging since it should already be correct.
      return this.setRaw(key, value);
    }

    const fixedKey = this.fixKey(key);
    const publicPath = this.getPublicPath( value );

    const entry = this.hooks.customize.call(
      {
        key: fixedKey,
        value: publicPath,
      },
      {
        key,
        value,
      },
      this,
      this.currentAsset,
    );

    // Allow the entry to be skipped
    if ( entry === false ) {
      return this;
    }

    // Use the customized values
    if ( isObject( entry ) ) {
      let { key = fixedKey, value = publicPath } = entry;

      // If the integrity should be returned but the entry value was
      // not customized lets do that now so it includes both.
      if ( value === publicPath && this.options.integrity ) {
        value = {
          src: value,
          integrity: get(this, `currentAsset.info.${this.options.integrityPropertyName}`, ''),
        };
      }

      return this.setRaw( key, value );
    }

    warn.once(`Unexpected customize() return type: ${varType(entry)}`);

    return this.setRaw( fixedKey, publicPath );
  }

  /**
   * Determine if an item exist in the manifest.
   *
   * @param {string} key
   * @return {boolean}
   */
  has(key)
  {
    return has(this.assets, key) || has(this.assets, this.fixKey(key));
  }

  /**
   * Get an item from the manifest.
   *
   * @param {string} key
   * @param {any} defaultValue
   * @return {*}
   */
  get(key, defaultValue = undefined)
  {
    return this.assets[ key ] || this.assets[ this.fixKey(key) ] || defaultValue;
  }

  /**
   * Delete an item from the manifest.
   *
   * @param {string} key
   * @return {boolean}
   */
  delete(key)
  {
    if ( has(this.assets, key) ) {
      return (delete this.assets[ key ]);
    }

    key = this.fixKey(key);

    if ( has(this.assets, key) ) {
      return (delete this.assets[ key ]);
    }

    return false;
  }

  /**
   * Process compilation assets.
   *
   * @param  {object} assets - Assets by chunk name
   * @return {object}
   */
  processAssetsByChunkName(assets)
  {
    Object.keys(assets).forEach( chunkName => {
      maybeArrayWrap( assets[ chunkName ] )
        .filter( f => ! this.isHMR(f) ) // Remove hot module replacement files
        .forEach( filename => {
          this.assetNames.set( chunkName + this.getExtension( filename ), filename );
        });
    });

    return this.assetNames;
  }

  /**
   * Get the data for `JSON.stringify()`.
   *
   * @return {object}
   */
  toJSON()
  {
    // This is the last chance to modify the data before the manifest file gets created.
    return this.hooks.transform.call(this.assets, this);
  }

  /**
   * `JSON.stringify()` the manifest.
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
        this[ IS_MERGING ] = true;

        const data = JSON.parse( fs.readFileSync( this.getOutputPath(), { encoding: 'utf8' } ) );

        const deepmerge = require('deepmerge');

        const arrayMerge = (destArray, srcArray) => srcArray;

        for ( const [ key, oldValue ] of Object.entries( data ) ) {
          if ( this.has( key ) ) {
            const currentValue = this.get(key);

            if ( isObject( oldValue ) && isObject( currentValue ) ) {
              const newValue = deepmerge( oldValue, currentValue, { arrayMerge });

              this.set( key, newValue );
            }
          } else {
            this.set( key, oldValue );
          }
        }
      } catch (err) { // eslint-disable-line
      } finally {
        this[ IS_MERGING ] = false;
      }
    }
  }

  /**
   * Emit the assets manifest
   *
   * @param {object} compilation
   */
  emitAssetsManifest(compilation)
  {
    const output = this.getManifestPath(
      compilation,
      this.inDevServer() ?
        path.basename( this.options.output ) :
        path.relative( compilation.compiler.outputPath, this.getOutputPath() ),
    );

    if ( this.options.merge ) {
      lockSync( output );
    }

    this.maybeMerge();

    compilation.emitAsset(
      output,
      new RawSource(this.toString(), false),
      {
        assetsManifest: true,
      },
    );

    if ( this.options.merge ) {
      unlockSync( output );
    }
  }

  /**
   * Record details of Asset Modules
   *
   * @param {*} compilation
   */
  handleProcessAssetsAnalyse( compilation /* , assets */ )
  {
    const { contextRelativeKeys } = this.options;

    for ( const chunk of compilation.chunks ) {
      const modules = compilation.chunkGraph.getChunkModulesIterableBySourceType(
        chunk,
        'asset',
      );

      if ( modules ) {
        for ( const module of modules ) {
          const { assetInfo, filename } = module.buildInfo;

          const info = Object.assign(
            {
              sourceFilename: path.relative( compilation.compiler.context, module.userRequest ),
            },
            assetInfo,
          );

          compilation.assetsInfo.set(filename, info);

          this.assetNames.set(
            contextRelativeKeys ?
              info.sourceFilename :
              path.join( path.dirname(filename), path.basename(module.userRequest) ),
            filename,
          );
        }
      }
    }
  }

  /**
   * When using webpack 5 persistent cache, loaderContext.emitFile sometimes doesn't
   * get called and so the asset names are not recorded. To work around this, lets
   * loops over the stats.assets and record the asset names.
   *
   * @param {Object[]} assets
   */
  processStatsAssets(assets)
  {
    const { contextRelativeKeys } = this.options;

    assets.forEach( asset => {
      if ( asset.name && asset.info.sourceFilename ) {
        this.assetNames.set(
          contextRelativeKeys ?
            asset.info.sourceFilename :
            path.join( path.dirname(asset.name), path.basename(asset.info.sourceFilename) ),
          asset.name,
        );
      }
    });
  }

  /**
   * Gather asset details
   *
   * @param {object} compilation
   */
  handleAfterProcessAssets( compilation /* , assets */ )
  {
    // Look in DefaultStatsPresetPlugin.js for options
    const stats = compilation.getStats().toJson({
      all: false,
      assets: true,
      cachedAssets: true,
      cachedModules: true,
      chunkGroups: this.options.entrypoints,
      chunkGroupChildren: this.options.entrypoints,
    });

    this.processStatsAssets( stats.assets );

    this.processAssetsByChunkName( stats.assetsByChunkName );

    const findAssetKeys = findMapKeysByValue( this.assetNames );

    const { contextRelativeKeys } = this.options;

    for ( const asset of compilation.getAssets() ) {
      if ( asset.info.assetsManifest ) {
        continue;
      }

      const sourceFilenames = findAssetKeys( asset.name );

      if ( ! sourceFilenames.length ) {
        const { sourceFilename } = asset.info;
        const name = sourceFilename ?
          ( contextRelativeKeys ? sourceFilename : path.basename( sourceFilename ) ) :
          asset.name;

        sourceFilenames.push( name );
      }

      sourceFilenames.forEach( key => {
        this.currentAsset = asset;

        this.set( key, asset.name );

        this.currentAsset = null;
      });
    }

    if ( this.options.entrypoints ) {
      const removeHMR = file => ! this.isHMR(file);
      const getExtensionGroup = file => this.getExtension(file).substring(1).toLowerCase();
      const getAssetOrFilename = file => {
        const asset = this.options.entrypointsUseAssets ?
          this.assets[ findAssetKeys( file ).pop() ] || this.assets[ file ] :
          undefined;

        return asset ? asset : this.getPublicPath( file );
      };

      const entrypoints = Object.create(null);

      for ( const [ name, entrypoint ] of compilation.entrypoints ) {
        entrypoints[ name ] = {
          assets: group(
            entrypoint.getFiles().filter( removeHMR ),
            getExtensionGroup,
            getAssetOrFilename,
          ),
        };

        // This contains preload and prefetch
        const { childAssets } = stats.namedChunkGroups[ name ];

        for ( const [ property, assets ] of Object.entries( childAssets ) ) {
          entrypoints[ name ][ property ] = group(
            assets.filter( removeHMR ),
            getExtensionGroup,
            getAssetOrFilename,
          );
        }
      }

      if ( this.options.entrypointsKey === false ) {
        for ( const key in entrypoints ) {
          this.setRaw( key, entrypoints[ key ] );
        }
      } else {
        this.setRaw( this.options.entrypointsKey, entrypoints );
      }
    }

    this.emitAssetsManifest(compilation);
  }

  /**
   * Get the parsed output path. [hash] is supported.
   *
   * @param  {object} compilation - the Webpack compilation object
   * @param  {string} filename
   * @return {string}
   */
  getManifestPath(compilation, filename)
  {
    return compilation.getPath( filename, { chunk: { name: 'assets-manifest' }, filename: 'assets-manifest.json' } );
  }

  /**
   * Write the asset manifest to the file system.
   *
   * @param {string} destination
   */
  async writeTo(destination)
  {
    await lock( destination );

    await fs.promises.mkdir( path.dirname(destination), { recursive: true } );

    await fs.promises.writeFile( destination, this.toString() );

    await unlock( destination );
  }

  clear()
  {
    // Delete properties instead of setting to {} so that the variable reference
    // is maintained incase the `assets` is being shared in multi-compiler mode.
    Object.keys( this.assets ).forEach( key => delete this.assets[ key ] );
  }

  /**
   * Cleanup before running Webpack
   */
  handleWatchRun()
  {
    this.clear();
  }

  /**
   * Determine if the manifest should be written to disk with fs.
   *
   * @param {object} compilation
   * @return {boolean}
   */
  shouldWriteToDisk(compilation)
  {
    if ( this.options.writeToDisk === 'auto' ) {
      if ( this.inDevServer() ) {
        const wdsWriteToDisk = get( compilation, 'options.devServer.writeToDisk' );

        if ( wdsWriteToDisk === true ) {
          return false;
        }

        const manifestPath = this.getManifestPath( compilation, this.getOutputPath() );

        if ( typeof wdsWriteToDisk === 'function' && wdsWriteToDisk( manifestPath ) === true ) {
          return false;
        }

        // Return true if the manifest output is above the compiler outputPath.
        return path.relative( this.compiler.outputPath, manifestPath ).startsWith('..');
      }

      return false;
    }

    return this.options.writeToDisk;
  }

  /**
   * Last chance to write the manifest to disk.
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  async handleAfterEmit(compilation)
  {
    if ( this.shouldWriteToDisk(compilation) ) {
      await this.writeTo( this.getManifestPath( compilation, this.getOutputPath() ) );
    }
  }

  /**
   * Record asset names
   *
   * @param  {object} compilation
   * @param  {object} loaderContext
   * @param  {object} module
   */
  handleNormalModuleLoader(compilation, loaderContext, module)
  {
    const { emitFile } = loaderContext;
    const { contextRelativeKeys } = this.options;

    // assetInfo parameter was added in Webpack 4.40.0
    loaderContext.emitFile = (name, content, sourceMap, assetInfo) => {
      const info = Object.assign( {}, assetInfo );

      info.sourceFilename = path.relative( compilation.compiler.context, module.userRequest );

      this.assetNames.set(
        contextRelativeKeys ?
          info.sourceFilename :
          path.join( path.dirname(name), path.basename(module.userRequest) ),
        name,
      );

      return emitFile.call(module, name, content, sourceMap, info);
    };
  }

  /**
   * Add the SRI hash to the assetsInfo map
   *
   * @param {object} compilation
   */
  recordSubresourceIntegrity( compilation )
  {
    const { integrityHashes, integrityPropertyName } = this.options;

    for ( const asset of compilation.getAssets() ) {
      if ( ! asset.info[ integrityPropertyName ] ) {
        // webpack-subresource-integrity stores the integrity hash on the source object.
        asset.info[ integrityPropertyName ] = asset.source[ integrityPropertyName ] || getSRIHash( integrityHashes, asset.source.source() );

        compilation.assetsInfo.set( asset.name, asset.info );
      }
    }
  }

  /**
   * Hook into compilation objects
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  handleCompilation(compilation)
  {
    NormalModule.getCompilationHooks(compilation).loader.tap(
      PLUGIN_NAME,
      this.handleNormalModuleLoader.bind(this, compilation),
    );

    compilation.hooks.processAssets.tap(
      {
        name: PLUGIN_NAME,
        stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
      },
      this.handleProcessAssetsAnalyse.bind(this, compilation),
    );
  }

  /**
   * Hook into the compilation object
   *
   * @param  {object} compilation - the Webpack compilation object
   */
  handleThisCompilation(compilation)
  {
    if ( this.options.integrity ) {
      compilation.hooks.afterProcessAssets.tap(
        PLUGIN_NAME,
        this.recordSubresourceIntegrity.bind(this, compilation),
      );
    }

    compilation.hooks.afterProcessAssets.tap(
      PLUGIN_NAME,
      this.handleAfterProcessAssets.bind(this, compilation),
    );
  }

  /**
   * Determine if webpack-dev-server is being used
   *
   * The WEBPACK_DEV_SERVER / WEBPACK_SERVE env vars cannot be relied upon.
   * See issue {@link https://github.com/webdeveric/webpack-assets-manifest/issues/125|#125}
   *
   * @return {boolean}
   */
  inDevServer()
  {
    const [ , webpackPath, serve ] = process.argv;

    if ( serve === 'serve' && webpackPath && path.basename(webpackPath) === 'webpack' ) {
      return true;
    }

    if ( process.argv.some( arg => arg.includes('webpack-dev-server') ) ) {
      return true;
    }

    return has(this, 'compiler.outputFileSystem') && this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem';
  }

  /**
   * Get the file system path to the manifest
   *
   * @return {string} path to manifest file
   */
  getOutputPath()
  {
    if ( path.isAbsolute( this.options.output ) ) {
      return this.options.output;
    }

    if ( ! this.compiler ) {
      return '';
    }

    if ( this.inDevServer() ) {
      let outputPath = get( this, 'compiler.options.devServer.outputPath', get( this, 'compiler.outputPath', '/' ) );

      if ( outputPath === '/' ) {
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
   * @param  {string} filename
   */
  getPublicPath(filename)
  {
    if ( typeof filename === 'string' ) {
      const { publicPath } = this.options;

      if ( typeof publicPath === 'function' ) {
        return publicPath( filename, this );
      }

      if ( typeof publicPath === 'string' ) {
        return url.resolve( publicPath, filename );
      }

      if ( publicPath === true ) {
        return url.resolve(
          get( this, 'compiler.options.output.publicPath', '' ),
          filename,
        );
      }
    }

    return filename;
  }

  /**
   * Get a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler|Proxy} for the manifest.
   * This allows you to use `[]` to manage entries.
   *
   * @param {boolean} raw - Should the proxy use `setRaw` instead of `set`?
   * @return {Proxy}
   */
  getProxy(raw = false)
  {
    const setMethod = raw ? 'setRaw' : 'set';

    const handler = {
      has(target, property) {
        return target.has(property);
      },
      get(target, property) {
        return target.get(property);
      },
      set(target, property, value) {
        return target[ setMethod ](property, value).has(property);
      },
      deleteProperty(target, property) {
        return target.delete(property);
      },
    };

    return new Proxy(this, handler);
  }
}

module.exports = WebpackAssetsManifest;
