import { supabase } from "../utils/supabase";

// --- INTERFACES ---
export type TournamentStatus = "upcoming" | "ongoing" | "verifying" | "completed" | "disputed" | "admin_review";

export interface Tournament {
  id: string;
  title: string;
  gameId: string;
  gameName?: string; 
  status: TournamentStatus;
  prizePool: string;
  date: string;
  time?: string;
  location: string;
  mode?: string; 
  isPrivate?: boolean; 
  password?: string;
  host_id?: string;
  short_code?: string;
  is_deleted?: boolean; 
  result_image?: string;
  ai_stats?: any;
  ai_tampering_flag?: boolean;
  ai_confidence?: number;
}

export const GAMES = [
  { id: "fps", title: "FPS Combat", genre: "First Person Shooter", description: "High-stakes tactical shooters.", imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800" },
  { id: "fighting", title: "Fighting Arena", genre: "Combat", description: "One-on-one fighting games.", imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800" },
  { id: "sports", title: "Sports League", genre: "Racing & Sports", description: "Racing simulators and sports.", imageUrl: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&q=80&w=800" },
];

const mapTournamentData = (t: any): Tournament => ({
  ...t,
  gameId: t.game_id || t.gameId,
  prizePool: t.prize_pool || t.prizePool,
  isPrivate: t.is_private ?? t.isPrivate,
  resultImage: t.result_image,
  shortCode: t.short_code,
  isDeleted: t.is_deleted,
  ai_stats: t.ai_stats,
  ai_tampering_flag: t.ai_tampering_flag,
  ai_confidence: t.ai_confidence
});

const fetchGameTitleMap = async () => {
  const { data } = await supabase.from("games").select("id, title");
  const map: Record<string, string> = {};
  GAMES.forEach(g => { map[g.id] = g.title; }); 
  if (data) { data.forEach(g => { map[g.id] = g.title; }); } 
  return map;
};

const applyAutoStatus = (tournaments: Tournament[]) => {
  const now = new Date();
  return tournaments.map(t => {
    if (t.status === "upcoming") {
      const matchDateTime = new Date(`${t.date}T${t.time || "00:00"}`);
      if (now >= matchDateTime) {
        return { ...t, status: "ongoing" as TournamentStatus };
      }
    }
    return t;
  });
};

export const fetchTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
  if (error) { console.error("Error fetching tournaments:", error); return []; }
  
  const gameMap = await fetchGameTitleMap(); 
  
  const mappedData = (data || []).map(t => {
    const mapped = mapTournamentData(t);
    mapped.gameName = gameMap[mapped.gameId] || "Unknown Game"; 
    return mapped;
  });

  const cleanData = mappedData.filter(t => (t as any).is_deleted !== true);
  return applyAutoStatus(cleanData); 
};

export const getTournamentById = async (id: string) => {
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).single();
  if (error) throw new Error("Tournament not found");
  
  const gameMap = await fetchGameTitleMap(); 
  const mapped = mapTournamentData(data);
  mapped.gameName = gameMap[mapped.gameId] || "Unknown Game"; 

  if ((mapped as any).is_deleted === true) throw new Error("🚫 This tournament has been terminated by the Admin.");
  
  return applyAutoStatus([mapped])[0]; 
};

export const uploadScreenshot = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;
  const { error } = await supabase.storage.from('screenshots').upload(filePath, file);
  if (error) throw new Error("Failed to upload image: " + error.message);
  const { data } = supabase.storage.from('screenshots').getPublicUrl(filePath);
  return data.publicUrl;
};

