var http = require('http');
var url = require('url');
var fs = require('fs');

var winston = require('winston');
var connect = require('connect');

var DocumentHandler = require('./lib/document_handler');

// Load the configuration and set some defaults
var config = JSON.parse(fs.readFileSync('./config.js', 'utf8'));
config.port = process.env.PORT || config.port || 7777;
config.host = process.env.HOST || config.host || 'localhost';

// Set up the logger
if (config.logging) {
  try {
    winston.remove(winston.transports.Console);
  } catch(er) { }
  var detail, type;
  for (var i = 0; i < config.logging.length; i++) {
    detail = config.logging[i];
    type = detail.type;
    delete detail.type;
    winston.add(winston.transports[type], detail);
  }
}

// build the store from the config on-demand - so that we don't load it
// for statics
if (!config.storage) {
  config.storage = { type: 'file' };
}
if (!config.storage.type) {
  config.storage.type = 'file';
}

var Store, preferredStore;

if (process.env.REDISTOGO_URL && config.storage.type === 'redis') {
  var redisClient = require('redis-url').connect(process.env.REDISTOGO_URL);
  Store = require('./lib/document_stores/redis');
  preferredStore = new Store(config.storage, redisClient);
}
else {
  Store = require('./lib/document_stores/' + config.storage.type);
  preferredStore = new Store(config.storage);
}

// Pick up a key generator
var pwOptions = config.keyGenerator || {};
pwOptions.type = pwOptions.type || 'random';
var gen = require('./lib/key_generators/' + pwOptions.type);
var keyGenerator = new gen(pwOptions);

// Configure the document handler
var documentHandler = new DocumentHandler({
  store: preferredStore,
  maxLength: config.maxLength,
  keyLength: config.keyLength,
  keyGenerator: keyGenerator
});

// Compress the static javascript assets
if (config.recompressStaticAssets) {
  var jsp = require("uglify-js").parser;
  var pro = require("uglify-js").uglify;
  var list = fs.readdirSync('./static');
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var orig_code, ast;
    if ((item.indexOf('.js') === item.length - 3) &&
        (item.indexOf('.min.js') === -1)) {
      dest = item.substring(0, item.length - 3) + '.min' +
        item.substring(item.length - 3);
      orig_code = fs.readFileSync('./static/' + item, 'utf8');
      ast = jsp.parse(orig_code);
      ast = pro.ast_mangle(ast);
      ast = pro.ast_squeeze(ast);
      fs.writeFileSync('./static/' + dest, pro.gen_code(ast), 'utf8');
      winston.info('compressed ' + item + ' into ' + dest);
    }
  }
}

// Send the static documents into the preferred store, skipping expirations
var path, data;
for (var name in config.documents) {
  path = config.documents[name];
  data = fs.readFileSync(path, 'utf8');
  if (data) {
    var doc = {
      name: name,
      size: data.length,
      mimetype: 'text/plain',
      file: null
    };
    // we're not actually using http requests to initialize the static docs
    // so use a fake response object to determine finished success/failure
    var nonHttpResponse = {
      writeHead: function(code, misc) {
        if (code == 200) {
          winston.debug('loaded static document', { file: name, path: path });
        } else {
          winston.warn('failed to store static document', { file: name, path: path });
        }
      },
      end: function(){}
    };
    documentHandler._setStoreObject(doc, data, nonHttpResponse, true);
  }
  else {
    winston.warn('failed to load static document', { name: name, path: path });
  }
}

// Set the server up with a static cache
connect.createServer(
  // First look for api calls
  connect.router(function(app) {
    // add documents
    app.post('/docs', function(request, response, next) {
      return documentHandler.handlePost(request, response);
    });
    // get documents
    app.get('/docs/:id', function(request, response, next) {
      var skipExpire = !!config.documents[request.params.id];
      return documentHandler.handleGet(request, response, skipExpire);
    });
  }),
  // Otherwise, static
  connect.staticCache(),
  connect.static(__dirname + '/static', { maxAge: config.staticMaxAge }),
  // Then we can loop back - and everything else should be a token,
  // so route it back to /index.html
  connect.router(function(app) {
    app.get('/:id', function(request, response, next) {
      request.url = request.originalUrl = '/index.html';
      next();
    });
  }),
  connect.static(__dirname + '/static', { maxAge: config.staticMaxAge })
).listen(config.port, config.host);

winston.info('listening on ' + config.host + ':' + config.port);
