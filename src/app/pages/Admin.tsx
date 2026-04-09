import { useState, useEffect } from "react";
import { ShieldAlert, Trash2, ShieldCheck, Loader2, Users, Trophy, BarChart3, Database, AlertTriangle, Scale, CheckCircle2, Gamepad2, Sparkles, Plus } from "lucide-react";
import { fetchAllTournamentsAdmin, fetchAllUsersAdmin, deleteTournamentAdmin, toggleBanStatus, resolveDisputeAdmin, fetchMatchVotes, fetchPlatformGames, addPlatformGame, deletePlatformGame, type PlatformGame } from "../../app/data";
import { supabase } from "../../utils/supabase";

const ADMIN_PASSCODE = "OM_SVSU_2026"; 

export function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"analytics" | "tournaments" | "users" | "disputes" | "games">("games"); // 🔥 Defaulting to games for testing
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [games, setGames] = useState<PlatformGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sub-tabs
  const [playerTab, setPlayerTab] = useState<"active" | "banned">("active");
  const [arenaTab, setArenaTab] = useState<"live" | "nuked">("live");

  // Dispute State
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [disputeEvidence, setDisputeEvidence] = useState<any[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  // 🔥 Game Manager State 🔥
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [newGame, setNewGame] = useState<PlatformGame>({ id: "", title: "", genre: "", description: "", image_url: "", official_modes: [], team_sizes: [] });
  const [modesInput, setModesInput] = useState("");
  const [teamsInput, setTeamsInput] = useState("");

  useEffect(() => { if (isAuthenticated) loadAdminData(); }, [isAuthenticated]);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [tData, uData, gData] = await Promise.all([fetchAllTournamentsAdmin(), fetchAllUsersAdmin(), fetchPlatformGames()]);
      setTournaments(tData);
      setUsers(uData);
      setGames(gData);
    } catch (err) { console.error("Failed to load admin data", err); } 
    finally { setIsLoading(false); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === ADMIN_PASSCODE) { setIsAuthenticated(true); setError(""); } 
    else { setError("ACCESS DENIED: Invalid Passcode."); setPasscodeInput(""); }
  };

  // --- ACTIONS ---
  const handleToggleBan = async (id: string, currentStatus: boolean, name: string) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? "UNBAN" : "BAN"} ${name}?`)) return;
    try { await toggleBanStatus(id, currentStatus); setUsers(users.map(u => u.id === id ? { ...u, is_banned: !currentStatus } : u)); } 
    catch (err) { alert("Failed to update ban status."); }
  };

  const handleDeleteTournament = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to NUKE "${title}"?`)) return;
    try { await deleteTournamentAdmin(id); setTournaments(tournaments.map(t => t.id === id ? { ...t, is_deleted: true } : t)); } 
    catch (err) { alert("Failed to nuke tournament."); }
  };

  const openDisputeReview = async (tournamentId: string) => {
    setReviewingId(tournamentId);
    try {
      const votes = await fetchMatchVotes(tournamentId);
      setDisputeEvidence(votes.filter((v: any) => !v.is_approved));
    } catch (err) { console.error("Failed to load evidence", err); }
  };

  const handleResolveDispute = async (tournamentId: string, hostId: string, hostWins: boolean) => {
    const confirmMsg = hostWins ? "VERDICT: Host wins. Proceed?" : "VERDICT: Players Win. Nuke match & Strike Host. Proceed?";
    if (!window.confirm(confirmMsg)) return;
    setIsResolving(true);
    try { await resolveDisputeAdmin(tournamentId, hostId, hostWins); alert("Verdict applied."); setReviewingId(null); loadAdminData(); } 
    catch (err) { alert("Failed to apply verdict."); } finally { setIsResolving(false); }
  };

  // 🔥 GAME MANAGER ACTIONS 🔥
 // 🔥 GAME MANAGER ACTIONS 🔥
