import { supabase } from "../utils/supabase";

// --- INTERFACES ---
export type TournamentStatus = "upcoming" | "ongoing" | "verifying" | "completed" | "disputed";

export interface Tournament {
  id: string;
  title: string;
  gameId: string;
  status: TournamentStatus;
  prizePool: string;
  date: string;
  time?: string; // 🔥 NEW: Match Time
  location: string;
  isPrivate?: boolean; 
  password?: string;
  host_id?: string;
  short_code?: string;
  is_deleted?: boolean; 
  result_image?: string; // 🔥 NEW: Screenshot URL
}

// // --- 🎮 DYNAMIC PLATFORM GAMES ---
// export interface PlatformGame {
//   id: string;
//   title: string;
//   genre: string;
//   description: string;
//   image_url: string;
//   official_modes: string[];
//   team_sizes: string[];
// }

// export const fetchPlatformGames = async (): Promise<PlatformGame[]> => {
//   const { data, error } = await supabase.from("platform_games").select("*").order("title", { ascending: true });
//   if (error) { console.error("Error fetching games:", error); return []; }
//   return data as PlatformGame[];
// };

// export const addPlatformGame = async (game: PlatformGame) => {
//   const { error } = await supabase.from("platform_games").insert([game]);
//   if (error) throw error;
//   return true;
// };

// export const deletePlatformGame = async (id: string) => {
//   const { error } = await supabase.from("platform_games").delete().eq("id", id);
//   if (error) throw error;
//   return true;
// };

