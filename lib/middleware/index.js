/*!
 * express-redis-sessions
 * 
 * Make [redis-sessions](https://www.npmjs.com/package/redis-sessions)
 * Compliant with sessionStore protocol [express-sessions](https://github.com/expressjs/session#session-store-implementation)
 * Adapted from:
 * Connect - Redis
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

var debug = require('debug')('express:redis-sessions');
var RedisSessions = require("redis-sessions");
var redis = require('redis');
var util = require('util');
var noop = function(){};

/**
 * One day in seconds.
 */

var oneDay = 86400;

function getTTL(store, sess, sid) {
  if (typeof store.ttl === 'number' || typeof store.ttl === 'string') return store.ttl;
  if (typeof store.ttl === 'function') return store.ttl(store, sess, sid);
  if (store.ttl) throw new TypeError('`store.ttl` must be a number or function.');

  var maxAge = sess.cookie.maxAge;
  return (typeof maxAge === 'number'
    ? Math.floor(maxAge / 1000)
    : oneDay);
}

const generateId = RedisSessions.prototype._createToken;
_ = require("lodash");

RedisSessions.prototype.createWithToken = function createWithToken (options, cb) {
    var e, mc, nullkeys, thesession, token;
    options.d = options.d || {
      ___duMmYkEy: null
    };
    options = this._validate(options, ["app", "id",  "ip", "ttl", "d", "no_resave"], cb);
    if (options === false) {
      return;
    }
    token = options.token;
    delete options.token;
    mc = this._createMultiStatement(options.app, token, options.id, options.ttl, false);
    mc.push(["sadd", "" + this.redisns + options.app + ":us:" + options.id, token]);
    thesession = ["hmset", "" + this.redisns + options.app + ":" + token, "id", options.id, "r", 1, "w", 1, "ip", options.ip, "la", this._now(), "ttl", parseInt(options.ttl)];
    if (options.d) {
      nullkeys = [];
      for (e in options.d) {
        if (options.d[e] === null) {
          nullkeys.push(e);
        }
      }
      options.d = _.omit(options.d, nullkeys);
      if (_.keys(options.d).length) {
        thesession = thesession.concat(["d", JSON.stringify(options.d)]);
      }
    }
    if (options.no_resave) {
      thesession.push("no_resave");
      thesession.push(1);
    }
    mc.push(thesession);
    this.redis.multi(mc).exec(function(err, resp) {
      if (err) {
        cb(err);
        return;
      }
      if (resp[4] !== "OK") {
        cb("Unknow error");
        return;
      }
      cb(null, {
        token: token
      });
    });
};

/**
 * Return the `RedisSessionsStore` extending `express`'s session Store.
 *
 * @param {object} express session
 * @return {Function}
 * @api public
 */