const analyzeMatchResultWithAI = async (imageUrl: string, gameName: string, expectedPlayerList: string) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
    if (!apiKey) throw new Error("API Key is missing in Environment Variables!");

    const imageResp = await fetch(imageUrl);
    const blob = await imageResp.blob();
    const reader = new FileReader();
    
    const base64Data = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const promptText = `
      You are an expert eSports AI referee analyzing a match result screenshot for "${gameName}".
      
      REGISTERED LOBBY PLAYERS (For Context Only):
      ${expectedPlayerList}
      
      CRITICAL INSTRUCTIONS:
      1. Carefully read the stylized fonts.
      2. Write a brief "summary" explaining exactly what text, names, K/D/A (Kills/Deaths/Assists), and Damage you visually read.
      3. Find the Winner (Look for "Booyah", "Victory", "#1").
      4. Extract Kills, Deaths, Assists, and Damage for EVERY VISIBLE PLAYER.
      5. VERY IMPORTANT: Under the "name" field, write the EXACT raw name you see on the screen (e.g., _CHIRAG_FF_). DO NOT output "Unknown" if you can read the text.
      6. Return ONLY a valid JSON object. No markdown.
      
      Format exactly like this:
      {
        "summary": "Brief explanation...",
        "winner": "Exact Name of winner from screen",
        "is_tampered": false,
        "confidence": 95,
        "players": [
          {
            "name": "Raw Name from screen", 
            "kills": 5,
            "deaths": 4,
            "assists": 0,
            "damage": 1809
          }
        ]
      }
    `;

    const requestBody = {
      contents: [{
        parts: [
          { text: promptText },
          { inline_data: { mime_type: blob.type, data: base64Data } }
        ]
      }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errTxt = await response.text();
      console.error("[AI] API Response Error:", errTxt);
      throw new Error("AI API Request Failed: Check Console");
    }

    const data = await response.json();
    
    if (data.promptFeedback?.blockReason || data.candidates[0]?.finishReason === 'SAFETY') {
      return { summary: "Google Safety Filters blocked this image due to detected violence/guns.", winner: "Unknown", is_tampered: false, confidence: 0, players: [] };
    }

    let rawJson = data.candidates[0].content.parts[0].text;
    rawJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(rawJson);

  } catch (error: any) {
    console.error("[AI] Fatal Analysis Error:", error);
    return { summary: `API Error or Processing Failure: ${error.message}`, winner: "Unknown", is_tampered: false, confidence: 0, players: [] }; 
  }
};

export const completeTournamentMatch = async (tournamentId: string, imageUrl: string, gameName: string = "Unknown Game") => {
  const { error: initialUpdateError } = await supabase
    .from("tournaments").update({ status: "verifying", result_image: imageUrl }).eq("id", tournamentId);

  if (initialUpdateError) throw new Error("Failed to initialize match verification.");

  try {
    const { data: tourn } = await supabase.from("tournaments").select("game_id").eq("id", tournamentId).single();
    let expectedNamesString = "";
    
    if (tourn) {
      const { data: roster } = await supabase.from("tournament_participants").select("user_id").eq("tournament_id", tournamentId);
      if (roster && roster.length > 0) {
        const userIds = roster.map(r => r.user_id);
        const { data: linkedGames } = await supabase.from("linked_games").select("in_game_name, in_game_id").eq("game_id", tourn.game_id).in("user_id", userIds);
        if (linkedGames) {
          expectedNamesString = linkedGames.map(lg => `- Name: "${lg.in_game_name}", ID: "${lg.in_game_id}"`).join("\n");
        }
      }
    }

    const aiData = await analyzeMatchResultWithAI(imageUrl, gameName, expectedNamesString);
    
    if (aiData) {
      const needsReview = aiData.is_tampered || aiData.confidence < 70 || aiData.winner === "Unknown";
      await supabase.from("tournaments").update({
          ai_stats: aiData,
          ai_tampering_flag: aiData.is_tampered,
          ai_confidence: aiData.confidence,
          ...(needsReview && { status: "admin_review" })
        }).eq("id", tournamentId);
    }
  } catch (err) {
    console.error("Error during AI processing flow:", err);
  }
  return true;
};

