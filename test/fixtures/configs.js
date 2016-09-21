var path = require('path');
var os = require('os');

function single()
{
  return {
    entry: path.resolve(__dirname, './hello.js'),
    output: {
      path: __dirname,
      filename: 'bundle.js'
    }
  };
}

function singleArray()
{
  return {
    entry: [ path.resolve(__dirname, './hello.js') ],
    output: {
      path: __dirname,
      filename: 'bundle.js'
    }
  };
}

function singleNamedChunk()
{
  return {
    entry: {
      hello: path.resolve(__dirname, './hello.js')
    },
    output: {
      path: __dirname,
      filename: 'bundle.js'
    }
  };
}

function tmpOutput()
{
  return {
    entry: path.resolve(__dirname, './hello.js'),
    output: {
      path: path.join(os.tmpdir(), 'webpack-assets-manifest'),
      filename: 'bundle.js'
    }
  };
}

module.exports = {
  single: single,
  singleArray: singleArray,
  singleNamedChunk: singleNamedChunk,
  tmpOutput: tmpOutput
};
