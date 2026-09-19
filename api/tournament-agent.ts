import { generateText, gateway } from "ai";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const input = await req.json();
    const { game, entries, format, city, prizePool } = input;

    if (!game || !Number.isInteger(entries) || entries < 2 || entries > 1000 || !format || !city) {
      return Response.json({ error: "game, entries, format, and city are required" }, { status: 400 });
    }

    const { text } = await generateText({
      model: gateway("openai/o4-mini"),
      system: "You are Local Arena's autonomous tournament operations teammate for Indian gaming communities. Create practical, concise plans. Never claim to have sent messages, charged money, or published an event. Return JSON with keys: summary, checklist (array of strings), schedule (array of strings), risks (array of strings), nextAction. Use INR when discussing money.",
      prompt: JSON.stringify({ game, entries, format, city, prizePool: prizePool || "Not specified" }),
      temperature: 0.2,
    });

    return Response.json({ plan: text });
  } catch (error) {
    console.error("[v0] tournament teammate failed", error);
    return Response.json({ error: "The tournament teammate could not create a plan." }, { status: 500 });
  }
}

export const config = { runtime: "nodejs20.x" };
