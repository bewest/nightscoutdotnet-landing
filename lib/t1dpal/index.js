
var crypto = require('crypto');
var request = require('request');

function T1DPal (opts) {
  return this;
}
T1DPal.prototype = {

};


function middleware (app, passport) {
  var cookie_name =  't1dpal_sid';

  var create_url = app.config.proxy.backplane + '/sessions/create/';
  var fetch_url = app.config.proxy.backplane + '/sessions/get/';

  function before (req, res, next) {
    if (req.cookies.t1dpal_sid) {
      var api = fetch_url + req.cookies[cookie_name];
      
      request.get(api, {json: true}, function (err, raw, result) {
        if (err) return next(err);
        req.t1dpal = result;
        return next( );
      });
      // res.clearCookie(cookie_name, { path: '/',  domain: app.config.cookie.domain });
    } else {
      next( );
    }
  }

  function middle (req, res, next) {
    console.log('global session', req.t1dpal);
    if (req.t1dpal && req.t1dpal.ttl > 60) return next( );
    var ip = req.header('X-Forwarded-For') || req.ip;
    var api = app.config.proxy.backplane + '/sessions/create/' + req.user.roles.account.id + '?ttl=86400&ip=' + ip;
    // TODO: also get API_SECRET hash
    var key = req.user.roles.account.sites[0].key;
    console.log('getting secret key for', key);
    if (key) {
      var resource_url = app.config.proxy.backplane + '/resource/' + key + '/compute';
      request.get({url: resource_url, json: true}, function (err, raw, multienv) {
        if (err) return next(err);
        if (multienv ? !multienv.custom_env : true) {
          var err = ({ok:0, msg: "multienv missing", url: resource_url, multienv:multienv });
          return next(err);
          res.status(500).json(err);
          return;
          // res.json(err);
        }
        var apisecret = multienv.custom_env.API_SECRET;
        var shasum = crypto.createHash('sha1');
        shasum.update(apisecret);
        var session = {
          api_secret: shasum.digest('hex')
        };

        request.put({url: api, json: session}, function (err, raw, result) {
          if (err) return next(err);
          console.log('new session', api, result);
          // req.t1dpal = result;
          res.cookie(cookie_name, result.token, { path: '/',  domain: app.config.cookie.domain });
          next( );
        });
      });
    }
    else {
      return next({ok:0, msg: "no site key"});
    }
  }

  function finish (req, res, next) {
    next( );
  }

  // return before;
  return [before, middle, finish];
}

module.exports = exports = middleware;

