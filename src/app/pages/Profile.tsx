import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  getUserProfile, 
  saveLinkedGame, 
  fetchFullUserProfile, 
  unlinkGame, 
  type EnhancedUserProfile, 
  type Tournament 
} from "../data"; 
import { 
  ShieldAlert, Gamepad2, AlertCircle, CheckCircle2, Loader2, Save, Edit2, 
  Swords, Crown, Calendar, Play, ExternalLink, Copy, Check 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

// FIXED IMPORT: Removed the .ts extension which crashes React bundlers
import { supabase } from "../../utils/supabase"; 

export function Profile() {
  const { user } = useAuth();
  
  // Base Profile State
  const [profile, setProfile] = useState<any>(null);
  const [linkedGames, setLinkedGames] = useState<any[]>([]);
  const [platformGames, setPlatformGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Game UI State
  const [isAddingNewGame, setIsAddingNewGame] = useState(false);
  const [selectedGameToAdd, setSelectedGameToAdd] = useState("");

  // Tournament Dashboard State
  const [enhancedData, setEnhancedData] = useState<EnhancedUserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"player" | "host">("player");

  // Form State
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [inGameId, setInGameId] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 🔥 NEW: Copy Friend Code State
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      // 1. Load the core profile and linked games
      const data = await getUserProfile(user.id);
      setProfile(data?.profile || null);
      setLinkedGames(data?.linkedGames || []);

      // 2. Load the tournament history for the dashboard
      const dashboardData = await fetchFullUserProfile(user.id);
      setEnhancedData(dashboardData);

      // 3. Fetch the live games from Supabase
      const { data: gamesData, error } = await supabase
        .from('games')
        .select('*')
        .order('title');
        
      if (gamesData && !error) {
        setPlatformGames(gamesData);
      } else if (error) {
        console.error("Supabase Games Error:", error.message);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // 🚨 NUCLEAR OPTION: Force the spinner off after 3 seconds
    // If your internet drops or the database hangs, this guarantees the page still loads!
    const safetyKillSwitch = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(safetyKillSwitch);
  }, [user]);

  const handleSaveGame = async (gameId: string) => {
    if (!inGameId.trim() || !inGameName.trim()) {
      setErrorMsg("Both ID and Name are required.");
      return;
    }
    
    setIsSaving(true);
    setErrorMsg("");
    
    try {
      await saveLinkedGame(user!.id, gameId, inGameId, inGameName);
      await loadData(); // Reload to update UI
      setEditingGame(null);
      setIsAddingNewGame(false);
      setSelectedGameToAdd("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save game ID.");
    } finally {
      setIsSaving(false);
    }
  };

  // 🔥 NEW: Copy Function
  const copyFriendCode = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex justify-center items-center">
        <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" />
      </div>
    );
  }

  if (!user || !profile || !enhancedData) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center text-white">
        <ShieldAlert className="w-16 h-16 text-neutral-600 mb-4" />
        <h2 className="text-xl font-bold text-neutral-400">Please login to view your profile.</h2>
      </div>
    );
  }

  // Mini-card for the dashboard columns
  const MiniTournamentCard = ({ tournament }: { tournament: Tournament }) => (
    <Link to={`/tournaments/${tournament.id}`} className="block mb-3">
      <div className="bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-colors rounded-xl p-4 flex justify-between items-center group">
        <div>
          <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors truncate max-w-[200px]">{tournament.title}</h4>
          <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
            <Calendar className="w-3 h-3" /> {new Date(tournament.date).toLocaleDateString()}
            {tournament.short_code && <span className="text-cyan-500 font-mono ml-2">Code: {tournament.short_code}</span>}
          </p>
        </div>
        <ExternalLink className="w-5 h-5 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* 🚨 THE BANNED WARNING BANNER 🚨 */}
        {profile?.is_banned && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-950/50 border-2 border-red-500 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6 shadow-2xl shadow-red-500/20"
          >
            <div className="bg-red-500 p-4 rounded-full animate-pulse">
              <ShieldAlert className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-1">Account Suspended</h2>
              <p className="text-red-200 font-medium">
                Your account has been banned by a System Administrator for violating platform rules. You can no longer join or host tournaments.
              </p>
            </div>
          </motion.div>
        )}

        {/* =========================================
            SECTION 1: MASTER PROFILE HEADER 
            ========================================= */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <img 
            src={profile.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
            alt="Avatar" 
            className="w-24 h-24 rounded-full border-2 border-fuchsia-500 object-cover z-10 shrink-0"
          />
          <div className="text-center md:text-left flex-1 z-10 w-full md:w-auto">
            <h1 className="text-3xl font-black truncate">{profile.display_name}</h1>
            <p className="text-neutral-400 font-mono text-sm mt-1 truncate">{user.email}</p>
            
            {/* 🔥 NEW: FRIEND CODE BOX 🔥 */}
            <div className="mt-4 flex items-center justify-center md:justify-start gap-2">
              <div className="bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg flex items-center gap-3 shadow-inner max-w-full overflow-hidden">
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider shrink-0">Friend Code</span>
                <span className="text-sm text-cyan-400 font-mono font-bold truncate select-all">{user.id}</span>
              </div>
              <button 
                onClick={copyFriendCode}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors shrink-0 border border-neutral-700"
                title="Copy Friend Code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-400" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 z-10 mt-4 md:mt-0">
            {/* Host Strike Tracker */}
            <div className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center ${
              profile.host_strikes >= 2 ? "bg-red-500/10 border-red-500" : 
              profile.host_strikes === 1 ? "bg-yellow-500/10 border-yellow-500" : 
              "bg-emerald-500/10 border-emerald-500/50"
            }`}>
              <ShieldAlert className={`w-6 h-6 mb-1 ${
                profile.host_strikes >= 2 ? "text-red-500" : 
                profile.host_strikes === 1 ? "text-yellow-500" : 
                "text-emerald-500"
              }`} />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Host Strikes</span>
              <span className="text-lg font-black">{profile.host_strikes} / 2</span>
            </div>

            {/* Dashboard Stats */}
            <div className="bg-neutral-950 border border-neutral-800 px-5 py-3 rounded-xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Played</span>
              <span className="text-2xl font-black text-cyan-400">{enhancedData.stats.tournamentsPlayed}</span>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 px-5 py-3 rounded-xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Hosted</span>
              <span className="text-2xl font-black text-fuchsia-500">{enhancedData.stats.tournamentsHosted}</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* =========================================
            SECTION 2: ANTI-SMURF IDENTITY LOCK 
            ========================================= */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-cyan-400" /> Linked Game Accounts
              </h2>
              <p className="text-neutral-400 text-sm mt-1">
                Link your exact in-game ID. Games with tournament history cannot be removed.
              </p>
            </div>
            
            {/* The Add Game Button (Only shows games not yet linked) */}
            {!isAddingNewGame && platformGames.filter(g => !linkedGames.some(lg => lg.game_id === g.id)).length > 0 && (
              <button
                onClick={() => setIsAddingNewGame(true)}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-lg shadow-black/20 shrink-0"
              >
                + Add New Game
              </button>
            )}
          </div>

          {/* THE ADD NEW GAME FORM */}
          {isAddingNewGame && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6 mb-8 shadow-xl shadow-cyan-500/5">
              <h3 className="font-bold text-lg mb-4 text-cyan-400 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" /> Select a game to link
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select 
                  value={selectedGameToAdd} 
                  onChange={(e) => setSelectedGameToAdd(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                >
                  <option value="">Select a game...</option>
                  {platformGames.filter(g => !linkedGames.some(lg => lg.game_id === g.id)).map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
                <input 
                  type="text" placeholder="Exact In-Game Name" value={inGameName} onChange={(e) => setInGameName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                />
                <input 
                  type="text" placeholder="Exact Game ID" value={inGameId} onChange={(e) => setInGameId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setIsAddingNewGame(false); setSelectedGameToAdd(""); setInGameId(""); setInGameName(""); }} className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                <button 
                  onClick={() => handleSaveGame(selectedGameToAdd)} 
                  disabled={isSaving || !selectedGameToAdd}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Account
                </button>
              </div>
            </motion.div>
          )}

          {/* LINKED GAMES GRID */}
          {linkedGames.length === 0 && !isAddingNewGame ? (
            <div className="text-center py-16 border border-neutral-800 border-dashed rounded-3xl bg-neutral-900/30">
              <Gamepad2 className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-neutral-400 mb-2">No Games Linked</h3>
              <p className="text-neutral-500 text-sm">Add a game above to start tracking your stats and joining tournaments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {linkedGames.map((linkedData) => {
                const game = platformGames.find(g => g.id === linkedData.game_id);
                if (!game) return null; 
                
                const isEditing = editingGame === game.id;
                const hasPlayedMatches = (linkedData.matches_played > 0) || (linkedData.wins > 0) || (linkedData.kills > 0);

                return (
                  <motion.div layout key={game.id} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 relative shadow-lg">
                    <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-3xl flex items-center border-b border-l border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> LINKED
                    </div>

                    <h3 className="font-bold text-xl mb-6 pr-16 text-white">{game.title}</h3>

                    {isEditing ? (
                      <div className="space-y-3 animate-fade-in">
                        <input type="text" placeholder="In-Game Name" value={inGameName} onChange={(e) => setInGameName(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none" />
                        <input type="text" placeholder="Exact Game ID" value={inGameId} onChange={(e) => setInGameId(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none font-mono" />
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => setEditingGame(null)} className="flex-1 py-3 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors font-medium">Cancel</button>
                          <button onClick={() => handleSaveGame(game.id)} disabled={isSaving} className="flex-1 py-3 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors font-bold flex justify-center items-center">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1"/> Save</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800">
                          <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider font-bold">In-Game Name</p>
                          <p className="font-semibold text-white">{linkedData.in_game_name}</p>
                          <div className="h-px bg-neutral-800 my-3" />
                          <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider font-bold">Account ID</p>
                          <p className="font-mono text-cyan-400 break-all">{linkedData.in_game_id}</p>
                        </div>

                        {/* 🔥 The Stats Grid 🔥 */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center">
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Matches</p>
                            <p className="text-xl font-black text-white">{linkedData.matches_played || 0}</p>
                          </div>
                          <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Wins</p>
                            <p className="text-xl font-black text-emerald-400">{linkedData.wins || 0}</p>
                          </div>
                          <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(217,70,239,0.05)]">
                            <p className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1">Kills</p>
                            <p className="text-xl font-black text-fuchsia-400">{linkedData.kills || 0}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 border-t border-neutral-800 pt-4">
                          <span className={`text-xs font-bold ${linkedData.edits_remaining === 0 ? "text-red-500" : "text-neutral-500"}`}>
                            Edits Left: {linkedData.edits_remaining}/2
                          </span>
                          
                          <div className="flex items-center gap-4">
                            {/* 🔥 Protected Remove Button 🔥 */}
                            {!hasPlayedMatches && (
                              <button 
                                onClick={async () => {
                                  if(window.confirm("Are you sure you want to remove this game?")) {
                                    try {
                                      await unlinkGame(user!.id, game.id);
                                      loadData(); 
                                    } catch (err) {
                                      console.error("Failed to unlink game", err);
                                    }
                                  }
                                }}
                                className="text-xs font-bold text-red-500/70 hover:text-red-400 transition-colors"
                              >
                                Remove
                              </button>
                            )}

                            {linkedData.edits_remaining > 0 && (
                              <button 
                                onClick={() => {
                                  setInGameId(linkedData.in_game_id);
                                  setInGameName(linkedData.in_game_name);
                                  setEditingGame(game.id);
                                }}
                                className="text-xs font-bold flex items-center text-cyan-500 hover:text-cyan-400 transition-colors bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20"
                              >
                                <Edit2 className="w-3 h-3 mr-1.5" /> Edit Info
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

       {/* =========================================
            SECTION 3: TOURNAMENT DASHBOARD 
            ========================================= */}
        <div className="pt-6 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-fuchsia-400" /> Career Dashboard
            </h2>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 bg-neutral-900/50 p-1.5 rounded-2xl border border-neutral-800 w-full md:w-auto">
              <button
                onClick={() => setActiveTab("player")}
                className={`flex-1 md:w-40 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === "player" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Swords className="w-4 h-4" /> Player
              </button>
              <button
                onClick={() => setActiveTab("host")}
                className={`flex-1 md:w-40 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === "host" ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/20" : "text-neutral-400 hover:text-white"
                }`}
              >
                <Crown className="w-4 h-4" /> Host
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              
              {/* Column 1: Upcoming / Scheduled */}
              <div className="bg-neutral-900/30 border border-neutral-800/50 p-5 rounded-2xl h-fit">
                <h3 className="text-lg font-black flex items-center gap-2 mb-4 pb-2 border-b border-neutral-800/50">
                  <Calendar className="w-5 h-5 text-neutral-400" />
                  {activeTab === "player" ? "Upcoming Matches" : "Scheduled Events"}
                </h3>
                {enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].upcoming.length === 0 ? (
                  <p className="text-sm text-neutral-600 italic">Nothing scheduled yet.</p>
                ) : (
                  enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].upcoming.map(t => <MiniTournamentCard key={t.id} tournament={t} />)
                )}
              </div>

              {/* Column 2: Ongoing */}
              <div className="bg-neutral-900/30 border border-neutral-800/50 p-5 rounded-2xl h-fit">
                <h3 className="text-lg font-black flex items-center gap-2 mb-4 pb-2 border-b border-neutral-800/50">
                  <Play className="w-5 h-5 text-fuchsia-500" />
                  Ongoing
                </h3>
                {enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].ongoing.length === 0 ? (
                  <p className="text-sm text-neutral-600 italic">No live events right now.</p>
                ) : (
                  enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].ongoing.map(t => <MiniTournamentCard key={t.id} tournament={t} />)
                )}
              </div>

              {/* Column 3: Completed */}
              <div className="bg-neutral-900/30 border border-neutral-800/50 p-5 rounded-2xl h-fit">
                <h3 className="text-lg font-black flex items-center gap-2 mb-4 pb-2 border-b border-neutral-800/50">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500" />
                  Completed
                </h3>
                {enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].completed.length === 0 ? (
                  <p className="text-sm text-neutral-600 italic">No history available.</p>
                ) : (
                  enhancedData[activeTab === "player" ? "playerTournaments" : "hostedTournaments"].completed.map(t => <MiniTournamentCard key={t.id} tournament={t} />)
                )}
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
)};