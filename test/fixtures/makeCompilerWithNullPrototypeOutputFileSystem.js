'use strict';

const webpack = require('webpack');

function makeCompiler( config )
{
  const compiler = webpack( config );

  const outputFileSystem = Object.create(null);

  compiler.outputFileSystem = outputFileSystem;

  return compiler;
}

module.exports = makeCompiler;
