const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function createCustomer(email) {
  return await stripe.customers.create({ email });
}

async function createCheckoutSession(
  customerId,
  priceId,
  successUrl,
  cancelUrl
) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

module.exports = { createCustomer, createCheckoutSession, stripe };
