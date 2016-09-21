var webpack = require('webpack');
var MemoryFs = require('memory-fs');

function makeCompiler( config )
{
  var compiler = webpack( config );

  compiler.outputFileSystem = new MemoryFs();

  return compiler;
}

module.exports = makeCompiler;
