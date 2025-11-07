import Fastify from "fastify";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

// Example route
fastify.get("/", async () => {
  return { message: "Finance API is running" };
});

// Get all transactions
fastify.get("/transactions", async () => {
  return await prisma.transaction.findMany();
});

// Add new transaction
fastify.post("/transactions", async (req, reply) => {
  const { type, category, amount, description } = req.body;
  const transaction = await prisma.transaction.create({
    data: { type, category, amount, description },
  });
  reply.code(201).send(transaction);
});

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
