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

// Validate essential environment variables
const requiredEnv = [
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "DATABASE_URL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// Create Fastify app
const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  },
});

// CORS configuration
app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// Security headers
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
});

// Rate limiting
app.register(rateLimit, {
  global: true,
  max: 200,
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
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// Raw body for Stripe webhooks
app.addHook("onRequest", (req, reply, done) => {
  if (req.url === "/api/stripe/webhook") {
    req.rawBody = "";
    req.raw.on("data", (chunk) => {
      req.rawBody += chunk;
    });
  }
  done();
});

app.addHook("preValidation", (req, reply, done) => {
  if (req.url === "/api/stripe/webhook") {
    req.body = req.rawBody;
  }
  done();
});

// Global error handler
app.setErrorHandler((err, req, reply) => {
  app.log.error(err);
  reply
    .code(err.statusCode || 500)
    .send({ error: err.message || "Internal Server Error" });
});

// API routes
app.register(authRoutes, { prefix: "/api/auth" });
app.register(transactionRoutes, { prefix: "/api/transactions" });
app.register(goalRoutes, { prefix: "/api/goals" });
app.register(diaryRoutes, { prefix: "/api/diary" });
app.register(aiInsightRoutes, { prefix: "/api/ai" });

// Stripe billing routes
app.register(customerRoutes, { prefix: "/api/stripe" });
app.register(checkoutRoutes, { prefix: "/api/stripe" });
app.register(webhookRoutes, { prefix: "/api/stripe" });

// Start server
const start = async () => {
  try {
    await app.listen({
      port: process.env.PORT || 3001,
      host: "0.0.0.0",
    });
    console.log("🚀 Server ready and running");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await app.prisma.$disconnect();
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down server...");
  await app.prisma.$disconnect();
  await app.close();
  process.exit(0);
});
