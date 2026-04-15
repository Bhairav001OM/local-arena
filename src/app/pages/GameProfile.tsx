import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import { fetchGameMatchHistory, getUserProfile } from "../data";
import { Loader2, ChevronLeft, Gamepad2, Trophy, Skull, ShieldAlert, LineChart, Target, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GameProfile() {
  const { userId, gameId } = useParams<{ userId: string; gameId: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [linkedGame, setLinkedGame] = useState<any>(null);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  
  const [activeMode, setActiveMode] = useState<string>("Global");
  // 🔥 NEW: Search Query State 🔥
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!userId || !gameId) return;
      setIsLoading(true);
      
      try {
        const userData = await getUserProfile(userId);
        if (!isMounted) return;
        
        setProfile(userData.profile);
        const lg = userData.linkedGames.find((g: any) => g.game_id === gameId);
        setLinkedGame(lg);
        setPlayerStats(userData.playerStats.filter((s: any) => s.game_id === gameId));

        const { data: gInfo } = await supabase.from('games').select('*').eq('id', gameId).single();
        if (gInfo) setGameInfo(gInfo);

        const history = await fetchGameMatchHistory(userId, gameId);
        setMatchHistory(history);

      } catch (error) {
        console.error("Error loading Game Profile:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadData();
    return () => { isMounted = false; };
  }, [userId, gameId]);

  if (isLoading) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" /></div>;
  if (!profile || !linkedGame) return <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center text-white"><ShieldAlert className="w-16 h-16 text-neutral-600 mb-4" /><h2 className="text-xl font-bold">Game Profile Not Found.</h2><Link to="/profile" className="text-cyan-500 mt-4">Go Back</Link></div>;

  let modeStats = { matches_played: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0 };
  if (activeMode === "Global") {
    playerStats.forEach(s => {
      modeStats.matches_played += (s.matches_played || 0); modeStats.wins += (s.wins || 0); modeStats.kills += (s.kills || 0); modeStats.deaths += (s.deaths || 0); modeStats.assists += (s.assists || 0); modeStats.damage += (s.damage || 0);
    });
  } else {
    const specificStat = playerStats.find(s => s.game_mode === activeMode);
    if (specificStat) modeStats = specificStat;
  }

  // Filter Match History based on Mode
  const filteredHistory = activeMode === "Global" ? matchHistory : matchHistory.filter(m => m.mode === activeMode);
  
  // 🔥 NEW: Apply Search Filter on top of Mode Filter 🔥
  const searchedHistory = filteredHistory.filter(match => {
    const query = searchQuery.toLowerCase();
    return (
      match.title?.toLowerCase().includes(query) ||
      match.id?.toLowerCase().includes(query) ||
      match.short_code?.toLowerCase().includes(query)
    );
  });

  const gameModes = ["Global", ...(gameInfo?.official_modes || [])];

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6 lg:px-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <Link to="/profile" className="inline-flex items-center text-neutral-400 hover:text-white font-medium bg-neutral-900 px-4 py-2 rounded-lg w-fit">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Profile
        </Link>

        {/* HEADER */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          {gameInfo?.image_url ? (
            <img src={gameInfo.image_url} alt="Game" className="w-24 h-24 rounded-2xl object-cover border border-neutral-700 z-10 shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-neutral-800 flex items-center justify-center border border-neutral-700 z-10 shrink-0"><Gamepad2 className="w-10 h-10 text-neutral-500" /></div>
          )}
          
          <div className="z-10 flex-1 text-center md:text-left">
            <h1 className="text-3xl font-black text-white">{linkedGame.in_game_name}</h1>
            <p className="text-cyan-400 font-mono mt-1">ID: {linkedGame.in_game_id}</p>
            <div className="mt-3 flex items-center justify-center md:justify-start gap-2">
               <span className="bg-neutral-800 text-neutral-300 text-xs px-3 py-1 rounded-md border border-neutral-700">{gameInfo?.title || "Unknown Game"}</span>
               <span className="bg-fuchsia-900/30 text-fuchsia-400 text-xs px-3 py-1 rounded-md border border-fuchsia-500/30">Player</span>
            </div>
          </div>
        </div>

        {/* MODE TABS */}
        <div className="bg-neutral-900 p-2 rounded-2xl border border-neutral-800 flex overflow-x-auto custom-scrollbar gap-2">
          {gameModes.map((mode: string) => (
            <button 
              key={mode} onClick={() => { setActiveMode(mode); setSearchQuery(""); }}
              className={`px-5 py-3 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                activeMode === mode ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20" : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* STATS GRID */}
        <motion.div key={activeMode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 text-center shadow-lg"><p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Matches</p><p className="text-3xl font-black text-white">{modeStats.matches_played}</p></div>
          <div className="bg-neutral-900 rounded-2xl p-5 border border-yellow-500/30 text-center shadow-[inset_0_0_30px_rgba(234,179,8,0.05)]"><p className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-2 flex items-center justify-center gap-1"><Trophy className="w-3 h-3"/> Wins</p><p className="text-3xl font-black text-yellow-400">{modeStats.wins}</p></div>
          <div className="bg-neutral-900 rounded-2xl p-5 border border-emerald-500/30 text-center shadow-[inset_0_0_30px_rgba(16,185,129,0.05)]"><p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 flex items-center justify-center gap-1"><Target className="w-3 h-3"/> K/D/A</p><p className="text-xl font-black mt-1"><span className="text-emerald-400">{modeStats.kills}</span>/<span className="text-red-400">{modeStats.deaths}</span>/<span className="text-yellow-400">{modeStats.assists}</span></p></div>
          <div className="bg-neutral-900 rounded-2xl p-5 border border-fuchsia-500/30 text-center shadow-[inset_0_0_30px_rgba(217,70,239,0.05)]"><p className="text-xs font-bold text-fuchsia-500 uppercase tracking-wider mb-2">Damage</p><p className="text-3xl font-black text-fuchsia-400">{modeStats.damage}</p></div>
        </motion.div>

        {/* MATCH HISTORY LIST */}
        <div className="space-y-4 pt-4">
          {/* 🔥 NEW: History Header with Search Bar 🔥 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LineChart className="w-5 h-5 text-cyan-400"/> Match History ({activeMode})
            </h2>
            
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search Title or ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
          
          <AnimatePresence>
            {searchedHistory.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-neutral-900/50 border border-neutral-800 border-dashed rounded-3xl">
                <Skull className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-neutral-400 mb-1">No Matches Found</h3>
                <p className="text-neutral-500 text-sm">
                  {searchQuery ? "No matches match your search." : `Play a ${activeMode} match to see it here.`}
                </p>
              </motion.div>
            ) : (
              searchedHistory.map((match) => {
                const cleanString = (str: string) => (str || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                const cleanLgName = cleanString(linkedGame.in_game_name);
                
                let myKills = 0, myDamage = 0, isWinner = false;
                
                if (match.ai_stats) {
                  const aiWinner = cleanString(match.ai_stats.winner);
                  if (aiWinner && (aiWinner === cleanLgName || aiWinner.includes(cleanLgName) || cleanLgName.includes(aiWinner))) isWinner = true;

                  if (match.ai_stats.players) {
                    const me = match.ai_stats.players.find((p: any) => {
                      if (!p.name) return false;
                      const aiName = cleanString(p.name);
                      return aiName === cleanLgName || aiName.includes(cleanLgName) || cleanLgName.includes(aiName);
                    });
                    if (me) {
                      myKills = Number(me.kills || me.score || 0);
                      myDamage = Number(me.damage || 0);
                    }
                  }
                }

                return (
                  <Link key={match.id} to={`/tournaments/${match.id}`}>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-neutral-900 border transition-all rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 group hover:-translate-y-1 hover:shadow-xl ${isWinner ? 'border-yellow-500/40 shadow-yellow-500/5' : 'border-neutral-800 hover:border-cyan-500/40'}`}>
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${isWinner ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-800 text-neutral-400'}`}>
                          {isWinner ? "W" : "L"}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-white group-hover:text-cyan-400 transition-colors line-clamp-1">{match.title}</h4>
                          <p className="text-xs text-neutral-400 mt-1">{new Date(match.date).toLocaleDateString()} • {match.mode || "Unranked"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 w-full md:w-auto bg-neutral-950 px-5 py-3 rounded-xl border border-neutral-800">
                        <div className="text-center"><p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Kills</p><p className="font-black text-white text-lg">{myKills}</p></div>
                        <div className="w-px h-8 bg-neutral-800" />
                        <div className="text-center"><p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Damage</p><p className="font-black text-white text-lg">{myDamage}</p></div>
                        <ChevronLeft className="w-5 h-5 text-neutral-600 group-hover:text-cyan-400 rotate-180 ml-2" />
                      </div>
                    </motion.div>
                  </Link>
                );
              })
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}