
var engine = require('share2nightscout-bridge');
var _ = require('lodash');
var request = require('request');


function mount (app, passport) {


  var ctx = app.ctx;
  var config = app.config;

  function options (cfg) {
    var fetch_config = {
      maxCount: 1
    , minutes: 63
    };
    return {
      login: cfg.creds
    , interval: null
    , fetch: fetch_config
    , nightscout: { }
    , maxFailures: 3
    , firstFetchCount: 12

    };
  }

  function suggest (req, res, next) {
    console.log("incoming", req.params, req.body);
    var settings = {
      ok: 0,
      enabled: false,
      mode: 'verify',
      creds: {
        accountName: null
      , password: null
      }

    };
    if (req.site) {
      console.log('site', req.site.proc);
      var env = _.clone(req.site.proc.custom_env);
      var enabled = [null].concat((env.ENABLE || '').split(' '));
      settings.enabled = enabled.indexOf('bridge') > 0;
      settings.mode = settings.enabled ? 'verified' : 'verify';
      settings.ok = settings.enabled ? 1 : 0;
      settings.creds.accountName = env.BRIDGE_USER_NAME;
      settings.creds.password = env.BRIDGE_PASSWORD;

    }

    if (req.body && req.body.dexcom_account_name) {
      settings.ok = 0;
      settings.creds.accountName = req.body.dexcom_account_name;
      settings.creds.password = req.body.dexcom_account_password;
    }

    req.bridge = settings;
    next( );
  }
  
  function get_original_env (req, res, next) {
    var key = req.site.key;
    var api = req.app.config.proxy.backplane;
    var url = api + '/resource/' + key + '/compute';
    // var api = req.app.config.proxy.api;
    // var url = api + '/environs/' + req.site.internal_name;
    // var api = req.app.config.proxy.provision;
    // var url = api + '/accounts/' + account_id + '/sites/' + req.site.internal_name;
    request.get({ url: url, json: true }, function done (err, result, body) {
      if (err) return next(err);
      req.original_env = body.custom_env;
      next( );
    });
  }

  function enable (req, res, next) {
    var payload = { };
    var prev = _.clone(req.site.proc.custom_env);
    console.log('saving', res.locals.attempt);
    if (res.locals.attempt && res.locals.attempt.ok) {
      // send to multienv
      payload = _.clone(req.original_env);
      var enableds = _.without((payload.ENABLE || '').split(' '), 'bridge');
      payload.ENABLE = (res.locals.attempt.ok ? 
                        ['bridge'] : [ ]).concat(enableds).join(' ');
      if (res.locals.attempt.ok) {
        payload.BRIDGE_PASSWORD = res.locals.attempt.settings.creds.password;
        payload.BRIDGE_USER_NAME = res.locals.attempt.settings.creds.accountName;
      }
      // if something is different then save
      if ([ null, prev.ENABLED == payload.ENABLED
          , prev.BRIDGE_USER_NAME == payload.BRIDGE_USER_NAME
          , prev.BRIDGE_PASSWORD == payload.BRIDGE_PASSWORD
          ].indexOf(false) > 0) {

        var key = req.site.key;
        var resource_url = app.config.proxy.backplane + '/resource/' + key + '/compute';
        console.log('posting', resource_url, payload);
        return request.post({url: resource_url, json: payload}, function (err, raw, data) {
          console.log('saved', resource_url);
          res.locals.attempt.multienv = _.pick(data, ['ENABLE', 'BRIDGE_PASSWORD', 'BRIDGE_USER_NAME']);
          res.locals.attempt.settings.ok = 1;
          res.locals.attempt.ok = 1;
          return next(err);
        });
        return;
      }
      console.log('nothing xhanged?', prev, payload);
    }
    return next( );
  }

  function verify (req, res, next) {
    console.log('consider verifying', req.bridge);
    if (!req.bridge.enabled && req.bridge.mode != 'verify') {
      return next( );
    }
    if ( ( req.bridge.creds.accountName.length < 3
         || req.bridge.creds.password.length < 3)) {
      return next( );
    }
    var opts = options(req.bridge);
    var attempt = {ok: 0, settings: req.bridge };
    res.locals.attempt = attempt;
    
    function done (err, glucose) {
      console.log('attempt', arguments);
      var attempt = {ok: err ? 0 : 1, err: err, glucose: glucose, settings: req.settings };
      res.locals.attempt = attempt;
      next( );
      // res.json(attempt);
    }
    opts.callback = done;

    var bad = '00000000-0000-0000-0000-000000000000';
    engine.authorize(opts.login, function (err, raw, result) {
      console.log('AUTHED auth', err, result);
      var ok = result != bad;
      res.locals.attempt.ok = ok;
      res.locals.attempt.result = result;
      res.locals.attempt.err = err;
      next( );
    });

  }

  function json (req, res, next) {
    res.json(res.locals.attempt || req.bridge);
    // res.json(.bridge);
  }

  function ware (req, res, next) {
  }
  ware.suggest = suggest;
  ware.enable = enable;
  ware.verify = verify;
  ware.json = json;
  ware.get_original_env = get_original_env;
  return ware;

}
module.exports = exports = mount;
