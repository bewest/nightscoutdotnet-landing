'use strict';

exports.init = function(req, res){
  var sites = req.user.roles.account.sites;
  if (sites.length == 0) {
    res.redirect('/getting-started/starting');
    return;
  }
  res.render('account/index', req.user);
};
