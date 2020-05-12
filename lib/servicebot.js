
function get_id ( ) {
}

const crypto = require("crypto");

function generate_email_hash (key, email) {
  const email_hash = crypto.createHmac(
      "sha256", key // SECRET KEY (KEEP SAFE!)
  ).update(email).digest("hex") // PASS THIS TO FRONT-END
  return email_hash;

}


function settings (id, service, coupon) {

  var servicebotSettings = {
      "servicebot_id": id,
      "service": service || "Flat Monthly",
      // "coupon": "0F6VFZVh",
      "coupon": coupon,
      "options": {
          "behavior": {
              "pricing": {
                  "showPriceAsMonth": false,
                  "afterSuccessfulSignup": "success_message"
              }
          }
      },
      // "type": "pricing",
      "integration": "html"
  };
  return servicebotSettings;

}


function mount (app, passport) {


var ctx = app.ctx;
var config = app.config;

var servicebot_id = config.servicebot_id;
var servicebot_key = config.servicebot_key;
var servicebot_service = config.servicebot_service;
var servicebot_default_coupon = config.servicebot_default_coupon;
// type = [ 'pricing', 'signup', 'portal' ];

  function ware (req, res, next) {
    res.locals.servicebot_id = servicebot_id;
    // res.locals.
    var servicebotSettings = settings(servicebot_id, servicebot_service, config.servicebot_default_coupon);
    var coupon = req.query.coupon || req.session.coupon;
    if (coupon && !req.session.coupon) req.session.coupon = coupon;
    if (coupon) {
      servicebotSettings.coupon = coupon;
    }
    if (req.user) {
      servicebotSettings.email = req.user.email;
      servicebotSettings.hashed_email = generate_email_hash(servicebot_key, req.user.email);
    }
    res.locals.servicebotSettings = servicebotSettings;
    next( );
  };

  return ware;

}
module.exports = exports = mount;

mount.generate_email_hash = generate_email_hash;
mount.settings = settings;


