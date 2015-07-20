'use strict';

var request = require('request');
var crypto = require('crypto');

function get_bases (req) {
  var bases = {
    viewer: req.app.config.proxy.PREFIX.VIEWER
  , uploader: '-u' + req.app.config.cookie.domain
  , mqtt: req.app.config.mqtt
  , guest: req.app.config.proxy.PREFIX.GUEST
  , pebble: req.app.config.proxy.PREFIX.PEBBLE
  };

  return bases;
}

var renderSites = function(req, res, next) {

  var bases = get_bases(req);

  req.user.roles.account.populate('sites', 
    function (err, account) {
      var sites = account.sites;
      sites = sites.map(sitePrefixes(bases));
      console.log('SITES', sites);
      res.render('account/sites/index', {user: req.user, sites: sites, bases: bases });
  }) ;
  // next( );
}

exports.init = function(req, res, next){
  renderSites(req, res, next, '');
};

exports.listView = function (req, res, next) {
  var q = {
    created_by: { id: req.user.roles.account._id }
  , site: { id: req.hosted_site._id
          , internal_name: req.hosted_site.internal_name
    }
  };
  req.app.db.models.View.find(q, function (err, docs) {
    var views = docs.map(guestPrefixes(req.bases));
    res.format({
      json: function ( ) {
        if (err) {
          return next(err);
        }
        res.json(views || [ ]);
      }
    });
  });
};

exports.createView = function (req, res, next) {
  var key = req.hosted_site.uploader_prefix.slice(0, 6);
  var name = req.body.viewName;
  var expected_name = name + '-' + key;
  var inputs = {
    name: name
  , created_by: { id: req.user.roles.account._id }
  , site: { id: req.hosted_site._id
          , internal_name: req.hosted_site.internal_name
    }
  , key: key
  , expected_name: expected_name

  };
  console.log('creating new view', inputs);
  var q = {
    name: name
  , key: key
  , site: inputs.site
  };

  req.app.db.models.View.findOneAndUpdate(q, inputs, {upsert: true}, function (err, view) {
    if (err) {
      return next(err);
    }
    res.status(201);
    res.format({
      json: function ( ) {
        res.json(view);
      },
      html: function ( ) {
        res.redirect('/account/sites/' + req.hosted_site.name);
      }
    });
  });
};

exports.deleteView = function (req, res, next) {
  var q = {
    name: req.params.viewName
  , site: { id: req.hosted_site._id
          , internal_name: req.hosted_site.internal_name
    }
  };
  req.app.db.models.View.remove(q, function (err, site) {
    if (err) {
      return next(err);
    }
    res.status(204).send("").end( );
  });
};

exports.findSite = function (req, res, next) {
  var bases = get_bases(req);
  var q = {
    name: req.params.name
  , account: { id: req.user.roles.account._id },
  };
  req.bases = bases;
  if (req.xhr) {
    res.set('json');
    res.set('Content-Type', 'application/json');
  }

  req.app.db.models.Site.findOne(q, function (err, sites) {

    if (err || sites == null) {
      return next(err);
    }
    req.hosted_site = sites;
    var site = [sites].map(sitePrefixes(bases)).pop( );
    req.site = site;
    return next( );
  });
};

exports.examine = function (req, res, next) {
  var bases = get_bases(req);
  var q = {
    name: req.params.name
  , account: { id: req.user.roles.account._id },
  };
  if (req.xhr) {
    res.set('json');
    res.set('Content-Type', 'application/json');
  }
  req.app.db.models.Site.findOne(q, function (err, sites) {

    req.accept
    if (err || sites == null) {
      return next(err);
    }
    var site = [sites].map(sitePrefixes(get_bases(req))).pop( );
    var data = { user: req.user, name: req.params.name, site: site, bases: bases };
    res.format({
      'json': function ( ) {
        res.json(data);
      },
      'html': function ( ) {
        res.render('account/sites/examine', data);
      }
    });
  });
};

function guestPrefixes (bases) {
  function iter (item) {
    item = item.toJSON( );
    item.domain = item.expected_name + bases.guest;
    item.url = 'https://' + item.domain + '/';
    item.pebble = 'https://' + item.domain + '/pebble';
    return item;
  }
  return iter;
}

function sitePrefixes (bases) {
  function iter (item) {
    item = item.toJSON( );
    var mqtt_auth = [ item.uploader_prefix, item.api_secret ].join(':');
    item.domain = item.name + bases.viewer;
    item.upload = 'https://' + item.api_secret + '@' + item.uploader_prefix + bases.uploader + '/api/v1';
    item.mqtt_monitor = 'tcp://' + mqtt_auth + '@' + bases.mqtt.public;
    item.settings = '/account/sites/' + item.name;
    item.guest = '-' + item.uploader_prefix.slice(0, 6) + bases.guest;
    return item;
  }
  return iter;
}

