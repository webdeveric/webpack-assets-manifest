var path = require('path');
var webpack = require('webpack');
var MemoryFs = require('memory-fs');

function makeCompiler()
{
  var compiler = webpack({
    entry: {
      hello: path.resolve(__dirname, './hello.js')
    },
    output: {
      path: __dirname,
      filename: 'bundle.js'
    }
  });

  compiler.outputFileSystem = new MemoryFs();

  return compiler;
}

module.exports = makeCompiler;
