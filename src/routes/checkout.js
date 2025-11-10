import prisma from "../utils/prisma.js";
import crypto from "crypto";

export default async function checkoutRoutes(fastify) {
  fastify.post(
    "/create-checkout-session",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const { plan } = request.body; // e.g., "PRO_YEARLY"

        // Fetch user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        // Define plans and pricing
        const plans = {
          PRO_YEARLY: 200, // RM 499 per year
        };

        const amount = plans[plan];
        if (!amount) {
          return reply.status(400).send({ error: "Invalid plan selected" });
        }

        const merchantId = process.env.SENANGPAY_MERCHANT_ID;
        const callbackUrl = process.env.SENANGPAY_CALLBACK_URL;
        const redirectSuccess = process.env.SENANGPAY_SUCCESS_URL;
        const redirectCancel = process.env.SENANGPAY_CANCEL_URL;

        // Generate unique order ID for payment tracking
        const orderId = `PRO_${userId}_${Date.now()}`;

        // Create SenangPay signature
        const signaturePayload = `${merchantId}${orderId}${amount}${process.env.SENANGPAY_SECRET_KEY}`;
        const signature = crypto
          .createHash("sha256")
          .update(signaturePayload)
          .digest("hex");

        // Save the pending payment in the database for idempotency
        await prisma.payment.create({
          data: {
            userId,
            gatewayPaymentId: orderId,
            amount,
            currency: "MYR",
            status: "pending",
            plan,
          },
        });

        // Generate SenangPay payment URL
        const paymentUrl = `https://app.senangpay.com.my/payment/${merchantId}?amount=${amount}&order_id=${orderId}&email=${encodeURIComponent(
          user.email
        )}&callback_url=${encodeURIComponent(
          callbackUrl
        )}&return_url=${encodeURIComponent(
          redirectSuccess
        )}&cancel_url=${encodeURIComponent(
          redirectCancel
        )}&signature=${signature}`;

        return reply.send({ url: paymentUrl });
      } catch (err) {
        fastify.log.error("SenangPay checkout session creation failed:", err);
        return reply.status(500).send({
          error: "Failed to create SenangPay checkout session",
          message: err.message,
        });
      }
    }
  );
}
