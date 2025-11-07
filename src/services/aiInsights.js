import Groq from "groq-sdk";

// Initialize Groq client
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateCombinedInsight(userData) {
  const prompt = `
You are Rumina, an empathetic financial AI assistant who acts as a user's financial and lifestyle coach.
You analyze their finances, spending behavior, and comfort level to provide two structured insights in one JSON:
1. Financial Wellness Evaluation
2. Lifestyle Recommendations

User Data:
- Monthly Income: RM ${userData.monthlyIncome}
- Monthly Expenses: RM ${userData.monthlyExpenses}
- Total Saved: RM ${userData.totalSaved}
- Total Debt: RM ${userData.totalDebt || 0}
- Savings Change: ${userData.savingsChange || 0}%
- Expense Change: ${userData.expenseChange || 0}%
- Spending Breakdown: ${JSON.stringify(userData.spendingCategories || [])}

You must analyze the user's data thoughtfully, acting like a friendly financial wellness coach.
Keep it warm, motivating, and realistic, not overly formal.

Output format (single JSON only):
{
  "financialWellness": {
    "score": 0-100,
    "percentile": "You're doing better than X% of users",
    "ratings": {
      "savingsRate": { "score": 0-100, "description": "..." },
      "debtManagement": { "score": 0-100, "description": "..." },
      "emergencyFund": { "score": 0-100, "description": "..." },
      "expenseControl": { "score": 0-100, "description": "..." }
    }
  },
  "lifestyleRecommendations": {
    "dailyMeals": {
      "recommendedDailyBudget": "RM X",
      "breakdown": { "breakfast": "RM X", "lunch": "RM X", "dinner": "RM X" }
    },
    "carBudget": {
      "recommendedCarPrice": "RM X",
      "monthlyCosts": {
        "loanPayment": "RM X",
        "fuel": "RM X",
        "insuranceService": "RM X",
        "total": "RM X"
      }
    },
    "homeBudget": {
      "recommendedPropertyPrice": "RM X",
      "monthlyCosts": {
        "mortgage": "RM X",
        "utilitiesMaintenance": "RM X",
        "total": "RM X"
      }
    }
  }
}

The output must be only one JSON object, no markdown or explanations.
`;

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const rawOutput = response.choices?.[0]?.message?.content?.trim();
    const parsedOutput = JSON.parse(rawOutput);

    return parsedOutput;
  } catch (error) {
    console.error("Rumina Insight Error:", error);
    return {
      financialWellness: null,
      lifestyleRecommendations: null,
      error: "Failed to generate insights",
    };
  }
}

export async function generateGoalProgressInsight(userData) {
  if (!userData || !userData.goals || userData.goals.length === 0) {
    return {
      ruminaInsight: {
        message:
          "No goals found yet. Start by creating one to let Rumina track your progress.",
      },
    };
  }

  const prompt = `
You are Rumina, an empathetic financial AI assistant that tracks user goals and progress. 
You help users understand how close they are to achieving their goals. 
Respond in JSON format only.

User Goal Data:
${JSON.stringify(userData.goals, null, 2)}

For each goal, calculate:
- completion percentage
- remaining amount
- estimated status ("On Track" if over 70% completed, "Behind" otherwise)
- practical advice with warmth and encouragement.

Output a single valid JSON object in this structure:

{
  "ruminaInsight": [
    {
      "goal": "Emergency Fund",
      "status": "On Track",
      "progress": "85.2%",
      "stillNeeded": "RM 3,200",
      "projectedCompletion": "Dec 2024",
      "advice": "At your current pace, you're on track to achieve this goal by Dec 2024. Keep going!"
    },
    {
      "goal": "Travel Fund",
      "status": "Behind",
      "progress": "45%",
      "stillNeeded": "RM 5,500",
      "projectedCompletion": "May 2025",
      "advice": "You're halfway there. Try allocating a bit more this month to stay on course."
    }
  ]
}

Only return the JSON object, no extra explanations or text.
`;

  try {
    const res = await client.responses.create({
      model: "llama-3.3-70b-versatile",
      input: prompt,
    });

    // Parse and return AI output safely
    const rawOutput = res.output?.[0]?.content?.[0]?.text || "{}";
    return JSON.parse(rawOutput);
  } catch (error) {
    console.error("AI goal insight generation failed:", error);
    return {
      ruminaInsight: {
        message:
          "Unable to generate insights right now. Please try again later.",
      },
    };
  }
}

export async function generateSummaryInsight(userData) {
  const prompt = `
You are Rumina, an empathetic financial AI assistant that summarizes a user's month in a friendly, motivational way. 
The output must be a valid JSON that can be rendered in a dashboard.

User Monthly Trends:
- Savings Change from last month: ${userData.savingsChange}%
- Expense Change from last month: ${userData.expenseChange}%
- Overall Spending Discipline: ${userData.spendingDiscipline || "Good"}
- Total Saved: RM ${userData.totalSaved}

Create concise insights like a coach offering motivation. Keep them positive, reflective, and personalized.

Output the result in this JSON structure:
{
  "summaryInsights": [
    "This month you spent mindfully.",
    "You saved X% more than last month.",
    "Keep it steady, your habits are improving."
  ]
}

The output must be only a single JSON object, no extra text.
`;

  const res = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return JSON.parse(res.choices[0].message.content);
}

export async function generateDiaryResponse(userDiaryText) {
  const prompt = `
You are Rumina, the user's financial diary companion. 
You help the user reflect on their thoughts and give insightful financial feedback. 
Be kind, thoughtful, and supportive.

User Diary Entry:
"${userDiaryText}"

If the user expresses confusion or worry, respond with understanding and provide practical advice. 
If the user asks a question, answer directly but gently.

Output a single plain text reply, no JSON.
`;

  const res = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return res.choices[0].message.content.trim();
}
