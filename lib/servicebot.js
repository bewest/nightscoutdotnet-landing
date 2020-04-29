
function get_id ( ) {
}

const crypto = require("crypto");

function generate_email_hash (key, email) {
  const email_hash = crypto.createHmac(
      "sha256", key // SECRET KEY (KEEP SAFE!)
  ).update(email).digest("hex") // PASS THIS TO FRONT-END
  return email_hash;

}


function settings (id) {

  var servicebotSettings = {
      "servicebot_id": id,
      "service": "Flat Monthly",
      // "coupon": "0F6VFZVh",
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
// type = [ 'pricing', 'signup', 'portal' ];

  function ware (req, res, next) {
    res.locals.servicebot_id = servicebot_id;
    // res.locals.
    var servicebotSettings = settings(servicebot_id);
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


