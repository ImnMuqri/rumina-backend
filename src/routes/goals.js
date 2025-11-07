import { generateGoalProgressInsight } from "../services/aiInsights.js";

export default async function goalRoutes(app) {
  // Get all goals with AI insight
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      // 1. Fetch user's goals from Prisma
      const goals = await app.prisma.goal.findMany({
        where: { userId: req.user.id },
      });

      // 2. Prepare user data for AI prompt
      const userData = { goals };

      // 3. Generate AI insight using the modular service
      const aiInsight = await generateGoalProgressInsight(userData);

      // 4. Combine database goals with Rumina AI insights
      const result = {
        goals,
        ruminaInsight: aiInsight.ruminaInsight,
      };

      return reply.code(200).send({
        success: true,
        data: result,
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
    const { title, category, targetAmount, targetDate } = req.body;
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
    return reply.code(201).send(goal);
  });

  // Update goal progress
  app.patch("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { savedAmount } = req.body;
    const { id } = req.params;

    const goal = await app.prisma.goal.update({
      where: { id: Number(id) },
      data: { savedAmount },
    });

    let status = "Behind";
    if (goal.savedAmount >= goal.targetAmount) status = "Completed";
    else if (goal.savedAmount / goal.targetAmount >= 0.7) status = "On Track";

    const updatedGoal = await app.prisma.goal.update({
      where: { id: goal.id },
      data: { status },
    });

    return reply.send(updatedGoal);
  });

  // Delete goal
  app.delete("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params;
    await app.prisma.goal.delete({ where: { id: Number(id) } });
    return { success: true };
  });
}