module.exports = function (session) {

  /**
   * Express's session Store.
   */

  var Store = session.Store;

  /**
   * Initialize RedisSessionsStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  const prepareSession = Store.prototype.createSession;


  function RedisSessionsStore (options) {
    if (!(this instanceof RedisSessionsStore)) {
      throw new TypeError('Cannot call RedisSessionsStore constructor as a function');
    }

    var self = this;

    options = options || {};
    Store.call(this, options);
    this.prefix = options.prefix == null
      ? 'sess:'
      : options.prefix;

    delete options.prefix;
    // options.namespace = prefix;

    this.appname = String(options.appname) || 'ers';
    this.scanCount = Number(options.scanCount) || 100;
    this.cachetime = Number(options.cachetime) || 0;
    delete options.scanCount;
    delete options.cachetime;
    delete options.appname;

    // this.serializer = options.serializer || JSON;
    this.tap = noop;

    if (options.url) {
      options.socket = options.url;
    }

    // convert to redis connect params
    if (options.client) {
      this.client = options.client;
    }
    /*
    else if (options.cachetimeout) { }
    else if (options.socket) {
      // this.client = redis.createClient(options.socket, options);
    }
    */
    else {
      // 
      var rs_opts = { namespace: this.prefix
                    , cachetime: this.cachetime
                    , client: this.client || null
                    , options: options };
      this.rs = new RedisSessions(rs_opts);
      // this.client = redis.createClient(options);
    }

    // logErrors
    if(options.logErrors){
      // if options.logErrors is function, allow it to override. else provide default logger. useful for large scale deployment
      // which may need to write to a distributed log
      if(typeof options.logErrors != 'function'){
        options.logErrors = function (err) {
          console.error('Warning: connect-redis reported a client error: ' + err);
        };
      }
      this.rs.on('error', options.logErrors);
    }

    /*
    if (options.pass) {
      this.client.auth(options.pass, function (err) {
        if (err) {
          throw err;
        }
      });
    }
    */

    this.ttl = options.ttl
    // this.disableTTL = options.disableTTL;

    /*
    if (options.unref) this.client.unref();
    */

    /*
    if ('db' in options) {
      if (typeof options.db !== 'number') {
        console.error('Warning: connect-redis expects a number for the "db" option');
      }

      self.client.select(options.db);
      self.client.on('connect', function () {
        self.client.select(options.db);
      });
    }
    */

    self.rs.on('error', function (er) {
      debug('Redis returned err', er);
      self.emit('disconnect', er);
    });

    self.rs.on('connect', function () {
      self.emit('connect');
    });
  }

  /**
   * Inherit from `Store`.
   */

  util.inherits(RedisSessionsStore, Store);


  RedisSessionsStore.prototype.initSession = function createSession (sess) {
    var store = this;
    var memo = prepareSession(req, sess);
    memo.app = store.appname;
    memo.id = sess.id;
    memo.ip = sess.req.ip;
    memo.ttl = store.ttl;
    // var d = { };
    var insertion = {
      app: store.appname
    , id: "user_id"
    , ip: "ip"
    , ttl: store.ttl
    //, d: d
    // , no_resave: false
    };
    return memo;
  }
  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.get = function (sid, fn) {
    var store = this;
    if (!fn) fn = noop;
    debug('GET "%s"', sid);

    store.rs.get({ app: store.appname, token: sid }, function (er, data) {
      console.log('GOT %s', data, arguments);
      if (er) return fn(er);
      if (!data) return fn();
      if (!data.token) return fn( );

      var result;
      var sess = data.d || {};
      var meta = _.pick(data, "id", "idle", "ip", "ttl", "r", "w");
      meta.ttl = meta.ttl || getTTL(store, sess, sid);
      sess.id = data.token;
      sess.id = sid;
      sess._meta = meta;
      // sess.cookie = sess.cookie || data.d.cookie || { };

      // data = data.toString();
      // console.log('GOT %s', data, arguments);

      try {
        result = data;
        // result = sess;
      }
      catch (err) {
        return fn(err);
      }
      return fn(null, result);
    });
  };

  function attrs (sess) {
		var _ret = { };
    var _v;
    for (var _k in sess) {
			// _ret[ _k ] = _v if _k isnt "_meta" and ( _v is null or typeof _v in [ "string", "number", "boolean" ] )
			if (_k != "_meta") {
        _v = sess[_k];
        if (_v == null || typeof _v in [ "string", "number", "boolean" ]) {
          _rest[ _k ] = _v;
        }
      }
    }
		return _ret
  }

  function _redis_to_session (data) {
    var memo = { };
    var sess = {
    };
  }
  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.set = function (sid, sess, fn) {
    var store = this;
    var args = [store.prefix + sid];
    if (!fn) fn = noop;

    // Upsert Logic: Check First
    console.log("SET", sid, sess);
    store.rs.get({ app: store.appname, token: sid }, function (err, data) {
      if (err) return fn(err);
      // if there's no session for this
      if (!data || !data.token) {
        var memo = { };
        memo.app = store.appname;
        memo.ip = sess.req.ip;
        memo.ttl = getTTL(store, sess, sid);

        memo.id = sess.passport || sess.id;
        memo.token = sid;
        // memo.d = attrs(sess);

        // memo.d = { cookie : sess.cookie }
        // memo.d = { };
        // memo.cookie = sess.cookie;
        console.log("create session?", memo, sess);
        // return store.rs.create(memo, function (err, resp) { })
        return store.rs.createWithToken(memo, function (err, resp) {

          console.log("response from rs", err, resp);
          if (err) return fn(err);

          if (resp && resp.token != memo.token) {
          }
          // sess.session = memo;
          fn.apply(null, arguments);
          // fn(null, sess);
        });
        

      } else {

        console.log('setting from pre-existing', sess);
        var update = { app: store.appname, token: sid };
        var datum = sess;
        if (datum.app != store.appname || datum.token != sid) {
          //
          debug("Token and sid do not match!?");
          // datum.app = store.appname;
          // datum.token = sid;
        }
        return store.rs.set(update, function (er, resp) {
          if (er) return fn(er);
          debug('SET complete');
          // if (resp.id) return fn(null);
          fn.apply(null, arguments);
        });
      }
    });
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  RedisSessionsStore.prototype.destroy = function (sid, fn) {
    debug('DEL "%s"', sid);
    var store = this;
    if (!Array.isArray(sid)) {
      return store.rs.kill({app: store.appname, token: sid }, fn);
    } else {
      return fn("destroy only takes one sid");
    }
  };

  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.touch = function (sid, sess, fn) {
    var store = this;
    if (!fn) fn = noop;
    // if (store.disableTTL) return fn();

    store.rs.get({app: store.appname, token: sid }, function (er) {
      if (er) return fn(er);
      debug('touch complete');
      fn.apply(this, arguments);
    });
  };


  /**
   * Fetch all sessions' ids
   *
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.ids = function (fn) {
    var store = this;


    if (!fn) fn = noop;

    store.rs.soid({app: store.appname }, function (err, resp) {
      keys = resp.forEach(function (item) {
        return item.token;
      });
      return fn(null, keys);
    });
  };

  /**
   * Fetch count of all sessions
   *
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.length = function (fn) {
    var store = this;
    if (!fn) fn = noop;

    store.rs.soid({app: store.appname }, function (err, keys) {
      if (err) return fn(err);

      return fn(null, keys.length);
    });
  };


  /**
   * Fetch all sessions
   *
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.all = function (fn) {
    var store = this;
    var prefixLength = store.prefix.length;
    if (!fn) fn = noop;

    store.rs.soid({app: store.appname }, function (err, result) {

      if (err) return fn(err);
      return fn(err, result);

    });
  };

  RedisSessionsStore.generateId = generateId;
  return RedisSessionsStore;
};

module.exports.generateId = generateId;