export const reRunAIVerification = async (tournamentId: string, imageUrl: string, gameName: string = "Unknown Game") => {
  try {
    await supabase.from("tournaments").update({ 
      ai_stats: null, status: "verifying", ai_tampering_flag: null, ai_confidence: null 
    }).eq("id", tournamentId);

    const { data: tourn } = await supabase.from("tournaments").select("game_id").eq("id", tournamentId).single();
    let expectedNamesString = "";
    
    if (tourn) {
      const { data: roster } = await supabase.from("tournament_participants").select("user_id").eq("tournament_id", tournamentId);
      if (roster && roster.length > 0) {
        const userIds = roster.map(r => r.user_id);
        const { data: linkedGames } = await supabase.from("linked_games").select("in_game_name, in_game_id").eq("game_id", tourn.game_id).in("user_id", userIds);
        if (linkedGames) {
          expectedNamesString = linkedGames.map(lg => `- Name: "${lg.in_game_name}", ID: "${lg.in_game_id}"`).join("\n");
        }
      }
    }

    const aiData = await analyzeMatchResultWithAI(imageUrl, gameName, expectedNamesString);
    
    if (aiData) {
      const needsReview = aiData.is_tampered || aiData.confidence < 70 || aiData.winner === "Unknown";
      const updatePayload: any = {
        ai_stats: aiData, ai_tampering_flag: aiData.is_tampered, ai_confidence: aiData.confidence,
      };
      
      if (needsReview) updatePayload.status = "admin_review";
      else updatePayload.status = "verifying";

      await supabase.from("tournaments").update(updatePayload).eq("id", tournamentId);
    }
  } catch (err) { console.error("Error during Re-scan:", err); }
  return true;
};

