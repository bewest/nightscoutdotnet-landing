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

    this.scanCount = Number(options.scanCount) || 100;
    this.cachetime = Number(options.cachetime) || 0;
    delete options.scanCount;
    delete options.cachetime;

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
    else if (options.cachetimeout) {
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

    this.ttl = options.ttl;
    this.disableTTL = options.disableTTL;

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
      if (er) return fn(er);
      if (!data) return fn();

      var result;
      // data = data.toString();
      debug('GOT %s', data);

      try {
        // result = store.serializer.parse(data);
        result = data;
      }
      catch (er) {
        return fn(er);
      }
      return fn(null, result);
    });
  };

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

    try {
      var jsess = store.serializer.stringify(sess);
    }
    catch (er) {
      return fn(er);
    }

    args.push(jsess);

    if (!store.disableTTL) {
      var ttl = getTTL(store, sess, sid);
      args.push('EX', ttl);
      debug('SET "%s" %s ttl:%s', sid, jsess, ttl);
    } else {
      debug('SET "%s" %s', sid, jsess);
    }

    store.rs.set({app: store.appname, token: sid, d: sess}, function (er, resp) {
    store.client.set(args, function (er) {
      if (er) return fn(er);
      debug('SET complete');
      // fn.apply(null, arguments);
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
    if (Array.isArray(sid)) {
      var multi = this.client.multi();
      var prefix = this.prefix;
      sid.forEach(function (s) {
        multi.del(prefix + s);
      });
      multi.exec(fn);
    } else {
      sid = this.prefix + sid;
      this.client.del(sid, fn);
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
    var psid = store.prefix + sid;
    if (!fn) fn = noop;
    if (store.disableTTL) return fn();

    var ttl = getTTL(store, sess);

    debug('EXPIRE "%s" ttl:%s', sid, ttl);
    store.client.expire(psid, ttl, function (er) {
      if (er) return fn(er);
      debug('EXPIRE complete');
      fn.apply(this, arguments);
    });
  };

  /**
   * Fetch all sessions' Redis keys using non-blocking SCAN command
   *
   * @param {Function} fn
   * @api private
   */

  function allKeys (store, cb) {
    var keysObj = {}; // Use an object to dedupe as scan can return duplicates
    var pattern = store.prefix + '*';
    var scanCount = store.scanCount;
    debug('SCAN "%s"', pattern);
    (function nextBatch (cursorId) {
      store.client.scan(cursorId, 'match', pattern, 'count', scanCount, function (err, result) {
        if (err) return cb(err);

        var nextCursorId = result[0];
        var keys = result[1];

        debug('SCAN complete (next cursor = "%s")', nextCursorId);

        keys.forEach(function (key) {
          keysObj[key] = 1;
        });

        if (nextCursorId != 0) {
          // next batch
          return nextBatch(nextCursorId);
        }

        // end of cursor
        return cb(null, Object.keys(keysObj));
      });
    })(0);
  }

  /**
   * Fetch all sessions' ids
   *
   * @param {Function} fn
   * @api public
   */

  RedisSessionsStore.prototype.ids = function (fn) {
    var store = this;
    var prefixLength = store.prefix.length;
    if (!fn) fn = noop;

    allKeys(store, function (err, keys) {
      if (err) return fn(err);

      keys = keys.map(function (key) {
        return key.substr(prefixLength);
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

    allKeys(store, function (err, keys) {
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

    allKeys(store, function (err, keys) {
      if (err) return fn(err);

      if (keys.length === 0) return fn(null,[]);

      store.client.mget(keys, function (err, sessions) {
        if (err) return fn(err);

        var result;
        try {
          result = sessions.map(function (data, index) {
            data = data.toString();
            data = store.serializer.parse(data);
            data.id = keys[index].substr(prefixLength);
            return data;
          });
        } catch (e) {
          err = e;
        }

        return fn(err, result);
      });
    });
  };

  return RedisSessionsStore;
};
