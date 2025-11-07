import { generateCombinedInsight } from "../services/aiInsights.js";

export default async function insightsRoutes(app) {
  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const userId = req.user.id;
      const userData = req.body || {};

      // Validate or provide fallback data
      const hasValidData =
        userData.monthlyIncome &&
        userData.monthlyExpenses &&
        userData.totalSaved;

      const baseData = hasValidData
        ? userData
        : {
            monthlyIncome: 5800,
            monthlyExpenses: 4200,
            totalSaved: 18400,
            totalDebt: 1200,
            savingsChange: 8,
            expenseChange: -2,
            spendingCategories: [
              { category: "Food", amount: 1200 },
              { category: "Transport", amount: 400 },
              { category: "Entertainment", amount: 250 },
              { category: "Savings", amount: 1800 },
            ],
          };

      // Generate a single AI insight response
      const combinedInsight = await generateCombinedInsight(baseData);

      // Optional: store the result in Prisma (safe check)
      try {
        await app.prisma.aiInsight.create({
          data: {
            userId,
            date: new Date(),
            wellnessScore: combinedInsight.wellnessScore ?? 0,
            savingsRate: combinedInsight.savingsRate ?? 0,
            debtManagement:
              combinedInsight.debtManagement ?? "No data available",
            emergencyFund: combinedInsight.emergencyFund ?? "No data available",
            expenseControl:
              combinedInsight.expenseControl ?? "No data available",
          },
        });
      } catch (dbError) {
        app.log.warn(
          "AI Insight not stored, Prisma model may not exist:",
          dbError
        );
      }

      // Send response
      return reply.code(200).send({
        success: true,
        data: {
          financialWellness:
            combinedInsight.financialWellness || "No financial data available",
          lifestyleRecommendations:
            combinedInsight.lifestyleRecommendations ||
            "No lifestyle data available",
        },
      });
    } catch (error) {
      app.log.error("Insight generation failed:", error);
      return reply.code(500).send({
        success: false,
        message: "Failed to generate insights",
        error: error.message,
      });
    }
  });
}
