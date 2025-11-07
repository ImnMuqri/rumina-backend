const priceIdToTier = require("../config/stripePrices");
const { stripe } = require("../services/stripeService");
const prisma = require("../utils/prisma");

module.exports = async function (fastify) {
  // Preserve raw body for Stripe signature
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: 1024 * 1024 },
    function (req, body, done) {
      done(null, body);
    }
  );

  fastify.post("/webhook", async (request, reply) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Stripe webhook error:", err.message);
      return reply.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "invoice.paid": {
          const subscription = event.data.object;
          const priceId = subscription.items.data[0].price.id;
          const tier = priceIdToTier[priceId] || "FREE";

          await prisma.user.updateMany({
            where: { stripeId: subscription.customer },
            data: { tier },
          });

          await prisma.subscription.updateMany({
            where: { stripeSubId: subscription.id },
            data: {
              status: subscription.status.toUpperCase(),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          });
          break;
        }

        case "customer.subscription.deleted": {
          const customer = event.data.object.customer;
          const subId = event.data.object.id;

          await prisma.user.updateMany({
            where: { stripeId: customer },
            data: { tier: "FREE" },
          });

          await prisma.subscription.updateMany({
            where: { stripeSubId: subId },
            data: { status: "CANCELED" },
          });
          break;
        }

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (err) {
      console.error("Database update failed", err);
      return reply.status(500).send({ error: "Database update failed" });
    }

    reply.send({ received: true });
  });
};
