

$(document).ready(function ( ) {

  function render (ev, data) {
    var form = $(ev.delegateTarget);
    form.find('.dexcom.username').val(data.creds.accountName);
    form.find('.dexcom.password').val(data.creds.password);
    // form.find( ).value( );
  }

  function initialize (ev) {
    var url = $(this).data('action');
    console.log('url', url, $(this).data());
    $.ajax({url: url}).done(function (data, status, xhr) {
      console.log('GOT data', data);
      $(ev.target).trigger('data', [data]);
    });

  }

  function changed (ev) {
    var form = $(ev.delegateTarget);
    var url = form.data('action');
    var data = form.serialize( );
    console.log('form', url, data);
    $.post(url, data, function (body, status, xhr) {
      console.log('saved', url, data, arguments);
      // form.trigger('data', [body.attempt.settings]);
    });
  }

  console.log('bridging');
  $('#DexcomLogin').on('init', initialize);
  $('#DexcomLogin').on('data', render);
  // $('#DexcomLogin').on('change', changed);
  $('#DexcomLogin').on('click', '.btn', changed);
  $('#DexcomLogin').trigger('init');
});

