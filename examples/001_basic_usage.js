var path = require('path');

var Password = require('../src/key/Password');
var File = require('../src/key/File');

var Promise = require('es6-promise').Promise;
function promisify(f) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    return new Promise(function(resolve, reject) {
      args.push(function(err) {
        if(err) return reject(err);

        var res = Array.prototype.slice.call(arguments, 1);
        if(res.length == 0) resolve();
        else if(res.length == 1) resolve(res[0]);
        else resolve(res);
      });
      f.apply(null, args);
    });
  }
}
var readFile = promisify(require('fs').readFile)
var writeFile = promisify(require('fs').writeFile);

var io = require('../src/keepass/IO');
var Reader = io.Reader;
var Writer = io.Writer;

// Detect some needed paths
var resourcePath = path.join(__dirname, '..', 'test', 'resources');
//var databasePath = path.join(resourcePath, '000_example.kdbx');
var databasePath = path.join(__dirname, '..', 'test.kdbx');
var newDatabasePath = path.join(__dirname, 'new-example.kdbx');
var keyfilePath = path.join(resourcePath, '000_example.key');


Promise.all([readFile(databasePath), readFile(keyfilePath)])
  .then(function(args) {
    var buf = args[0];
    var key = args[1];
    var r = new Reader();
    return r.buffer(buf, [
      new Password('123456')
      //new Password('nebuchadnezzar'),
      //new File(key)
    ]);
  })
  .then(function(db) {
    db.name = 'Keepass js works!';
    return db;
  })
  .then(function(db) {
    return Promise.all([ db, readFile(keyfilePath) ])
  })
  .then(function(args) {
    var keyfile = args[1];
    var db = args[0];
    var w = new Writer();
    console.log('write')
    return w.buffer(db, [
      new File(keyfile),
      new Password('morpheus')
    ]);
  })
  .then(function(buf) {
    return writeFile(newDatabasePath, buf);
  })
  .catch(function(err) {
    console.error(err)
    console.error(err.stack());
  })
