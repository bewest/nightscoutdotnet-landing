function render_landing (req, res) {
  var view = req.params.landing || 'home';
  res.render('landing/' + view);
};

function mount (app, passport) {


  var ctx = app.ctx;
  var config = app.config;
  function ware (req, res, next) {
    console.log('getting started', req.session, req.user, res.locals.servicebotSettings);
    // req.params.landing
    return next( );
    // req.session;
  }

  ware.starting = function (req, res, next) {
    // if has a price in session or in uri, but not user, send to register
    // otherwise, show landing page with defaults
    if (req.session.selected_product) {
      return res.redirect('/getting-started/register/' + req.session.selected_product);
    }

    if (req.user) {
      return res.redirect('/getting-started/checkout');
    }
    res.locals.servicebotSettings.type = 'pricing';
    next( );
  };


  ware.register = function (req, res, next) {
    // if no user, show login page
    // if no price go back to starting?
    if (!req.session.selected_product && req.params.tier) {
      req.session.selected_product = req.params.tier
    }
    console.log(req.session.selected_product, req.user);
    // if user, go to checkout
    // if (!req.user)
    // res.render('signup/');
    if (!req.session.selected_product) {
      return res.redirect('./starting/');
    }
    if (req.user) {
      return res.redirect('../checkout');
    }
    next( );
  }

  ware.checkout =  [config_checkout, render_checkout];

  function render_checkout (req, res, next) {
    res.locals.email = req.user.email;
    res.render('getting-started/index');
  }

  function config_checkout (req, res, next) {
    // if user and price, show checkout page
    if (!req.user) {
      res.redirect('./register');
    }
    console.log(req.session.selected_product);
    console.log(req.user);

		res.locals.servicebotSettings.options.behavior.signup = {
                "showAsPage": true,
                "allowChooseAnotherPlan": true,
                "afterSuccessfulSignup": "success_message"
            };
 

    res.locals.servicebotSettings.type = 'signup';
    res.locals.servicebotSettings.tier = req.session.selected_product;
    res.locals.servicebotSettings.interval = 'month';
    next( );
  }

  ware.activate = function (req, res, next) {
    // clearly a new site
    // redirect?
    next( );

  }
  ware.render_landing = render_landing;
  return ware;

}
module.exports = exports = mount;
mount.render_landing = render_landing;
