const crypto = require('crypto');
const chalk = require('chalk');

function maybeArrayWrap( data )
{
  return Array.isArray( data ) ? data : [ data ];
}

function getSRIHash( hashes, content )
{
  return Array.isArray( hashes ) ? hashes.map( hash => {
    const integrity = crypto.createHash(hash).update(content, 'utf-8').digest('base64');
    return `${hash}-${integrity}`;
  }).join(' ') : '';
}

function warn( message )
{
  if ( message in warn.cache ) {
    return;
  }

  console.warn(chalk`{bold.cyanBright WARNING:} ${message}`);
}

warn.cache = Object.create(null);

warn.once = function( message ) {
  warn( message );
  warn.cache[ message ] = true;
};

module.exports = {
  maybeArrayWrap,
  getSRIHash,
  warn,
};
