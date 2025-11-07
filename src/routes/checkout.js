const prisma = require("../utils/prisma");
const { createCheckoutSession } = require("../services/stripeService");

module.exports = async function (fastify) {
  fastify.post("/create-checkout-session", async (request, reply) => {
    const { userId, priceId } = request.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const session = await createCheckoutSession(
      user.stripeId,
      priceId,
      "https://yourdomain.com/success",
      "https://yourdomain.com/cancel"
    );
    reply.send({ url: session.url });
  });
};
