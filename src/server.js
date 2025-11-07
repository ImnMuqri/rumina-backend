import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma.js";

import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";
import goalRoutes from "./routes/goals.js";
import diaryRoutes from "./routes/diary.js";
import aiInsightRoutes from "./routes/insights.js";
import customerRoutes from "./routes/customer.js";
import checkoutRoutes from "./routes/checkout.js";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();

const app = Fastify({ logger: true });

// Security and performance
app.register(cors, {
  origin: ["https://yourfrontend.com"], // replace with your frontend
  methods: ["GET", "POST", "PUT", "DELETE"],
});
app.register(helmet);
app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// JWT setup
app.register(jwt, { secret: process.env.JWT_SECRET });

// Prisma plugin
app.register(prismaPlugin);

// Auth decorator
app.decorate("authenticate", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// Global error handler
app.setErrorHandler((err, req, reply) => {
  app.log.error(err);
  reply
    .code(err.statusCode || 500)
    .send({ error: err.message || "Internal Server Error" });
});

// API Routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(transactionRoutes, { prefix: "/api/transactions" });
app.register(goalRoutes, { prefix: "/api/goals" });
app.register(diaryRoutes, { prefix: "/api/diary" });
app.register(aiInsightRoutes, { prefix: "/api/ai" });

// Stripe Billing Routes
app.register(customerRoutes, { prefix: "/api/stripe" });
app.register(checkoutRoutes, { prefix: "/api/stripe" });
app.register(webhookRoutes, { prefix: "/api/stripe" }); // ensure webhook route handles rawBody

// Start server
const start = async () => {
  try {
    await app.listen({
      port: process.env.PORT || 3001,
      host: "0.0.0.0",
    });
    console.log("Server ready 🚀");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await app.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("Shutting down server...");
  await app.close();
  process.exit(0);
});
