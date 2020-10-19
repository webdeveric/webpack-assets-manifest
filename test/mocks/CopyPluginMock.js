const webpack = require('webpack');

const { RawSource } = webpack.sources || require('webpack-sources');

class CopyPluginMock {
  constructor(assets) {
    this.assets = assets;
  }

  apply(compiler) {
    const pluginName = this.constructor.name;

    compiler.hooks.thisCompilation.tap(pluginName, compilation => {
      compilation.hooks.additionalAssets.tapAsync(
        pluginName,
        async callback => {
          this.assets.forEach(asset => {
            const { targetPath, data } = asset;
            const source = new RawSource(data);

            compilation.emitAsset(targetPath, source, {});
          });
          callback();
        }
      );
    });
  }
}

module.exports = CopyPluginMock;
