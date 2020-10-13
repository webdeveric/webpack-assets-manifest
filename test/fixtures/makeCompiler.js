const webpack = require('webpack');
const MemoryFs = require('memory-fs');

function makeCompiler( config )
{
  const compiler = webpack( config );

  compiler.outputFileSystem = new MemoryFs();

  return compiler;
}

module.exports = makeCompiler;
