import prisma from "../utils/prisma.js";
import crypto from "crypto";

export default async function webhookRoutes(fastify) {
  // Parse raw JSON body for signature verification
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: 1024 * 1024 },
    (req, body, done) => done(null, body)
  );

  fastify.post("/webhook", async (request, reply) => {
    const { order_id, status, amount, email, plan } = request.body;

    try {
      if (!order_id || !email) {
        return reply.status(400).send({ error: "Missing required fields" });
      }

      // Verify SenangPay signature (HMAC SHA256 of request body)
      const expectedSignature = request.headers["x-senangpay-signature"];
      const computedSignature = crypto
        .createHmac("sha256", process.env.SENANGPAY_SECRET_KEY)
        .update(JSON.stringify(request.body))
        .digest("hex");

      if (computedSignature !== expectedSignature) {
        return reply.status(400).send({ error: "Invalid signature" });
      }

      // Idempotency: check if payment already recorded
      const existingPayment = await prisma.payment.findUnique({
        where: { gatewayPaymentId: order_id },
      });

      if (existingPayment) {
        return reply.send({ received: true });
      }

      // Fetch the user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Record the payment
      await prisma.payment.create({
        data: {
          userId: user.id,
          gatewayPaymentId: order_id,
          amount: parseFloat(amount),
          currency: "MYR",
          status,
          plan,
        },
      });

      // Upgrade user if payment succeeded
      if (status === "success") {
        const proExpiry = new Date();
        proExpiry.setFullYear(proExpiry.getFullYear() + 1); // 1 year PRO

        // Update user tier and PRO expiry
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "PRO",
            proExpiry,
          },
        });

        // Create or update subscription record
        await prisma.subscription.upsert({
          where: {
            userId_plan: { userId: user.id, plan: plan || "PRO_YEARLY" },
          },
          update: {
            status: "ACTIVE",
            currentPeriodEnd: proExpiry,
          },
          create: {
            userId: user.id,
            plan: plan || "PRO_YEARLY",
            status: "ACTIVE",
            currentPeriodEnd: proExpiry,
          },
        });

        console.log(`User ${user.email} upgraded to PRO until ${proExpiry}`);
      } else {
        console.log(`Payment not successful for ${user.email}: ${status}`);
      }

      reply.send({ received: true });
    } catch (err) {
      console.error("Failed to process SenangPay webhook:", err);
      reply.status(500).send({ error: "Internal server error" });
    }
  });
}