exports.list = function list (req, res, next) {
  // req.app.db

  req.user.roles.account.populate('sites', 
    function (err, account) {
      var sites = account.sites;
      sites = sites.map(sitePrefixes(get_bases(req)));
      console.log('SITES', sites);
      res.json(sites);
  }) ;
  // var sites = req.user.roles.account.sites;
  console.log('account', req.user.roles.account);
  // req.app.db.models.Site.find
}

exports.remove = function(req, res, next) {
  var name = req.params.name;
  var account_id = req.user.roles.account._id;
  // var site = req.sites.filter(function (f) { return f.name == name && req.user.roles.account._id == f.account.id; });
  var site = req.sites.filter(function (f) { 
    return (f.name == name && f.account.id.toString( ) == account_id.toString( ));
  }).pop( );
  console.log("REMOVE XX", site);
  if (site.name != name) {
    throw "bad";
  }
  var api = req.app.config.proxy.api;
  var delete_url = api + '/environs/' + site.internal_name;
  var q = {
    name: name
  , account: { id: req.user.roles.account._id },
  };
  console.log('removing', name, 'from backend', delete_url);
  request.del(delete_url, function done (err, result, body) {
    console.log('removed from backends', result.statusCode, body);
    // req.user.roles.account.sites.pull(q);
    console.log('begin sites for account', req.user.roles.account.sites.length);
    req.user.roles.account.sites = req.sites.filter(function (c) {
      console.log('considering removing', c.name, name);
      return c.name.toString( ) != name;
    });
    req.user.roles.account.update(req.user.roles.account, function (err, saved) {
      console.log('saved account', err, saved);
      req.app.db.models.Site.remove(q, function (err, site) {
          // req.app.db.models.Site.findOneAndRemove(q, function (err, site) { });
          console.log('removed from db', 'query', q, 'err', err, 'site??', site);
          /*
          req.user.roles.account.update(function (err) { });
          */
          console.log('sites for account', req.user.roles.account.sites.length);
          res.status(204).send("").end( );

      });
    });

    /* */
  });
}

exports.create = function(req, res, next) {
  var bases = get_bases(req);
  console.log("GOT NEW SITE REQUEST", req.body);
  // console.log("config", req.app.config);
  console.log("config", req.app.config.hosted.uri);
  console.log("config", req.app.config.hosted.prefix);
  var internal_name = req.body.name + '.' + req.user.roles.account._id;
  var prefix = req.app.config.hosted.prefix + internal_name + '_internal_';
  var inst = {
    mongo: req.app.config.hosted.uri,
    internal_name: internal_name,
    MONGO_COLLECTION: prefix + 'entries',
    MONGO_SETTINGS_COLLECTION: prefix + 'settings',
    MONGO_TREATMENTS_COLLECTION: prefix + 'treatments',
    MONGO_PROFILE_COLLECTION: prefix + 'profile',
    MONGO_DEVICESTATUS_COLLECTION: prefix + 'devicestatus'
    // MQTT_MONITOR
    // DISPLAY_UNITS
    // ENABLE
  };
  var api_secret = crypto.randomBytes(256).slice(0, 20).toString('hex');
  var uploader_prefix = crypto.randomBytes(12).toString('hex');
  inst.API_SECRET = api_secret;
  var mqtt_auth = [ uploader_prefix, api_secret ].join(':');
  var private_mqtt = 'tcp://' + mqtt_auth + '@' + req.app.config.mqtt.private;
  inst.MQTT_MONITOR = private_mqtt;
  var api = req.app.config.proxy.api;
  var creator_url = api + '/environs/' + inst.internal_name;
  console.log('sending', creator_url, inst);
  request.post({ url: creator_url, json: inst }, function done (err, result, body) {
    console.log("DONE", err, result, body);
    // req.db.
    if (err) {
      return next(err);
    }

    var shasum = crypto.createHash('sha1');
    shasum.update(body.API_SECRET);
    var api_key = shasum.digest('hex');
    var fieldsToSet = {
      name: req.body.name,
      internal_name: body.internal_name,
      account: { id: req.user.roles.account._id },
      apikey: api_key,
      api_secret: body.API_SECRET,
      uploader_prefix: uploader_prefix,
      response: body
    };

    /*
    function createSite (fieldsToSet, cb) { }
    */
    // req.user.createSite(fieldsToSet,
    var q = {
      name: fieldsToSet.name
    , account: fieldsToSet.account
    };
    req.app.db.models.Site.findOneAndUpdate(q, fieldsToSet, {upsert: true}, function (err, site) {
      req.site = site;
      // req.user.roles.account.sites.push(site);
      req.user.roles.account.sites.addToSet(site);
      req.user.roles.account.save( );
      
      // renderSites(req, res, next, '');
      console.log("CREATED NEW SITE!", err, site);
      res.render('account/sites/index', {user: req.user, site: site, bases: bases });
    });
  });

};
