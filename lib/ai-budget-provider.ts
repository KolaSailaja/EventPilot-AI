import { budgetDraftSchema, type BudgetDraft, type BudgetProfile } from "@/lib/budget-schema";
import { toSafeMoney } from "@/lib/budget";

export class BudgetProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BudgetProviderError";
  }
}

export async function generateBudgetWithAI(profile: BudgetProfile): Promise<BudgetDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new BudgetProviderError("AI budget generation is not configured. Add an OpenAI API key on the server.", 503);
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "Create a practical event budget draft using only the provided event details.",
              "Return a JSON object with exactly: categories, contingency, rationale, tradeOffs.",
              "categories must be an array of 1-20 objects with exactly: name, amount, basis, explanation, priority, alternative.",
              "amount and contingency must be non-negative numeric estimates in the requested currency; priority is high, medium, or low; alternative may be an empty string.",
              "Use relevant categories for the stated event type; do not assume this is a wedding.",
              "Use location, guest count, date, priorities, and stated total budget to make context-aware indicative estimates. State assumptions and uncertainty; do not claim live market research, verified prices, vendor quotes, or vendor availability.",
              "If essential requirements are unrealistic for the budget, be candid in rationale, suggest trade-offs, and return realistic estimated costs even when their sum exceeds the budget. Never force totals to fit.",
              "Contingency is a separately estimated reserve, not an expense category. Explain when it is zero or minimal.",
              "Avoid duplicate category names and do not include the overall budget as a category.",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(profile) },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new BudgetProviderError("The AI budget service took too long to respond. Please try again.", 504);
    }
    throw new BudgetProviderError("The AI budget service could not be reached. Please try again.", 502);
  }

  if (response.status === 429) {
    throw new BudgetProviderError("The AI budget service is busy. Please wait a moment and try again.", 429);
  }
  if (!response.ok) {
    throw new BudgetProviderError("The AI budget service could not complete this request.", 502);
  }

  let providerBody: unknown;
  try {
    providerBody = await response.json();
  } catch {
    throw new BudgetProviderError("The AI budget service returned an unreadable response.", 502);
  }

  if (!providerBody || typeof providerBody !== "object" || !("choices" in providerBody)) {
    throw new BudgetProviderError("The AI budget service returned an incomplete response.", 502);
  }
  const choices = providerBody.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object" || !("message" in choices[0])) {
    throw new BudgetProviderError("The AI budget service returned an incomplete response.", 502);
  }
  const message = choices[0].message;
  if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
    throw new BudgetProviderError("The AI budget service returned an incomplete response.", 502);
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(message.content);
  } catch {
    throw new BudgetProviderError("The AI budget service returned an invalid budget. Please try again.", 502);
  }

  const parsedDraft = budgetDraftSchema.safeParse(parsedContent);
  if (!parsedDraft.success) {
    throw new BudgetProviderError("The AI budget service returned an invalid budget. Please try again.", 502);
  }

  return {
    ...parsedDraft.data,
    categories: parsedDraft.data.categories.map((category) => ({
      ...category,
      amount: toSafeMoney(category.amount),
    })),
    contingency: toSafeMoney(parsedDraft.data.contingency),
  };
}
