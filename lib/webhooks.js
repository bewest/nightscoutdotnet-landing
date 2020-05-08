
function mount (app, passport) {


  var ctx = app.ctx;
  var config = app.config;
  function ware (req, res, next) {
    console.log('web hook', req.body, req.params);
    console.log('web hook', req.headers);
    // req.params.landing
    const event = req.body;
    switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      // Then define and call a method to handle the successful payment intent.
      // handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_method.attached':
      const paymentMethod = event.data.object;
      // Then define and call a method to handle the successful attachment of a PaymentMethod.
      // handlePaymentMethodAttached(paymentMethod);
      break;
    case 'payment_intent.payment_failed':
    case 'payment_intent.created':
    case 'charge.succeeded':
      // ... handle other event types
      break;
    default:
      // Unexpected event type
      return res.status(400).end();
    }

    // Return a response to acknowledge receipt of the event
    res.json({ok: 1, received: true, debug: event});
    // req.session;
  }

  return ware;
}
module.exports = exports = mount;
