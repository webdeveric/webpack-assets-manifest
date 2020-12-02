'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const chalk = require('chalk');
const escapeRegExp = require('lodash.escaperegexp');
const lockfile = require('lockfile');

const lfLock = util.promisify(lockfile.lock);
const lfUnlock = util.promisify(lockfile.unlock);

/**
 * Display a warning message.
 *
 * @param {string} message
 */
function warn( message )
{
  const prefix = chalk.hex('#CC4A8B')('WARNING:');

  console.warn(chalk`${prefix} ${message}`);
}

warn.cache = new Set();

/**
 * Display a warning message once.
 *
 * @param {string} message
 */
warn.once = function( message ) {
  if ( warn.cache.has( message ) ) {
    return;
  }

  warn( message );

  warn.cache.add( message );
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
 * Determine if the argument is an Object.
 *
 * @param {*} arg
 */
function isObject( arg )
{
  return varType( arg ) === 'Object';
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
  return Object.keys( object ).sort( compareFunction ).reduce(
    (sorted, key) => (sorted[ key ] = object[ key ], sorted),
    Object.create(null),
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
      (match, p1, p2, offset, str, { name, length = '1,' }) => `(?<${name}>.{${length}})`,
    ) + '$',
    flags,
  );
}

/**
 * Find a Map entry key by the value
 *
 * @param {Map} map
 */
function findMapKeysByValue( map )
{
  const entries = [ ...map.entries() ];

  return searchValue => entries
    .filter( ([ , value ]) => value === searchValue )
    .map( ([ name ]) => name );
}

/**
 * Group items from an array based on a callback return value.
 *
 * @param {Array} arr
 * @param {(item: any) => string} getGroup
 * @param {(item: any, group: string) => any} mapper
 */
function group( arr, getGroup, mapper = item => item )
{
  return arr.reduce(
    (obj, item) => {
      const group = getGroup( item );

      if ( group ) {
        obj[ group ] = obj[ group ] || [];
        obj[ group ].push( mapper( item, group ) );
      }

      return obj;
    },
    Object.create(null),
  );
}

/**
 * Build a file path to a lock file in the tmp directory
 *
 * @param {string} filename
 */
function getLockFilename( filename )
{
  const name = filename.replace(/[^\w]+/g, '-');

  return path.join( os.tmpdir(), `${name}.lock` );
}

/**
 * Create a lockfile (async)
 *
 * @param {string} filename
 */
async function lock( filename )
{
  await lfLock(
    getLockFilename( filename ),
    {
      wait: 10000,
      stale: 20000,
      retries: 100,
      retryWait: 100,
    },
  );
}

/**
 * Create a lockfile
 *
 * @param {string} filename
 */
function lockSync( filename )
{
  return lockfile.lockSync(
    getLockFilename( filename ),
    {
      stale: 20000,
      retries: 200,
    },
  );
}

/**
 * Remove a lockfile (async)
 *
 * @param {string} filename
 */
async function unlock( filename )
{
  await lfUnlock( getLockFilename( filename ) );
}

/**
 * Remove a lockfile
 *
 * @param {string} filename
 */
function unlockSync( filename )
{
  return lockfile.unlockSync( getLockFilename( filename ) );
}

module.exports = {
  maybeArrayWrap,
  filterHashes,
  getSRIHash,
  warn,
  varType,
  isObject,
  getSortedObject,
  templateStringToRegExp,
  findMapKeysByValue,
  group,
  getLockFilename,
  lock,
  lockSync,
  unlock,
  unlockSync,
};
