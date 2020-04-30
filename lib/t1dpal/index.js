
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
    request.put({url: api, json: true}, function (err, raw, result) {
      if (err) return next(err);
      console.log('new session', api, result);
      // req.t1dpal = result;
      res.cookie(cookie_name, result.token, { path: '/',  domain: app.config.cookie.domain });
      next( );
    });
  }

  function finish (req, res, next) {
    next( );
  }

  // return before;
  return [before, middle, finish];
}

module.exports = exports = middleware;

