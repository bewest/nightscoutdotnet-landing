/* global app:true */

(function() {
  'use strict';

  app = app || {};

  app.Signup = Backbone.Model.extend({
    url: '/signup/social/',
    defaults: {
      errors: [],
      errfor: {},
      tos_signed_by: '',
      tos_signed_at: '',
      privacy_signed_by: '',
      privacy_signed_at: '',
      username: '',
      displayName: '',
      email: ''
    }
  });

  app.SignupView = Backbone.View.extend({
    el: '#signup',
    template: _.template( $('#tmpl-signup').html() ),
    events: {
      'submit form': 'preventSubmit',
      'keypress [name="password"]': 'signupOnEnter',
      'click .btn-signup': 'signup'
    },
    initialize: function() {
      this.model = new app.Signup();
      this.model.set('email', $('#data-email').text());
      this.model.set('username', $('#data-username').text());
      this.model.set('displayName', $('#data-displayName').text());
      this.listenTo(this.model, 'sync', this.render);
      this.render();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
      this.$el.find('[name="email"]').focus();
    },
    preventSubmit: function(event) {
      event.preventDefault();
    },
    signupOnEnter: function(event) {
      if (event.keyCode !== 13) { return; }
      event.preventDefault();
      this.signup();
    },
    signup: function() {
      this.$el.find('.btn-signup').attr('disabled', true);

      this.model.save({
        tos_signed_at: this.$el.find('[name="tos_signed_at"]').val() || (new Date).toISOString( ),
        tos_signed_by: this.$el.find('[name="tos_signed_by"]:checked').val(),
        privacy_signed_at: this.$el.find('[name="privacy_signed_at"]').val() || (new Date).toISOString( ),
        privacy_signed_by: this.$el.find('[name="privacy_signed_by"]:checked').val(),
        username: this.$el.find('[name="username"]').val(),
        email: this.$el.find('[name="email"]').val()
      },{
        success: function(model, response) {
          if (response.success) {
            location.href = '/account/';
          }
          else {
            model.set(response);
          }
        }
      });
    }
  });

  $(document).ready(function() {
    app.signupView = new app.SignupView();
  });
}());
