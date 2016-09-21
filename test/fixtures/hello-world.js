require.ensure(['./hello'], function( require ) {
  var hello = require('./hello');
  console.log( hello('World') );
});

module.exports = function() {
  return 'Hello World!';
};
