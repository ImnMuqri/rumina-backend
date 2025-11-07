import { encrypt, decrypt } from "../utils/encryption.js";

export default async function transactionRoutes(app) {
  // Get all transactions (paginated)
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const page = parseInt(req.query.page || "1", 10);
      const limit = parseInt(req.query.limit || "20", 10);
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        app.prisma.transaction.findMany({
          where: { userId: req.user.id },
          orderBy: { date: "desc" },
          skip,
          take: limit,
        }),
        app.prisma.transaction.count({ where: { userId: req.user.id } }),
      ]);

      const decrypted = transactions.map((t) => ({
        ...t,
        amount: parseFloat(decrypt(t.amount)),
      }));

      return {
        data: decrypted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "Failed to fetch transactions" });
    }
  });

  // Create a transaction
  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["type", "category", "amount"],
          properties: {
            type: { type: "string", enum: ["income", "expense"] },
            category: { type: "string", minLength: 1 },
            amount: { type: "number", minimum: 0 },
            description: { type: "string", maxLength: 255 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { type, category, amount, description } = req.body;
        const encryptedAmount = encrypt(amount);

        const transaction = await app.prisma.transaction.create({
          data: {
            userId: req.user.id,
            type,
            category,
            amount: encryptedAmount,
            description,
          },
        });

        return { success: true, transaction };
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ error: "Failed to create transaction" });
      }
    }
  );

  // Delete a transaction (ownership verified)
  app.delete("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { id } = req.params;
      const transaction = await app.prisma.transaction.findUnique({
        where: { id: Number(id) },
      });

      if (!transaction || transaction.userId !== req.user.id) {
        return reply.code(403).send({ error: "Not authorized or not found" });
      }

      await app.prisma.transaction.delete({ where: { id: Number(id) } });
      return { success: true };
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "Failed to delete transaction" });
    }
  });

  // Summary (income, expense, savings)
  app.get(
    "/summary",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const transactions = await app.prisma.transaction.findMany({
          where: { userId: req.user.id },
        });

        let income = 0;
        let expense = 0;

        for (const t of transactions) {
          const amount = parseFloat(decrypt(t.amount));
          if (t.type === "income") income += amount;
          else expense += amount;
        }

        const savings = income - expense;
        return { income, expense, savings };
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ error: "Failed to calculate summary" });
      }
    }
  );
}