export const applyMatchStatsToPlayers = async (tournamentId: string) => {
  console.log(`[SYS] Starting Stats Sync for Tournament: ${tournamentId}`);
  try {
    const { data: tourn, error: tournError } = await supabase
      .from("tournaments").select("*").eq("id", tournamentId).single();

    if (tournError || !tourn) {
      console.error("[SYS] Failed to fetch tournament details:", tournError);
      return;
    }

    const gameId = tourn.game_id || tourn.gameId;
    const gameMode = tourn.mode || "Global"; 
    const aiStats = tourn.ai_stats || {}; 
    const hasAIStats = aiStats && Object.keys(aiStats).length > 0;

    console.log(`[SYS] Target GameID: ${gameId} | Target Mode: ${gameMode}`);

    const { data: roster, error: rosterError } = await supabase
      .from("tournament_participants").select("user_id").eq("tournament_id", tournamentId);

    if (rosterError || !roster || roster.length === 0) {
      console.error("[SYS] Roster empty or fetch error:", rosterError);
      return;
    }

    const userIds = roster.map(r => r.user_id);
    const { data: linkedGames, error: lgError } = await supabase
      .from("linked_games").select("*").eq("game_id", gameId).in("user_id", userIds);

    if (lgError) { 
      console.error("[SYS] Linked games fetch error:", lgError); 
      return; 
    }

    if (linkedGames && linkedGames.length > 0) {
      const cleanString = (str: string) => (str || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const aiWinner = hasAIStats && aiStats.winner ? cleanString(aiStats.winner) : "";

      for (const lg of linkedGames) {
        const cleanLgName = cleanString(lg.in_game_name);
        const cleanLgId = cleanString(lg.in_game_id);

        let matchKills = 0, matchDeaths = 0, matchAssists = 0, matchDamage = 0;
        let isWinner = false;

        if (hasAIStats && aiStats.players && Array.isArray(aiStats.players)) {
          const aiPlayerData = aiStats.players.find((p: any) => {
            if (!p.name) return false;
            const aiName = cleanString(p.name);
            return aiName === cleanLgName || aiName.includes(cleanLgName) || cleanLgName.includes(aiName);
          });
          
          if (aiPlayerData) {
            matchKills = Number(aiPlayerData.kills) || 0;
            matchDeaths = Number(aiPlayerData.deaths) || 0;
            matchAssists = Number(aiPlayerData.assists) || 0;
            matchDamage = Number(aiPlayerData.damage || aiPlayerData.score) || 0;
          }
        }

        if (hasAIStats && aiWinner && (aiWinner === cleanLgName || aiWinner.includes(cleanLgName) || cleanLgName.includes(aiWinner))) {
          isWinner = true;
        }

        const { data: currentStats, error: fetchStatError } = await supabase.from('player_stats')
          .select('*')
          .match({ user_id: lg.user_id, game_id: gameId, game_mode: gameMode })
          .maybeSingle();

        if (fetchStatError) console.error(`[SYS] Error checking existing stats for ${lg.in_game_name}:`, fetchStatError);

        const newMatches = (currentStats?.matches_played || 0) + 1;
        const newWins = (currentStats?.wins || 0) + (isWinner ? 1 : 0);
        const newKills = (currentStats?.kills || 0) + matchKills;
        const newDeaths = (currentStats?.deaths || 0) + matchDeaths;
        const newAssists = (currentStats?.assists || 0) + matchAssists;
        const newDamage = (currentStats?.damage || 0) + matchDamage;

        if (currentStats) {
          const { error: updateError } = await supabase.from('player_stats').update({
            matches_played: newMatches, wins: newWins, kills: newKills, deaths: newDeaths, assists: newAssists, damage: newDamage
          }).eq('id', currentStats.id);
          
          if (updateError) console.error(`[SYS] ❌ Failed to UPDATE stats for ${lg.in_game_name}:`, updateError);
          else console.log(`[SYS] ✅ Successfully UPDATED stats for ${lg.in_game_name} in mode ${gameMode}`);
        } else {
          const { error: insertError } = await supabase.from('player_stats').insert({
            user_id: lg.user_id, game_id: gameId, game_mode: gameMode,
            matches_played: newMatches, wins: newWins, kills: newKills, deaths: newDeaths, assists: newAssists, damage: newDamage
          });
          
          if (insertError) console.error(`[SYS] ❌ Failed to INSERT stats for ${lg.in_game_name}:`, insertError);
          else console.log(`[SYS] ✅ Successfully INSERTED stats for ${lg.in_game_name} in mode ${gameMode}`);
        }
      }
    }
  } catch (error) { 
    console.error("[SYS] Critical error in stat application:", error); 
  }
};

// 🔥 NEW: FETCH SPECIFIC MATCH HISTORY FOR A GAME 🔥
export const fetchGameMatchHistory = async (userId: string, gameId: string) => {
  const { data: participants, error: pErr } = await supabase
    .from("tournament_participants")
    .select("tournament_id")
    .eq("user_id", userId);
    
  if (pErr || !participants || participants.length === 0) return [];
  
  const tIds = participants.map(p => p.tournament_id);
  
  const { data: tournaments, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .in("id", tIds)
    .eq("game_id", gameId)
    .eq("status", "completed")
    .order("date", { ascending: false });
    
  if (tErr || !tournaments) return [];
  
  const gameMap = await fetchGameTitleMap();
  return tournaments.map(t => {
    const mapped = mapTournamentData(t);
    mapped.gameName = gameMap[mapped.gameId] || "Unknown Game";
    return mapped;
  });
};

export const createTournament = async (formData: any, _token: string, userId: string) => {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (profile?.is_banned === true) throw new Error("🚨 BANNED: Your account has been suspended.");
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data: newTournament, error } = await supabase.from("tournaments").insert([{
      title: formData.title, game_id: formData.gameId, mode: formData.mode, team_size: formData.teamSize,         
      max_players: parseInt(formData.maxPlayers) || 0, prize_pool: formData.prizePool, date: formData.date,
      time: formData.time || "12:00", location: formData.location, rules: formData.rules || null,        
      status: "upcoming", is_private: formData.isPrivate || false, password: formData.password || null,
      host_id: userId, short_code: roomCode
    }]).select().single();
  if (error) throw error;
  if (newTournament) { await supabase.from("tournament_participants").insert([{ tournament_id: newTournament.id, user_id: userId }]); }
  return true;
};

export const joinTournament = async (tournamentId: string, userId: string, password?: string) => {
  const { data: tourn } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single();
  if (!tourn) throw new Error("Tournament not found.");
  if (tourn.isPrivate && tourn.password !== password) throw new Error("Incorrect Password.");

  const { data: linkedGames } = await supabase.from("linked_games").select("id").eq("user_id", userId).eq("game_id", tourn.game_id || tourn.gameId);
  if (!linkedGames || linkedGames.length === 0) {
    throw new Error("🚨 IDENTITY REQUIRED: You must link your In-Game ID for this game in your Profile before you can join the lobby!");
  }

  const { data: myJoins } = await supabase.from("tournament_participants").select("tournament_id").eq("user_id", userId);
  if (myJoins && myJoins.length > 0) {
    const activeIds = myJoins.map(j => j.tournament_id);
    const { data: activeTourns } = await supabase
      .from("tournaments").select("id, date, time, status").in("id", activeIds).in("status", ["upcoming", "ongoing"]);
    if (activeTourns && activeTourns.some(t => t.date === tourn.date && t.time === tourn.time)) {
      throw new Error("⏳ Time Conflict: You are already registered for another tournament at this exact Date and Time!");
    }
  }

  const { error } = await supabase.from("tournament_participants").insert([{ tournament_id: tournamentId, user_id: userId }]);
  if (error) {
    if (error.code === '23505') throw new Error("You are already in this tournament.");
    throw error;
  }
};

export const checkIsParticipant = async (tournamentId: string, userId: string) => {
  const { data, error } = await supabase.from("tournament_participants").select("*").eq("tournament_id", tournamentId).eq("user_id", userId);
  if (error) return false;
  return data && data.length > 0;
};

export const kickPlayer = async (tournamentId: string, playerId: string) => {
  const { error } = await supabase.from("tournament_participants").delete().eq("tournament_id", tournamentId).eq("user_id", playerId);
  if (error) throw new Error("Failed to kick player: " + error.message);
  return true;
};

export interface EnhancedUserProfile {
  stats: { tournamentsPlayed: number; tournamentsHosted: number; };
  playerTournaments: { upcoming: Tournament[]; ongoing: Tournament[]; completed: Tournament[]; };
  hostedTournaments: { upcoming: Tournament[]; ongoing: Tournament[]; completed: Tournament[]; };
}

export const fetchFullUserProfile = async (userId: string): Promise<EnhancedUserProfile> => {
  const gameMap = await fetchGameTitleMap(); 

  const { data: hosted } = await supabase.from("tournaments").select("*").eq("host_id", userId).order("date", { ascending: false });
  const hostedTourns = (hosted || []).map(t => ({ ...mapTournamentData(t), gameName: gameMap[t.game_id] || "Unknown Game", ai_stats: t.ai_stats }));
  const finalHosted = applyAutoStatus(hostedTourns.filter(t => (t as any).is_deleted !== true));

  const { data: participants } = await supabase.from("tournament_participants").select("tournament_id").eq("user_id", userId);
  let playerTourns: Tournament[] = [];
  
  if (participants && participants.length > 0) {
    const tIds = participants.map((p) => p.tournament_id);
    const { data: joined } = await supabase.from("tournaments").select("*").in("id", tIds).order("date", { ascending: false });
    playerTourns = (joined || []).map(t => ({ ...mapTournamentData(t), gameName: gameMap[t.game_id] || "Unknown Game", ai_stats: t.ai_stats }));
    playerTourns = applyAutoStatus(playerTourns.filter(t => (t as any).is_deleted !== true));
  }

  const filterByStatus = (tourns: Tournament[], status: TournamentStatus) => tourns.filter(t => t.status === status);

  return {
    stats: { tournamentsPlayed: playerTourns.length, tournamentsHosted: finalHosted.length },
    playerTournaments: { upcoming: filterByStatus(playerTourns, "upcoming"), ongoing: filterByStatus(playerTourns, "ongoing"), completed: filterByStatus(playerTourns, "completed") },
    hostedTournaments: { upcoming: filterByStatus(finalHosted, "upcoming"), ongoing: filterByStatus(finalHosted, "ongoing"), completed: filterByStatus(finalHosted, "completed") }
  };
};

export const getUserProfile = async (userId: string) => {
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (profileError) throw profileError;
  const { data: linkedGames, error: gamesError } = await supabase.from("linked_games").select("*").eq("user_id", userId);
  if (gamesError) throw gamesError;
  
  const { data: playerStats, error: statsError } = await supabase.from("player_stats").select("*").eq("user_id", userId);
  if (statsError) throw statsError;

  return { profile, linkedGames, playerStats };
};

export const saveLinkedGame = async (userId: string, gameId: string, inGameId: string, inGameName: string, preferredModes: string[] = []) => {
  const { data: existing } = await supabase.from("linked_games").select("id, edits_remaining").eq("user_id", userId).eq("game_id", gameId).single();
  if (existing) {
    if (existing.edits_remaining <= 0) throw new Error("Security Lock: You have 0 edits remaining for this game.");
    const { error } = await supabase.from("linked_games").update({ 
      in_game_id: inGameId, in_game_name: inGameName, preferred_modes: preferredModes, edits_remaining: existing.edits_remaining - 1, updated_at: new Date().toISOString() 
    }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("linked_games").insert([{ user_id: userId, game_id: gameId, in_game_id: inGameId, in_game_name: inGameName, preferred_modes: preferredModes }]);
    if (error) throw error;
  }
  return true;
};

export const fetchTournamentRoster = async (tournamentId: string, gameId: string) => {
  const { data: participants, error } = await supabase.from("tournament_participants").select(`user_id, joined_at, profiles ( display_name, avatar_url )`).eq("tournament_id", tournamentId).order("joined_at", { ascending: true });
  if (error) throw error;
  if (!participants || participants.length === 0) return [];
  const userIds = participants.map(p => p.user_id);
  const { data: linkedGames } = await supabase.from("linked_games").select("user_id, in_game_id, in_game_name").eq("game_id", gameId).in("user_id", userIds);
  return participants.map(p => {
    const gameData = linkedGames?.find(lg => lg.user_id === p.user_id);
    return { ...p, in_game_id: gameData?.in_game_id || "Not Linked", in_game_name: gameData?.in_game_name || "Unknown" };
  });
};

export const fetchMessages = async (tournamentId: string) => {
  const { data, error } = await supabase.from("tournament_messages").select(`*, profiles ( display_name, avatar_url )`).eq("tournament_id", tournamentId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
};

export const sendMessage = async (tournamentId: string, userId: string, message: string) => {
  const { error } = await supabase.from("tournament_messages").insert([{ tournament_id: tournamentId, user_id: userId, message: message }]);
  if (error) throw error;
  return true;
};

export const fetchMatchVotes = async (tournamentId: string) => {
  const { data, error } = await supabase.from("match_votes").select(`*, profiles ( display_name )`).eq("tournament_id", tournamentId);
  if (error) throw error;
  return data || [];
};

export const submitMatchVote = async (tournamentId: string, userId: string, isApproved: boolean, reason?: string, proofUrl?: string) => {
  const { data: existing } = await supabase.from("match_votes").select("id").eq("tournament_id", tournamentId).eq("user_id", userId).single();
  
  if (existing) {
    const { error } = await supabase.from("match_votes").update({ is_approved: isApproved, dispute_reason: reason, proof_image: proofUrl }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("match_votes").insert([{ tournament_id: tournamentId, user_id: userId, is_approved: isApproved, dispute_reason: reason, proof_image: proofUrl }]);
    if (error) throw error;
  }

  const { data: participants } = await supabase.from("tournament_participants").select("user_id").eq("tournament_id", tournamentId);
  const { data: votes } = await supabase.from("match_votes").select("is_approved").eq("tournament_id", tournamentId);

  if (participants && votes) {
    const requiredApprovals = Math.max(1, participants.length - 1); 
    const approvals = votes.filter(v => v.is_approved).length;

    if (!isApproved && proofUrl) {
      await supabase.from("tournaments").update({ status: "admin_review" }).eq("id", tournamentId);
    } else if (approvals >= requiredApprovals) {
      const { data: tCheck } = await supabase.from("tournaments").select("status").eq("id", tournamentId).single();
      if (tCheck && tCheck.status !== "completed") {
        await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
        await applyMatchStatsToPlayers(tournamentId);
      }
    }
  }
  return true;
};

export const fetchAllTournamentsAdmin = async () => {
  const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const deleteTournamentAdmin = async (tournamentId: string) => {
  const { error } = await supabase.from("tournaments").update({ is_deleted: true }).eq("id", tournamentId);
  if (error) throw error;
  return true;
};

export const fetchAllUsersAdmin = async () => {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const toggleBanStatus = async (userId: string, currentStatus: boolean) => {
  const { error } = await supabase.from("profiles").update({ is_banned: !currentStatus }).eq("id", userId);
  if (error) throw error;
  return true;
};

export const resolveDisputeAdmin = async (tournamentId: string, hostId: string, hostWins: boolean) => {
  if (hostWins) {
    const { error } = await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
    if (error) throw error;
    await applyMatchStatsToPlayers(tournamentId);
  } else {
    await supabase.from("tournaments").update({ is_deleted: true, status: "disputed" }).eq("id", tournamentId);
    const { data: hostProfile } = await supabase.from("profiles").select("host_strikes").eq("id", hostId).single();
    const newStrikes = (hostProfile?.host_strikes || 0) + 1;
    await supabase.from("profiles").update({ host_strikes: newStrikes, is_banned: newStrikes >= 2 }).eq("id", hostId);
  }
  return true;
};

export type PlatformGame = {
  id: string; title: string; genre: string; description: string; image_url: string; official_modes: string[]; team_sizes: string[];
};

export const fetchPlatformGames = async (): Promise<PlatformGame[]> => {
  const { data, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
};

export const addPlatformGame = async (gameData: Omit<PlatformGame, 'id'>) => {
  const { error } = await supabase.from('games').insert([gameData]);
  if (error) throw error;
};

export const deletePlatformGame = async (id: string) => {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
};

export const unlinkGame = async (userId: string, gameId: string) => {
  const { data, error } = await supabase.from('player_game_profiles').delete().eq('user_id', userId).eq('game_id', gameId);
  if (error) throw error;
  return data;
};

export const searchPlayers = async (searchQuery: string) => {
  if (!searchQuery.trim()) return [];
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchQuery.trim());
  let query = supabase.from("profiles").select("id, display_name, avatar_url");
  if (isUUID) { query = query.eq("id", searchQuery.trim()); } 
  else { query = query.ilike("display_name", `%${searchQuery}%`); }
  const { data, error } = await query.limit(10);
  if (error) throw error;
  return data || [];
};

export const sendFriendRequest = async (senderId: string, receiverId: string) => {
  const { error } = await supabase.from("friendships").insert([{ requester_id: senderId, receiver_id: receiverId, status: "pending" }]);
  if (error) throw new Error("Already sent or pending.");
  return true;
};

export const fetchPendingRequests = async (userId: string) => {
  const { data, error } = await supabase.from("friendships").select(`id, requester_id, requester:profiles!requester_id(id, display_name, avatar_url)`).eq("receiver_id", userId).eq("status", "pending");
  if (error) throw error;
  return data || [];
};

export const acceptFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
  if (error) throw error;
  return true;
};

export const rejectFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
  return true;
};

export const fetchFriends = async (userId: string) => {
  const { data, error } = await supabase.from("friendships").select(`id, status, requester_id, receiver_id, requester:profiles!requester_id(id, display_name, avatar_url), receiver:profiles!receiver_id(id, display_name, avatar_url)`).or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq("status", "accepted");
  if (error) throw error;
  return data || [];
};

export const sendPrivateMessage = async (senderId: string, receiverId: string, content: string) => {
  const { error } = await supabase.from("private_messages").insert([{ sender_id: senderId, receiver_id: receiverId, content: content }]);
  if (error) throw error;
  return true;
};

export const fetchPrivateMessages = async (userId1: string, userId2: string) => {
  const { data, error } = await supabase.from("private_messages").select("*").or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getFriendshipStatus = async (user1: string, user2: string) => {
  if (!user1 || !user2) return "none";
  const { data, error } = await supabase.from("friendships").select("status, requester_id, receiver_id").or(`and(requester_id.eq.${user1},receiver_id.eq.${user2}),and(requester_id.eq.${user2},receiver_id.eq.${user1})`).maybeSingle();
  if (error || !data) return "none";
  if (data.status === "accepted") return "friends";
  if (data.status === "pending") return data.requester_id === user1 ? "request_sent" : "request_received";
  return "none";
};

export const markPlayerNoShow = async (tournamentId: string, playerId: string) => {
  const { error: kickErr } = await supabase.from("tournament_participants").delete().match({ tournament_id: tournamentId, user_id: playerId });
  if (kickErr) throw kickErr;
  const { data: profile } = await supabase.from("profiles").select("penalties").eq("id", playerId).single();
  const currentPenalties = profile?.penalties || 0;
  const newPenalties = currentPenalties + 1;
  const shouldBan = newPenalties >= 5;
  const { error: updateErr } = await supabase.from("profiles").update({ penalties: newPenalties, is_banned: shouldBan }).eq("id", playerId);
  if (updateErr) throw updateErr;
  return { isBanned: shouldBan, penalties: newPenalties };
};

// ==========================================
// 🔥 GROUP CHAT FUNCTIONS 🔥
// ==========================================

export const createGroup = async (name: string, creatorId: string, memberIds: string[], avatarUrl: string = "") => {
  // 1. Create the Group
  const { data: newGroup, error: groupErr } = await supabase
    .from('groups')
    .insert([{ name: name, created_by: creatorId, avatar_url: avatarUrl }])
    .select().single();
    
  if (groupErr) throw groupErr;

  // 2. Add members (Creator as admin + selected friends as members)
  const membersToInsert = [
    { group_id: newGroup.id, user_id: creatorId, role: 'admin' },
    ...memberIds.map(id => ({ group_id: newGroup.id, user_id: id, role: 'member' }))
  ];
  
  const { error: memErr } = await supabase.from('group_members').insert(membersToInsert);
  if (memErr) throw memErr;

  return newGroup;
};

export const fetchUserGroups = async (userId: string) => {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group_id,
      groups ( id, name, avatar_url, created_by, created_at )
    `)
    .eq('user_id', userId);
    
  if (error) throw error;
  // Format the data cleanly
  return data.map((d: any) => d.groups).filter(Boolean);
};

export const fetchGroupMessages = async (groupId: string) => {
  const { data, error } = await supabase
    .from('group_messages')
    .select(`*, profiles:sender_id (id, display_name, avatar_url)`)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const sendGroupMessage = async (groupId: string, senderId: string, message: string) => {
  const { error } = await supabase
    .from('group_messages')
    .insert([{ group_id: groupId, sender_id: senderId, message: message }]);
    
  if (error) throw error;
  return true;
};