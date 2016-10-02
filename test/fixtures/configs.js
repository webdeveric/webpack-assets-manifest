var path = require('path');
var tmpDir = require('os').tmpdir();

function getTmpDir()
{
  return tmpDir;
}

function getWorkspace()
{
  return path.join(tmpDir, 'webpack-assets-manifest');
}

function randomString(length)
{
  var str = '';
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

  while(length--) {
    str += chars[ Math.floor( Math.random() * chars.length ) ];
  }

  return str;
}

function tmpDirPath()
{
  return path.join(getWorkspace(), randomString(8));
}

function hello()
{
  return {
    entry: path.resolve(__dirname, './hello.js'),
    output: {
      path: tmpDirPath(),
      filename: 'bundle.js'
    }
  };
}

function client()
{
  return {
    target: 'web',
    entry: {
      client: path.resolve(__dirname, './client.js')
    },
    output: {
      path: tmpDirPath(),
      filename: 'client-bundle.js'
    },
    module: {
      loaders: [
        {
          test: /\.jpg$/i,
          loader: 'file?name=images/[name].[ext]'
        }
      ]
    }
  };
}

function server()
{
  return {
    target: 'node',
    entry: {
      server: path.resolve(__dirname, './server.js')
    },
    output: {
      path: tmpDirPath(),
      filename: 'server-bundle.js'
    }
  };
}

function multi()
{
  var c = client();
  var s = server();

  c.output.path = s.output.path = tmpDirPath();

  return [ c, s ];
}

module.exports = {
  hello: hello,
  client: client,
  server: server,
  multi: multi,
  getTmpDir: getTmpDir,
  getWorkspace: getWorkspace
};
