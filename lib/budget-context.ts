type EventBudgetContextInput = {
  name: string;
  theme: string;
  style: string;
  description: string;
  notes: string;
  constraints: string;
};

export function buildEventBudgetContext(event: EventBudgetContextInput) {
  return [
    `Event: ${event.name.trim() || "not named"}`,
    `Theme: ${event.theme.trim() || "not specified"}; style: ${event.style.trim() || "not specified"}.`,
    `Description: ${event.description.trim() || "not provided"}`,
    `Planning notes: ${event.notes.trim() || "none"}`,
    `Constraints: ${event.constraints.trim() || "none specified"}`,
  ].join("\n").slice(0, 4_000);
}
