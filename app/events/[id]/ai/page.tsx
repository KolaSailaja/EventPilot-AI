import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { createPlanSection, generateVisionPlan } from "@/lib/event-actions";
import prisma from "@/lib/prisma";

export default async function AIPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const aiProviderConfigured = Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENROUTER_API_KEY,
  );

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { planSections: { orderBy: { generatedAt: "desc" } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6">
      <EventShell eventId={event.id} eventName={event.name} />

      <section className="surface rounded-[30px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Vision-to-plan studio</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-stone-900">Shape the event concept</h2>
          </div>
          <form action={createPlanSection.bind(null, event.id)}>
            <button type="submit" className="brand-amber rounded-xl px-4 py-2.5 font-bold text-white">Generate default concept</button>
          </form>
        </div>

        {!aiProviderConfigured ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No external AI provider is configured. This studio generates a deterministic event concept from the saved event data and organizer inputs, and it clearly labels the output as planning guidance rather than a confirmed vendor or pricing recommendation.
          </div>
        ) : null}

        <form action={generateVisionPlan.bind(null, event.id)} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="field-block md:col-span-2">
            <span>Concept title</span>
            <input name="title" defaultValue={`${event.type} vision plan`} className="field-input" />
          </label>
          <label className="field-block">
            <span>Mood and feel</span>
            <input name="mood" defaultValue={event.style || event.theme || "Refined and welcoming"} className="field-input" />
          </label>
          <label className="field-block">
            <span>Color palette</span>
            <input name="palette" defaultValue="Warm ivory, forest green, and brushed gold" className="field-input" />
          </label>
          <label className="field-block">
            <span>Decoration and lighting</span>
            <input name="lighting" defaultValue="Layer warm uplighting, candlelight, and a few statement focal points to keep the room elegant and practical." className="field-input" />
          </label>
          <label className="field-block">
            <span>Activities and entertainment</span>
            <textarea name="activities" defaultValue="Use a clear welcome moment, one signature activity, and a natural transition into downtime and social mixing." rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block">
            <span>Menu and hospitality</span>
            <textarea name="menu" defaultValue="Keep the hospitality flow practical, easy to serve, and consistent with the guest count and venue layout." rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block">
            <span>Accessibility and comfort</span>
            <textarea name="accessibility" defaultValue="Preserve clear seating, quiet zones, signage, and comfort touches for a smoother experience." rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block">
            <span>Draft schedule</span>
            <textarea name="schedule" defaultValue="Setup, guest arrival, keynote or welcome moment, main activities, pause, social time, wrap-up, and contingency buffer." rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block md:col-span-2">
            <span>Practical constraints</span>
            <textarea name="constraints" defaultValue={event.constraints || "No major operating constraints stated yet."} rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block md:col-span-2">
            <span>Budget strategy</span>
            <textarea name="budgetStrategy" defaultValue={`Protect the ${event.currency} ${Number(event.budget || 0).toLocaleString()} budget by keeping venue and hospitality high-impact, then using contingency as a planning buffer.`} rows={3} className="field-input resize-none" />
          </label>
          <label className="field-block md:col-span-2">
            <span>Trade-off notes</span>
            <textarea name="tradeOffs" defaultValue="If costs increase, trim décor density before reducing hospitality, guest comfort, or vendor preparedness." rows={3} className="field-input resize-none" />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="brand-emerald rounded-xl px-5 py-3 font-bold text-white">Save concept draft</button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-black tracking-[-0.05em] text-stone-900">Saved concepts</h3>
          <span className="text-sm text-stone-500">{event.planSections.length} saved draft{event.planSections.length === 1 ? "" : "s"}</span>
        </div>

        {event.planSections.length === 0 ? (
          <div className="surface rounded-[30px] p-6 text-stone-600">No concept drafts have been created yet. Build one from the planner above.</div>
        ) : (
          <div className="space-y-4">
            {event.planSections.map((section) => (
              <article key={section.id} className="surface rounded-[28px] p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="eyebrow">Saved draft</p>
                    <h4 className="mt-2 text-xl font-black text-stone-900">{section.title}</h4>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {new Date(section.generatedAt).toLocaleDateString()} · {new Date(section.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {section.content.split("\n\n").map((block) => {
                    const [heading, ...body] = block.split("\n-");
                    return (
                      <div key={`${section.id}-${heading}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-sm font-bold uppercase tracking-[0.12em] text-stone-500">{heading}</p>
                        <div className="mt-2 text-sm leading-6 text-stone-700">
                          {body.length > 0 ? body.join("\n-").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => (
                            <p key={`${section.id}-${heading}-${line}`} className="mt-1">{line}</p>
                          )) : <p>{section.content}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                  <p><strong>Assumptions:</strong> {section.assumptions || "None specified."}</p>
                  <p className="mt-2"><strong>Trade-offs:</strong> {section.tradeOffs || "None specified."}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
