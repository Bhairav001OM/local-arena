const GEMINI_MODEL = "gemini-3.6-flash";

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "The tournament teammate is not configured yet." }, { status: 503 });
    }

    const systemInstruction = "You are Local Arena's autonomous tournament operations teammate for Indian gaming communities. Create practical, concise plans. Never claim to have sent messages, charged money, or published an event. Return only valid JSON with keys: summary, checklist (array of strings), schedule (array of strings), risks (array of strings), nextAction. Use INR when discussing money.";
    const prompt = JSON.stringify({ game, entries, format, city, prizePool: prizePool || "Not specified" });
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    });

    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }

    if (!response?.ok) {
      console.error("[v0] Gemini tournament request failed", response?.status);
      return Response.json({ error: "Gemini is temporarily busy. Please try building the plan again." }, { status: 502 });
    }

    const result = await response.json();
    const plan = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!plan) {
      return Response.json({ error: "The tournament teammate returned an empty plan." }, { status: 502 });
    }

    return Response.json({ plan });
  } catch (error) {
    console.error("[v0] tournament teammate failed", error);
    return Response.json({ error: "The tournament teammate could not create a plan." }, { status: 500 });
  }
}

export const config = { runtime: "nodejs" };
