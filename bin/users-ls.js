

//dependencies
var config = require('../config'),
    path = require('path'),
    express = require('express'),
    mongoose = require('mongoose')
    ;

if (!module.parent) {
  var app = express( );

  //keep reference to config
  app.config = config;

  //setup mongoose
  app.db = mongoose.createConnection(config.mongodb.uri);
  app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
  app.db.once('open', function () {
    //and... we have a data store
    var string = process.argv.slice(2,3).pop( );
    var expr = new RegExp(string ? `.*${string}.*` : '.*', 'i')
    var q = {
      $or: [
      { email: expr },
      { username: expr }
      ]
    };
    console.log('query', q);
    app.db.models.User.find(q, function (err, users) {
      console.log('users', users.length);
      console.log(JSON.stringify(users, null, '\t'));
      app.db.close( );
      // process.exit( );
    });
  });

  //config data models
  require('../models')(app, mongoose);

}

