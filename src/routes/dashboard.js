import { generateSummaryInsight } from "../services/aiInsights.js";

export default async function dashboardRoutes(app) {
  app.get(
    "/dashboard",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const userId = req.user.id;

        // Fetch user finance and expenses
        const [finance, expenses, totalSaved] = await Promise.all([
          app.prisma.userFinance.findUnique({ where: { userId } }),
          app.prisma.expense.findMany({
            where: { userId },
            select: { category: true, amount: true },
          }),
          app.prisma.saving.aggregate({
            where: { userId },
            _sum: { amount: true },
          }),
        ]);

        // Compute totals
        const monthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const topCategories = expenses
          .reduce((acc, item) => {
            const existing = acc.find((c) => c.category === item.category);
            if (existing) existing.amount += item.amount;
            else acc.push({ category: item.category, amount: item.amount });
            return acc;
          }, [])
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        const userData = {
          monthlyIncome: finance?.monthlyIncome || 0,
          monthlyExpenses,
          totalSaved: totalSaved._sum.amount || 0,
          savingsChange: finance?.savingsChange || 0,
          expenseChange: finance?.expenseChange || 0,
          incomeChange: finance?.incomeChange || 0,
          spendingDiscipline: finance?.spendingDiscipline || "Average",
          topCategories,
        };

        // Generate AI summary insight
        const aiInsight = await generateSummaryInsight(userData);

        const dashboardData = {
          financialOverview: {
            monthlyIncome: {
              amount: `RM ${userData.monthlyIncome}`,
              change: `${userData.incomeChange >= 0 ? "↑" : "↓"} ${Math.abs(
                userData.incomeChange
              )}% from last month`,
            },
            monthlyExpenses: {
              amount: `RM ${userData.monthlyExpenses}`,
              change: `${userData.expenseChange >= 0 ? "↑" : "↓"} ${Math.abs(
                userData.expenseChange
              )}% from last month`,
            },
            savingsThisMonth: {
              amount: `RM ${userData.monthlyIncome - userData.monthlyExpenses}`,
              change: `↑ ${userData.savingsChange}% growth`,
            },
            totalSaved: {
              amount: `RM ${userData.totalSaved}`,
              note: "Lifetime total",
            },
          },
          charts: {
            incomeVsExpense: {
              income: userData.monthlyIncome,
              expense: userData.monthlyExpenses,
            },
            topExpenseCategories: userData.topCategories,
          },
          insights: aiInsight?.summaryInsights || [],
        };

        return reply.code(200).send({ success: true, data: dashboardData });
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to load dashboard data",
          error: error.message,
        });
      }
    }
  );
}
