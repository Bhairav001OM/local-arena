import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gameName } = await req.json()
    const apiKey = "AIzaSyBCCaXvujizCBYWnvSPStXKLbU1l8l8ix4" // Deno.env.get('GOOGLE_API_KEY') ||
    
    // 🔥 NEW DEBUG LOGS 🔥
    console.log("1. Request received for:", gameName);
    console.log("2. API Key exists in vault?", !!apiKey); 

    const prompt = `You are an esports data assistant. Return ONLY a raw JSON object for the competitive multiplayer game "${gameName}". Do not use markdown formatting, do not use backticks, and do not use the word 'json'. I need just the raw object.
    
    It MUST contain exactly these keys:
    - title (string, official name)
    - genre (string)
    - description (string, max 2 sentences)
    - official_modes (array of strings, e.g. ["Clash Squad", "Battle Royale", "Team Deathmatch"])
    - team_sizes (array of strings, e.g. ["Solo", "Duo", "Squad", "5v5"])`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })

    const data = await response.json()
    
    // 🔥 This will catch the exact API error from Google! 🔥
    console.log("3. Google's Response:", JSON.stringify(data)); 

    const rawText = data.candidates[0].content.parts[0].text.trim()
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const cleanJson = JSON.parse(cleanText)

    return new Response(JSON.stringify(cleanJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // 🔥 This writes the fatal crash to your Supabase logs 🔥
    console.error("FATAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})