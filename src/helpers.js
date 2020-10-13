const crypto = require('crypto');
const chalk = require('chalk');
const escapeRegExp = require('lodash.escaperegexp');

/**
 * Display a warning message.
 *
 * @param {string} message
 */
function warn( message )
{
  if ( message in warn.cache ) {
    return;
  }

  const prefix = chalk.hex('#CC4A8B')('WARNING:');

  console.warn(chalk`${prefix} ${message}`);
}

warn.cache = Object.create(null);

/**
 * Display a warning message once.
 *
 * @param {string} message
 */
warn.once = function( message ) {
  warn( message );
  warn.cache[ message ] = true;
};

/**
 * @param  {*} data
 * @return {array}
 */
function maybeArrayWrap( data )
{
  return Array.isArray( data ) ? data : [ data ];
}

/**
 * Filter out invalid hash algorithms.
 *
 * @param  {array} hashes
 * @return {array} Valid hash algorithms
 */
function filterHashes( hashes )
{
  const validHashes = crypto.getHashes();

  return hashes.filter( hash => {
    if ( validHashes.includes(hash) ) {
      return true;
    }

    warn(chalk`{blueBright ${hash}} is not a supported hash algorithm`);

    return false;
  });
}

/**
 * See {@link https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity|Subresource Integrity} at MDN
 *
 * @param  {array} hashes - The algorithms you want to use when hashing `content`
 * @param  {string} content - File contents you want to hash
 * @return {string} SRI hash
 */
function getSRIHash( hashes, content )
{
  return Array.isArray( hashes ) ? hashes.map( hash => {
    const integrity = crypto.createHash(hash).update(content, 'utf8').digest('base64');

    return `${hash}-${integrity}`;
  }).join(' ') : '';
}

/**
 * Get the data type of an argument.
 *
 * @param  {*} v - Some variable
 * @return {string} Data type
 */
function varType( v )
{
  const [ , type ] = Object.prototype.toString.call( v ).match(/^\[object (\w+)\]$/);

  return type;
}

/**
 * Get an object sorted by keys.
 *
 * @param  {object} object
 * @param  {(a: string, b: string) => number} compareFunction
 * @return {object}
 */
function getSortedObject(object, compareFunction)
{
  const keys = Object.keys(object);

  keys.sort( compareFunction );

  return keys.reduce(
    (sorted, key) => (sorted[ key ] = object[ key ], sorted),
    Object.create(null)
  );
}

/**
 * Build a RegExp instance based on the input string, which can contain place holders like [hash] and [id].
 *
 * @param {string} input
 * @param {string|undefined} flags
 *
 * @returns {RegExp}
 */
function templateStringToRegExp(input, flags = undefined)
{
  return new RegExp(
    escapeRegExp(input).replace(
      /\\\[(?<name>[a-z]+)(?::(?<length>\d+))?\\\]/gi, // This replaces \[hash\] or \[hash:6\]
      (match, p1, p2, offset, str, { name, length = '1,' }) => `(?<${name}>.{${length}})`
    ) + '$',
    flags
  );
}

module.exports = {
  maybeArrayWrap,
  filterHashes,
  getSRIHash,
  warn,
  varType,
  getSortedObject,
  templateStringToRegExp,
};