const handleAIFetch = async (e: React.MouseEvent) => {
  e.preventDefault(); // Stop the form from accidentally submitting
  
  if (!newGame.title.trim()) {
    alert("Please type a Game Title first! (e.g. 'Valorant' or 'Free Fire')");
    return;
  }

  // We temporarily change the title to show it's loading so you know it's working
  const originalTitle = newGame.title;
  setNewGame({ ...newGame, title: "🤖 AI is scanning the web..." });

  try {
    // 1. Call your secure Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('ai-game-scraper', {
      body: { gameName: originalTitle }
    });

    if (error) throw error;
    
    // 2. The AI returns the perfect JSON object. We inject it into your form!
    setNewGame({
      ...newGame,
      title: data.title || originalTitle, // Use the official name the AI found
      genre: data.genre || "",
      description: data.description || "",
      // We don't overwrite the image url if you already pasted one
      image_url: newGame.image_url || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800" 
    });

    // 3. We have to join the arrays back into comma-separated strings for your input boxes
    if (data.official_modes) setModesInput(data.official_modes.join(', '));
    if (data.team_sizes) setTeamsInput(data.team_sizes.join(', '));
    
  } catch (err: any) {
    console.error("AI Fetch Error:", err);
    alert("Failed to connect to the AI Engine. Check the console for details.");
    setNewGame({ ...newGame, title: originalTitle }); // Reset title on failure
  }
};
// 🔥 PERMANENTLY SAVE TO DATABASE 🔥
const handleAddGame = async (e: React.FormEvent) => {
  e.preventDefault();

  // Basic safety check
  if (!newGame.title) {
    alert("Please fill out at least the Game Title!");
    return;
  }

  try {
    // 1. Convert your comma-separated input strings back into clean arrays
    const modesArray = modesInput.split(',').map(mode => mode.trim()).filter(Boolean);
    const teamsArray = teamsInput.split(',').map(team => team.trim()).filter(Boolean);

    // 2. Send the payload to your Supabase 'games' table
    const { error } = await supabase
      .from('games') // Make sure this matches your actual table name in Supabase!
      .insert([
        {
          title: newGame.title,
          genre: newGame.genre,
          description: newGame.description,
          image_url: newGame.image_url,
          official_modes: modesArray,
          team_sizes: teamsArray
        }
      ]);

    if (error) throw error;

    // 3. Success! Clear the form so you can add another game
    alert("🎉 Game successfully added to Local Arena!");
    setNewGame({ ...newGame, title: "", genre: "", description: "", image_url: "" });
    setModesInput("");
    setTeamsInput("");

  } catch (err: any) {
    console.error("Database Save Error:", err.message);
    alert("Failed to save to database. Check the console!");
  }
};

  const handleDeleteGame = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${title}? This might break existing tournaments tied to this game!`)) return;
    try { await deletePlatformGame(id); setGames(games.filter(g => g.id !== id)); } 
    catch (err) { alert("Failed to delete game."); }
  };

  const totalTournaments = tournaments.length;
  const activeTournamentsCount = tournaments.filter(t => !t.is_deleted).length;
  const nukedTournamentsCount = tournaments.filter(t => t.is_deleted).length;
  const completedTournaments = tournaments.filter(t => t.status === "completed" && !t.is_deleted).length;
  const totalPlayers = users.length;
  const bannedPlayersCount = users.filter(u => u.is_banned).length;
  const pendingDisputes = tournaments.filter(t => !t.is_deleted && (t.status === "verifying" || t.status === "disputed"));

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-neutral-900 border border-red-500/30 p-8 rounded-3xl max-w-md w-full shadow-2xl shadow-red-500/10">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white mb-2">RESTRICTED AREA</h2>
        <form onSubmit={handleLogin} className="space-y-4 mt-8">
          <input type="password" value={passcodeInput} onChange={(e) => setPasscodeInput(e.target.value)} placeholder="Enter Passcode..." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-center text-white font-mono focus:border-red-500 outline-none" />
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors">Access Mainframe</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-red-950/20 border border-red-900/50 rounded-3xl p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 p-3 rounded-xl border border-red-500/30"><ShieldCheck className="w-8 h-8 text-red-500" /></div>
            <div><h1 className="text-2xl font-black text-white">SYSTEM ADMIN</h1><p className="text-red-400 text-sm font-mono tracking-widest">GOD MODE ACTIVE</p></div>
          </div>
          <div className="flex gap-2 bg-neutral-900 border border-neutral-800 p-1 rounded-xl overflow-x-auto">
            <button onClick={() => setActiveTab("games")} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === "games" ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/20" : "text-neutral-400 hover:text-white"}`}><Gamepad2 className="w-4 h-4" /> Games</button>
            <button onClick={() => setActiveTab("disputes")} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === "disputes" ? "bg-red-600 text-white shadow-lg shadow-red-500/20" : "text-neutral-400 hover:text-white"}`}><Scale className="w-4 h-4" /> Disputes {pendingDisputes.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingDisputes.length}</span>}</button>
            <button onClick={() => setActiveTab("analytics")} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === "analytics" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}><BarChart3 className="w-4 h-4" /> Analytics</button>
            <button onClick={() => setActiveTab("tournaments")} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === "tournaments" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}><Trophy className="w-4 h-4" /> Arenas</button>
            <button onClick={() => setActiveTab("users")} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === "users" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}><Users className="w-4 h-4" /> Players</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 text-red-500 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            
            {/* 🎮 GAME MANAGER TAB 🎮 */}
            {activeTab === "games" && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black flex items-center gap-2"><Gamepad2 className="w-6 h-6 text-fuchsia-500" /> Platform Games</h2>
                  <button onClick={() => setIsAddingGame(!isAddingGame)} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2">
                    {isAddingGame ? "Cancel" : <><Plus className="w-4 h-4"/> Add New Game</>}
                  </button>
                </div>

                {/* ADD NEW GAME FORM */}
                {isAddingGame && (
                  <div className="bg-neutral-950 border border-fuchsia-500/30 rounded-2xl p-6 mb-8 shadow-xl shadow-fuchsia-500/5">
                    <div className="flex justify-between items-start mb-6 border-b border-neutral-800 pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white">Add Database Entry</h3>
                        <p className="text-sm text-neutral-400 mt-1">Add a game manually or use the AI Auto-Fill.</p>
                      </div>
                      
                      {/* 🔥 THE MAGIC WAND BUTTON 🔥 */}
                      <button onClick={handleAIFetch} className="px-4 py-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white rounded-lg font-black transition-all flex items-center gap-2 shadow-lg shadow-fuchsia-500/30">
                        <Sparkles className="w-4 h-4" /> AI Auto-Fill
                      </button>
                    </div>

                    <form onSubmit={handleAddGame} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold text-neutral-400 uppercase">Game Title</label><input type="text" required value={newGame.title} onChange={e => setNewGame({...newGame, title: e.target.value})} placeholder="e.g. Call of Duty Mobile" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 mt-1 text-white focus:border-fuchsia-500 outline-none" /></div>
                        <div><label className="text-xs font-bold text-neutral-400 uppercase">Genre</label><input type="text" required value={newGame.genre} onChange={e => setNewGame({...newGame, genre: e.target.value})} placeholder="e.g. Battle Royale" className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 mt-1 text-white focus:border-fuchsia-500 outline-none" /></div>
                      </div>
                      
                      <div><label className="text-xs font-bold text-neutral-400 uppercase">Banner Image URL</label><input type="url" value={newGame.image_url} onChange={e => setNewGame({...newGame, image_url: e.target.value})} placeholder="https://..." className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 mt-1 text-white focus:border-fuchsia-500 outline-none" /></div>
                      <div><label className="text-xs font-bold text-neutral-400 uppercase">Description</label><textarea required value={newGame.description} onChange={e => setNewGame({...newGame, description: e.target.value})} placeholder="Short description of the game..." className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 mt-1 text-white focus:border-fuchsia-500 outline-none" rows={2} /></div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800"><label className="text-xs font-bold text-cyan-400 uppercase">Official Modes (Comma Separated)</label><input type="text" required value={modesInput} onChange={e => setModesInput(e.target.value)} placeholder="e.g. Classic, TDM, Rush" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 mt-2 text-white focus:border-cyan-500 outline-none" /></div>
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800"><label className="text-xs font-bold text-emerald-400 uppercase">Team Sizes (Comma Separated)</label><input type="text" required value={teamsInput} onChange={e => setTeamsInput(e.target.value)} placeholder="e.g. Solo, Duo, Squad, 5v5" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 mt-2 text-white focus:border-emerald-500 outline-none" /></div>
                      </div>

                      <button type="submit" className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-wider rounded-xl mt-4">Save Game to Database</button>
                    </form>
                  </div>
                )}

                {/* ACTIVE GAMES LIST */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {games.map(game => (
                    <div key={game.id} className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden group">
                      <div className="h-32 bg-neutral-800 relative">
                        {game.image_url && <img src={game.image_url} alt={game.title} className="w-full h-full object-cover opacity-60" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 to-transparent"></div>
                        <h3 className="absolute bottom-3 left-4 text-xl font-black text-white">{game.title}</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        <p className="text-xs text-neutral-400 line-clamp-2">{game.description}</p>
                        
                        <div>
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Modes</p>
                          <div className="flex flex-wrap gap-1">
                            {game.official_modes.map(m => <span key={m} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] px-2 py-0.5 rounded">{m}</span>)}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Team Sizes</p>
                          <div className="flex flex-wrap gap-1">
                            {game.team_sizes.map(t => <span key={t} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded">{t}</span>)}
                          </div>
                        </div>

                        <button onClick={() => handleDeleteGame(game.id, game.title)} className="w-full py-2 mt-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold transition-colors">
                          Delete Game
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* (The rest of your existing Admin Tabs go here - Disputes, Analytics, etc.) */}
            
            {/* ⚖️ SUPREME COURT (DISPUTES TAB) */}
            {activeTab === "disputes" && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
                <h2 className="text-2xl font-black mb-6 flex items-center gap-2"><Scale className="w-6 h-6 text-red-500" /> Pending Match Reviews</h2>
                
                {pendingDisputes.length === 0 ? (
                  <div className="text-center py-12 bg-neutral-950 rounded-2xl border border-neutral-800 border-dashed">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-neutral-300">All Clear!</h3>
                    <p className="text-neutral-500">There are no matches waiting for admin review.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingDisputes.map(t => (
                      <div key={t.id} className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-neutral-900/50">
                          <div>
                            <h4 className="font-bold text-lg flex items-center gap-2">
                              {t.title} 
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-widest ${t.status === "disputed" ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"}`}>{t.status.toUpperCase()}</span>
                            </h4>
                            <p className="text-xs text-neutral-500 font-mono mt-1">Host ID: {t.host_id}</p>
                          </div>
                          <button onClick={() => reviewingId === t.id ? setReviewingId(null) : openDisputeReview(t.id)} className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold transition-colors">
                            {reviewingId === t.id ? "Close Case" : "Review Evidence"}
                          </button>
                        </div>

                        {reviewingId === t.id && (
                          <div className="p-6 border-t border-neutral-800 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h3 className="font-black text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Host's Claim</h3>
                              {t.result_image ? (
                                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900 p-2"><img src={t.result_image} alt="Host Result" className="w-full h-auto rounded-lg" /><a href={t.result_image} target="_blank" rel="noreferrer" className="block text-center mt-2 text-sm text-cyan-400 hover:underline">Open Full Image</a></div>
                              ) : <p className="text-sm text-neutral-500 italic">No image provided.</p>}
                              <button disabled={isResolving} onClick={() => handleResolveDispute(t.id, t.host_id, true)} className="w-full py-4 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white rounded-xl font-black transition-all">
                                {isResolving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "VERDICT: Host Wins"}
                              </button>
                            </div>
                            <div className="space-y-4">
                              <h3 className="font-black text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> Player Disputes ({disputeEvidence.length})</h3>
                              <div className="max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                {disputeEvidence.length === 0 ? (
                                  <p className="text-sm text-neutral-500 italic bg-neutral-900 p-4 rounded-xl text-center">No active disputes yet.</p>
                                ) : (
                                  disputeEvidence.map(d => (
                                    <div key={d.id} className="bg-red-950/20 border border-red-500/30 rounded-xl p-4">
                                      <p className="text-xs text-red-400 font-bold mb-2 uppercase tracking-wider">Player: {d.profiles?.display_name}</p>
                                      <p className="text-sm text-neutral-300 mb-3">"{d.dispute_reason || "No reason provided."}"</p>
                                      {d.proof_image && (
                                        <div className="mt-2 pt-2 border-t border-red-500/20">
                                          <p className="text-xs text-neutral-500 mb-2">Counter-Evidence:</p>
                                          <img src={d.proof_image} alt="Proof" className="w-full rounded border border-red-500/30" />
                                          <a href={d.proof_image} target="_blank" rel="noreferrer" className="block text-center mt-2 text-xs text-cyan-400 hover:underline">View Full Proof</a>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                              <button disabled={isResolving} onClick={() => handleResolveDispute(t.id, t.host_id, false)} className="w-full py-4 bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-500 hover:text-white rounded-xl font-black transition-all">
                                {isResolving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "VERDICT: Players Win (Nuke & Strike)"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl"><Database className="w-8 h-8 text-cyan-500 mb-4" /><p className="text-neutral-400 font-bold mb-1">Total Lifetime Arenas</p><p className="text-4xl font-black">{totalTournaments}</p><div className="mt-4 pt-4 border-t border-neutral-800 flex justify-between text-sm"><span className="text-emerald-400">{activeTournamentsCount} Active</span><span className="text-red-500">{nukedTournamentsCount} Nuked</span></div></div>
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl"><Trophy className="w-8 h-8 text-fuchsia-500 mb-4" /><p className="text-neutral-400 font-bold mb-1">Completed Tournaments</p><p className="text-4xl font-black">{completedTournaments}</p><p className="mt-4 pt-4 border-t border-neutral-800 text-sm text-neutral-500">Matches fully processed</p></div>
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl"><Users className="w-8 h-8 text-emerald-500 mb-4" /><p className="text-neutral-400 font-bold mb-1">Registered Users</p><p className="text-4xl font-black">{totalPlayers}</p><div className="mt-4 pt-4 border-t border-neutral-800 flex justify-between text-sm"><span className="text-neutral-400">{totalPlayers - bannedPlayersCount} Clean</span><span className="text-red-500 font-bold">{bannedPlayersCount} Banned</span></div></div>
              </div>
            )}

            {/* ARENAS TAB */}
            {activeTab === "tournaments" && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
                <div className="flex border-b border-neutral-800 bg-neutral-950">
                  <button onClick={() => setArenaTab("live")} className={`flex-1 py-4 font-bold ${arenaTab === "live" ? "text-cyan-400 border-b-2 border-cyan-400" : "text-neutral-500"}`}>Live / Public</button>
                  <button onClick={() => setArenaTab("nuked")} className={`flex-1 py-4 font-bold ${arenaTab === "nuked" ? "text-red-500 border-b-2 border-red-500" : "text-neutral-500"}`}>Graveyard (Nuked)</button>
                </div>
                <div className="divide-y divide-neutral-800">
                  {tournaments.filter(t => arenaTab === "live" ? !t.is_deleted : t.is_deleted).map(t => (
                    <div key={t.id} className="p-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-neutral-800/30">
                      <div className="flex-1"><h4 className="font-bold text-lg">{t.title}</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-neutral-400"><p><strong>Host ID:</strong> {t.host_id?.substring(0,8)}...</p><p><strong>Status:</strong> {t.status}</p></div></div>
                      {!t.is_deleted && <button onClick={() => handleDeleteTournament(t.id, t.title)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-lg font-bold"><Trash2 className="w-4 h-4 inline mr-2" /> Nuke</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYERS TAB */}
            {activeTab === "users" && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden">
                <div className="flex border-b border-neutral-800 bg-neutral-950">
                  <button onClick={() => setPlayerTab("active")} className={`flex-1 py-4 font-bold ${playerTab === "active" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-neutral-500"}`}>Active Personnel</button>
                  <button onClick={() => setPlayerTab("banned")} className={`flex-1 py-4 font-bold ${playerTab === "banned" ? "text-red-500 border-b-2 border-red-500" : "text-neutral-500"}`}>Banned List</button>
                </div>
                <div className="divide-y divide-neutral-800">
                  {users.filter(u => playerTab === "active" ? !u.is_banned : u.is_banned).map(u => (
                    <div key={u.id} className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-4"><img src={u.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-12 h-12 rounded-full border border-neutral-700" /><div><h4 className="font-bold text-lg">{u.display_name}</h4><p className="text-xs text-neutral-500">Strikes: <span className={u.host_strikes >= 2 ? "text-red-500 font-bold" : "text-yellow-500"}>{u.host_strikes || 0}</span> / 2</p></div></div>
                      <button onClick={() => handleToggleBan(u.id, u.is_banned, u.display_name)} className={`px-5 py-2 rounded-lg font-bold border ${u.is_banned ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}`}>{u.is_banned ? "Pardon & Unban" : "Ban Player"}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}