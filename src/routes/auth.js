import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateToken } from "../utils/jwt.js";

export default async function authRoutes(app) {
  // Apply rate limiting for sensitive endpoints
  app.register(import("fastify-rate-limit"), {
    max: 5, // Max 5 requests
    timeWindow: "1 minute", // per minute
    keyGenerator: (req) => req.ip, // Limit per IP
    errorResponseBuilder: () => ({
      error: "Too many requests, try again later",
    }),
  });

  // Register new user
  app.post("/register", async (req, reply) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return reply
          .code(400)
          .send({ error: "Email and password are required" });
      }

      if (password.length < 8) {
        return reply
          .code(400)
          .send({ error: "Password must be at least 8 characters" });
      }

      const existingUser = await app.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return reply.code(400).send({ error: "Email already registered" });
      }

      const hashedPassword = await hashPassword(password);

      const newUser = await app.prisma.user.create({
        data: {
          email,
          name: name || undefined,
          passwordHash: hashedPassword,
        },
      });

      const token = generateToken(app, newUser);

      return reply.code(201).send({
        success: true,
        message: "Registration successful",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.createdAt,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "Registration failed" });
    }
  });

  // Login user
  app.post("/login", async (req, reply) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return reply
          .code(400)
          .send({ error: "Email and password are required" });
      }

      const user = await app.prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.code(400).send({ error: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return reply.code(400).send({ error: "Invalid credentials" });
      }

      const token = generateToken(app, user);

      return reply.send({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "Login failed" });
    }
  });

  // Authenticated user profile
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const user = await app.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, createdAt: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return reply.send({ success: true, user });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: "Failed to fetch user profile" });
    }
  });
}
