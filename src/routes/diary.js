import { generateDiaryResponse } from "../services/diaryService.js";

export default async function financialDiaryRoutes(app) {
  // Get all diary entries for the authenticated user
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const entries = await app.prisma.financialDiary.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.code(200).send({ success: true, entries });
    } catch (err) {
      app.log.error(err);
      return reply
        .code(500)
        .send({ success: false, error: "Failed to fetch diary entries" });
    }
  });

  // Create a new diary entry and generate AI insight
  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["content"],
          properties: {
            mood: { type: "string", maxLength: 50 },
            content: { type: "string", minLength: 3 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { mood, content } = req.body;

        if (!content || content.trim().length < 3) {
          return reply
            .code(400)
            .send({ success: false, error: "Content is too short" });
        }

        // Generate Rumina's AI insight
        const aiInsight = await generateDiaryResponse(content);

        const entry = await app.prisma.financialDiary.create({
          data: {
            userId: req.user.id,
            mood: mood || "Neutral",
            content,
            aiInsight,
          },
        });

        return reply.code(201).send({ success: true, entry });
      } catch (err) {
        app.log.error(err);
        return reply
          .code(500)
          .send({ success: false, error: "Failed to create diary entry" });
      }
    }
  );

  // Delete a diary entry (ownership verified)
  app.delete("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { id } = req.params;
      const entry = await app.prisma.financialDiary.findUnique({
        where: { id: Number(id) },
      });

      if (!entry || entry.userId !== req.user.id) {
        return reply
          .code(403)
          .send({ success: false, error: "Not authorized or not found" });
      }

      await app.prisma.financialDiary.delete({ where: { id: Number(id) } });
      return reply.code(200).send({ success: true });
    } catch (err) {
      app.log.error(err);
      return reply
        .code(500)
        .send({ success: false, error: "Failed to delete diary entry" });
    }
  });
}
