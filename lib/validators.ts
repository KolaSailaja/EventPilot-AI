import { z } from "zod";

const currencySchema = z.enum(["INR", "USD", "AED", "EUR"]);
const isDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const optionalDateSchema = z.string().refine(
  (value) => value === "" || isDateOnly(value),
  "Enter a valid calendar date.",
);
const optionalCheckboxSchema = z.union([z.literal("on"), z.literal("")]).optional();
const requiredMoneySchema = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? undefined : value),
  z.coerce.number().finite().min(0).max(1_000_000_000_000),
);

export const eventFormSchema = z.object({
  name: z.string().trim().min(2, "Event name is required.").max(120),
  type: z.enum(["Wedding", "Birthday", "Anniversary", "College Event", "Festival", "Community Gathering", "Other"]),
  date: optionalDateSchema.optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1.").max(1_000_000),
  budget: z.coerce.number().finite().min(0, "Budget cannot be negative.").max(1_000_000_000_000),
  currency: currencySchema.default("INR"),
  theme: z.string().trim().max(120).optional().or(z.literal("")),
  style: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(5_000).optional().or(z.literal("")),
  notes: z.string().trim().max(5_000).optional().or(z.literal("")),
  constraints: z.string().trim().max(5_000).optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  title: z.string().trim().min(2, "Expense title is required.").max(120),
  amount: requiredMoneySchema,
  isActual: optionalCheckboxSchema,
  categoryId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(5_000).optional().or(z.literal("")),
});

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Task title is required.").max(120),
  description: z.string().trim().max(5_000).optional().or(z.literal("")),
  dueDate: optionalDateSchema.optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["pending", "in_progress", "done", "blocked"]).default("pending"),
});

export const guestSchema = z.object({
  name: z.string().trim().min(2, "Guest name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(254).optional().or(z.literal("")),
  dietaryNotes: z.string().trim().max(1_000).optional().or(z.literal("")),
  plusOne: optionalCheckboxSchema,
  notes: z.string().trim().max(5_000).optional().or(z.literal("")),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "Vendor name is required.").max(120),
  category: z.string().trim().min(2, "Category is required.").max(120),
  contact: z.string().trim().max(254).optional().or(z.literal("")),
  status: z.enum(["prospect", "quoted", "booked", "rejected"]).default("prospect"),
  notes: z.string().trim().max(5_000).optional().or(z.literal("")),
  amount: z.union([
    z.literal(""),
    z.coerce.number().finite().min(0, "Quote amount cannot be negative.").max(1_000_000_000_000),
  ]).optional(),
  currency: currencySchema.default("INR"),
  isConfirmed: optionalCheckboxSchema,
});

export const reviewNoteSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(2).max(200),
  impactText: z.string().trim().min(2).max(5_000),
});
