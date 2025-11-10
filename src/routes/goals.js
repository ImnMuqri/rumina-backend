import { generateGoalProgressInsight } from "../services/aiInsights.js";

export default async function goalRoutes(app) {
  // Get all goals with AI insight
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const goals = await app.prisma.goal.findMany({
        where: { userId: req.user.id },
      });

      const userData = { goals };
      const aiInsight = await generateGoalProgressInsight(userData);

      return reply.code(200).send({
        success: true,
        data: {
          goals,
          ruminaInsight: aiInsight.ruminaInsight,
        },
      });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch goals and insights",
      });
    }
  });

  // Create new goal
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { title, category, targetAmount, targetDate } = req.body;

      // Validation
      if (!title || !category || !targetAmount || !targetDate) {
        return reply
          .code(400)
          .send({ success: false, error: "Missing required fields" });
      }

      const goal = await app.prisma.goal.create({
        data: {
          userId: req.user.id,
          title,
          category,
          targetAmount,
          targetDate: new Date(targetDate),
          status: "On Track",
        },
      });

      return reply.code(201).send({ success: true, goal });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to create goal",
      });
    }
  });

  // Update goal progress
  app.patch("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { id } = req.params;
      const { savedAmount } = req.body;

      if (savedAmount === undefined || isNaN(savedAmount)) {
        return reply
          .code(400)
          .send({ success: false, error: "Invalid savedAmount" });
      }

      // Verify ownership
      const existingGoal = await app.prisma.goal.findUnique({
        where: { id: Number(id) },
      });
      if (!existingGoal || existingGoal.userId !== req.user.id) {
        return reply
          .code(403)
          .send({ success: false, error: "Not authorized" });
      }

      // Atomic update of savedAmount and status
      const updatedGoal = await app.prisma.goal.update({
        where: { id: Number(id) },
        data: {
          savedAmount,
          status:
            savedAmount >= existingGoal.targetAmount
              ? "Completed"
              : savedAmount / existingGoal.targetAmount >= 0.7
              ? "On Track"
              : "Behind",
        },
      });

      return reply.code(200).send({ success: true, goal: updatedGoal });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to update goal",
      });
    }
  });

  // Delete goal
  app.delete("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { id } = req.params;

      const existingGoal = await app.prisma.goal.findUnique({
        where: { id: Number(id) },
      });
      if (!existingGoal || existingGoal.userId !== req.user.id) {
        return reply
          .code(403)
          .send({ success: false, error: "Not authorized" });
      }

      await app.prisma.goal.delete({ where: { id: Number(id) } });
      return reply.code(200).send({ success: true });
    } catch (error) {
      req.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to delete goal",
      });
    }
  });
}