export const GAMES = [
  { id: "fps", title: "FPS Combat", genre: "First Person Shooter", description: "High-stakes tactical shooters.", imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800" },
  { id: "fighting", title: "Fighting Arena", genre: "Combat", description: "One-on-one fighting games.", imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800" },
  { id: "sports", title: "Sports League", genre: "Racing & Sports", description: "Racing simulators and sports.", imageUrl: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&q=80&w=800" },
];

// 🔥 THE AUTO-SHIFTER HELPER FUNCTION 🔥
// This automatically changes "Upcoming" to "Ongoing" if the clock passes the match time!
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

// --- FETCH & CREATE TOURNAMENTS ---
export const fetchTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
  if (error) { console.error("Error fetching tournaments:", error); return []; }
  
  const cleanData = (data as Tournament[]).filter(t => t.is_deleted !== true);
  return applyAutoStatus(cleanData); // Apply the clock logic!
};

export const getTournamentById = async (id: string) => {
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", id).single();
  if (error) throw new Error("Tournament not found");
  if (data.is_deleted === true) throw new Error("🚫 This tournament has been terminated by the Admin.");
  
  return applyAutoStatus([data])[0]; // Apply the clock logic!
};

// --- 📸 STORAGE: IMAGE UPLOAD ---
export const uploadScreenshot = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage.from('screenshots').upload(filePath, file);
  if (error) throw new Error("Failed to upload image: " + error.message);

  const { data } = supabase.storage.from('screenshots').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- 🚨 HOST ACTION: COMPLETE TOURNAMENT 🚨 ---
export const completeTournamentMatch = async (tournamentId: string, imageUrl: string) => {
  const { error } = await supabase
    .from("tournaments")
    .update({ 
      status: "verifying", // 🔥 It now goes to purgatory, not completed!
      result_image: imageUrl 
    })
    .eq("id", tournamentId);

  if (error) throw new Error("Failed to finalize tournament.");
  return true;
};

// --- CREATE & JOIN (WITH BAN CHECKS) ---
// 🔥 FIX: Added 'token: string' back as the second argument so it matches your UI!
export const createTournament = async (formData: any, token: string, userId: string) => {
  
  // 1. Check if user is banned (Using the correct userId now!)
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (profile?.is_banned === true) throw new Error("🚨 BANNED: Your account has been suspended.");

  // 2. Generate Room Code
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // 3. Insert using strictly snake_case columns!
  const { data: newTournament, error } = await supabase.from("tournaments").insert([{
      title: formData.title,
      game_id: formData.gameId,             
      mode: formData.mode,                  
      team_size: formData.teamSize,         
      max_players: parseInt(formData.maxPlayers) || 0, 
      prize_pool: formData.prizePool,       
      date: formData.date,
      time: formData.time || "12:00", 
      location: formData.location,
      rules: formData.rules || null,        
      status: "upcoming",
      is_private: formData.isPrivate || false, 
      password: formData.password || null,
      host_id: userId, // 🔥 This will now correctly be the UUID, not the token!
      short_code: roomCode
    }]).select().single();

  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
  
  // 4. Auto-join the host to the participants table
  if (newTournament) {
    await supabase.from("tournament_participants").insert([{ tournament_id: newTournament.id, user_id: userId }]);
  }
  
  return true;
};

// 🔥 UPDATED: Strict Password Check 
export const joinTournament = async (tournamentId: string, userId: string, passwordInput?: string) => {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (profile?.is_banned === true) throw new Error("🚨 BANNED: Your account has been suspended.");

  const isAlreadyIn = await checkIsParticipant(tournamentId, userId);
  if (isAlreadyIn) throw new Error("You are already registered for this tournament!");

  // 🔥 Fetching is_private directly from DB
  const { data: tourn } = await supabase.from("tournaments").select("password, is_private").eq("id", tournamentId).single();
  
  if (tourn?.is_private) {
    if (!passwordInput) throw new Error("Password is required for private tournaments!");
    if (tourn.password !== passwordInput) throw new Error("❌ Incorrect password!");
  }

  const { error } = await supabase.from("tournament_participants").insert([{ tournament_id: tournamentId, user_id: userId }]);
  if (error) throw new Error(`Failed to join: ${error.message}`);
  return true;
};

export const checkIsParticipant = async (tournamentId: string, userId: string) => {
  const { data, error } = await supabase.from("tournament_participants").select("*").eq("tournament_id", tournamentId).eq("user_id", userId);
  if (error) return false;
  return data && data.length > 0;
};

// 🔥 NEW: HOST KICK PLAYER FUNCTION 🔥
export const kickPlayer = async (tournamentId: string, playerId: string) => {
  const { error } = await supabase.from("tournament_participants").delete().eq("tournament_id", tournamentId).eq("user_id", playerId);
  if (error) throw new Error("Failed to kick player: " + error.message);
  return true;
};

// --- ENHANCED PROFILE DATA LOGIC ---
export interface EnhancedUserProfile {
  stats: { tournamentsPlayed: number; tournamentsHosted: number; };
  playerTournaments: { upcoming: Tournament[]; ongoing: Tournament[]; completed: Tournament[]; };
  hostedTournaments: { upcoming: Tournament[]; ongoing: Tournament[]; completed: Tournament[]; };
}

export const fetchFullUserProfile = async (userId: string): Promise<EnhancedUserProfile> => {
  const { data: hosted } = await supabase.from("tournaments").select("*").eq("host_id", userId).order("date", { ascending: false });
  const hostedTourns = applyAutoStatus(((hosted as Tournament[]) || []).filter(t => t.is_deleted !== true));

  const { data: participants } = await supabase.from("tournament_participants").select("tournament_id").eq("user_id", userId);
  let playerTourns: Tournament[] = [];
  
  if (participants && participants.length > 0) {
    const tIds = participants.map((p) => p.tournament_id);
    const { data: joined } = await supabase.from("tournaments").select("*").in("id", tIds).order("date", { ascending: false });
    playerTourns = applyAutoStatus(((joined as Tournament[]) || []).filter(t => t.is_deleted !== true));
  }

  const filterByStatus = (tourns: Tournament[], status: TournamentStatus) => tourns.filter(t => t.status === status);

  return {
    stats: { tournamentsPlayed: playerTourns.length, tournamentsHosted: hostedTourns.length },
    playerTournaments: { upcoming: filterByStatus(playerTourns, "upcoming"), ongoing: filterByStatus(playerTourns, "ongoing"), completed: filterByStatus(playerTourns, "completed") },
    hostedTournaments: { upcoming: filterByStatus(hostedTourns, "upcoming"), ongoing: filterByStatus(hostedTourns, "ongoing"), completed: filterByStatus(hostedTourns, "completed") }
  };
};

export const getUserProfile = async (userId: string) => {
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (profileError) throw profileError;
  const { data: linkedGames, error: gamesError } = await supabase.from("linked_games").select("*").eq("user_id", userId);
  if (gamesError) throw gamesError;
  return { profile, linkedGames };
};

export const saveLinkedGame = async (userId: string, gameId: string, inGameId: string, inGameName: string) => {
  const { data: existing } = await supabase.from("linked_games").select("id, edits_remaining").eq("user_id", userId).eq("game_id", gameId).single();
  if (existing) {
    if (existing.edits_remaining <= 0) throw new Error("Security Lock: You have 0 edits remaining for this game.");
    const { error } = await supabase.from("linked_games").update({ in_game_id: inGameId, in_game_name: inGameName, edits_remaining: existing.edits_remaining - 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("linked_games").insert([{ user_id: userId, game_id: gameId, in_game_id: inGameId, in_game_name: inGameName }]);
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

// ==========================================
// --- ⚖️ PLAYER VOTING & CONSENSUS ⚖️ ---
// ==========================================

export const fetchMatchVotes = async (tournamentId: string) => {
  const { data, error } = await supabase
    .from("match_votes")
    .select(`*, profiles ( display_name )`)
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data || [];
};

export const submitMatchVote = async (tournamentId: string, userId: string, isApproved: boolean, reason?: string, proofUrl?: string) => {
  const { data: existing } = await supabase.from("match_votes").select("id").eq("tournament_id", tournamentId).eq("user_id", userId).single();

  if (existing) {
    const { error } = await supabase.from("match_votes").update({ 
      is_approved: isApproved, dispute_reason: reason, proof_image: proofUrl 
    }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("match_votes").insert([{
      tournament_id: tournamentId, user_id: userId, is_approved: isApproved, dispute_reason: reason, proof_image: proofUrl
    }]);
    if (error) throw error;
  }
  return true;
};

// ==========================================
// --- 👑 ADMIN "GOD MODE" CONTROLS 👑 ---
// ==========================================
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
    // Verdict: Host is telling the truth. Force match to Completed.
    const { error } = await supabase.from("tournaments").update({ status: "completed" }).eq("id", tournamentId);
    if (error) throw error;
  } else {
    // Verdict: Host lied. Nuke the match and punish the host!
    await supabase.from("tournaments").update({ is_deleted: true, status: "disputed" }).eq("id", tournamentId);

    // Add a strike. If they hit 2 strikes, the database auto-bans them.
    const { data: hostProfile } = await supabase.from("profiles").select("host_strikes").eq("id", hostId).single();
    const newStrikes = (hostProfile?.host_strikes || 0) + 1;
    const shouldBan = newStrikes >= 2;

    await supabase.from("profiles").update({ 
      host_strikes: newStrikes, 
      is_banned: shouldBan 
    }).eq("id", hostId);
  }
  return true;
};

// ----------------------------------------------------
// 🔥 PLATFORM GAMES ADMIN FUNCTIONS 🔥
// ----------------------------------------------------

export type PlatformGame = {
  id: string;
  title: string;
  genre: string;
  description: string;
  image_url: string;
  official_modes: string[];
  team_sizes: string[];
};

// Fetch all games from the database
export const fetchPlatformGames = async (): Promise<PlatformGame[]> => {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching games:", error);
    return [];
  }
  return data || [];
};

// Add a new game to the database (You can also do this directly in the component like you did!)
export const addPlatformGame = async (gameData: Omit<PlatformGame, 'id'>) => {
  const { error } = await supabase
    .from('games')
    .insert([gameData]);

  if (error) throw error;
};

// Permanently delete a game from the database
export const deletePlatformGame = async (id: string) => {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', id);

  if (error) throw error;
};


export const unlinkGame = async (userId: string, gameId: string) => {
  const { data, error } = await supabase
    .from('player_game_profiles')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId);

  if (error) {
    console.error("Supabase Delete Error:", error.message);
    throw error;
  }
  
  return data;
};