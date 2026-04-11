import { useState, useEffect } from "react";
import { motion } from "framer-motion"; 
import { Link } from "react-router-dom"; 
import { ArrowRight, Trophy, Users, MonitorPlay, Zap, Search, UserPlus, Loader2 } from "lucide-react";
import { type Tournament, fetchTournaments, searchPlayers, sendFriendRequest } from "../data"; 
import { TournamentCard } from "../components/TournamentCard";
import { supabase } from "../../utils/supabase"; 
import { useAuth } from "../context/AuthContext";

export function Home() {
  const { session } = useAuth();
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [platformGames, setPlatformGames] = useState<any[]>([]); 

  // Player Search States
  const [playerSearch, setPlayerSearch] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    // 1. Fetch upcoming tournaments
    fetchTournaments().then(data => {
      setUpcomingTournaments(data.filter((t) => t.status === "upcoming").slice(0, 3));
    }).catch(console.error);

    // 2. Fetch platform games
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .order('created_at', { ascending: false }); 

        if (error) throw error;
        if (data) setPlatformGames(data);
      } catch (err: any) {
        console.error("Failed to fetch games:", err.message);
      }
    };

    fetchGames();
  }, []);

  // Auto-Search Players (Debounced)
  useEffect(() => {
    const delayFn = setTimeout(async () => {
      if (playerSearch.trim().length > 2) {
        setIsSearchingPlayers(true);
        try {
          const results = await searchPlayers(playerSearch);
          // Current user ko hide kar rahe hain
          setPlayers(results.filter((p: any) => p.id !== session?.user?.id));
        } catch(e) {
          console.error(e);
        } finally {
          setIsSearchingPlayers(false);
        }
      } else {
        setPlayers([]);
      }
    }, 500);

    return () => clearTimeout(delayFn);
  }, [playerSearch, session?.user?.id]);

  const handleSendRequest = async (receiverId: string) => {
    if (!session?.user?.id) {
      setActionMsg("❌ Login required to add friends");
      setTimeout(() => setActionMsg(""), 3000);
      return;
    }
    try {
      await sendFriendRequest(session.user.id, receiverId);
      setActionMsg("✅ Friend Request sent!");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err: any) {
      setActionMsg("⚠️ Request already pending");
      setTimeout(() => setActionMsg(""), 3000);
    }
  };

  return (
    <div className="w-full bg-neutral-950 flex flex-col items-center justify-center pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      
      {/* 1. Hero Section */}
      <div className="relative isolate overflow-hidden bg-neutral-950 w-full max-w-7xl mx-auto rounded-3xl lg:flex lg:gap-x-20 lg:px-24 lg:pt-0">
        <svg
          viewBox="0 0 1024 1024"
          className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          aria-hidden="true"
        >
          <circle cx={512} cy={512} r={512} fill="url(#hero-gradient)" fillOpacity="0.3" />
          <defs>
            <radialGradient id="hero-gradient">
              <stop stopColor="#d946ef" />
              <stop offset={1} stopColor="#06b6d4" />
            </radialGradient>
          </defs>
        </svg>

        <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left z-10 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Your Local <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500 uppercase">
                Esports Hub
              </span>
            </h1>
            <p className="mt-4 text-lg leading-8 text-neutral-300 mb-8 font-light">
              Find, join, and host gaming tournaments in your local area. Prove you're the best player in town and win prizes.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
              <Link to="/tournaments" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-sm hover:bg-neutral-200 transition-all transform hover:scale-105 active:scale-95">
                Find Tournaments
              </Link>
              <Link to="/host" className="text-sm font-semibold leading-6 text-white group flex items-center hover:text-fuchsia-400 transition-colors">
                Host Event <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="relative mt-16 h-80 lg:mt-8 z-10 hidden lg:block lg:w-[48rem]">
           <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="absolute left-0 top-0 w-full max-w-none rounded-xl bg-white/5 ring-1 ring-white/10 shadow-2xl object-cover h-[400px]"
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1080"
            alt="Esports Arena"
          />
        </div>
      </div>

      {/* 2. 🔥 NEW: PLAYER SEARCH SECTION 🔥 */}
      <div className="w-full max-w-7xl mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-center">
            
            {/* Left: Title & Search Input */}
            <div className="flex-1 w-full">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" />
                Find Players & Connect
              </h2>
              <p className="text-neutral-400 mb-6 text-sm sm:text-base">Search by name or Friend Code to view profiles and start connecting.</p>

              <div className="relative max-w-md w-full">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Enter name or Friend Code..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              
              {actionMsg && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm font-bold text-cyan-400 bg-cyan-500/10 inline-block px-3 py-1 rounded-md border border-cyan-500/20">
                  {actionMsg}
                </motion.p>
              )}
            </div>

            {/* Right: Results Box */}
            <div className="flex-1 w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 min-h-[220px] max-h-[280px] overflow-y-auto custom-scrollbar shadow-inner">
              {isSearchingPlayers ? (
                <div className="flex justify-center items-center h-full min-h-[180px]">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                </div>
              ) : players.length > 0 ? (
                <div className="space-y-3">
                  {players.map((p) => (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={p.id}>
                      <Link 
                        to={`/player/${p.id}`} 
                        className="flex items-center justify-between bg-neutral-900 p-3 rounded-xl border border-neutral-800 hover:border-cyan-500/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img src={p.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="avatar" className="w-10 h-10 rounded-full border border-neutral-700 shrink-0" />
                          <div>
                            <span className="font-bold text-white text-sm sm:text-base truncate block group-hover:text-cyan-400 transition-colors">{p.display_name}</span>
                            <span className="text-[10px] text-neutral-500 truncate block">Click to view profile</span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            handleSendRequest(p.id); 
                          }} 
                          className="bg-neutral-800 hover:bg-cyan-600 text-cyan-400 hover:text-white p-2.5 rounded-lg transition-colors border border-cyan-500/30 shrink-0 relative z-10"
                        >
                          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : playerSearch.length > 2 ? (
                <div className="flex justify-center items-center h-full min-h-[180px] text-neutral-500 text-sm font-medium">No results for "{playerSearch}"</div>
              ) : (
                <div className="flex flex-col justify-center items-center h-full min-h-[180px] text-neutral-600 text-center">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <span className="text-sm italic">Enter at least 3 letters or a Friend Code...</span>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>

      {/* 3. Features Section */}
      <div className="mx-auto mt-24 max-w-7xl px-6 sm:mt-32 lg:px-8 border-t border-neutral-900 pt-16">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-fuchsia-500 uppercase tracking-widest">Compete</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need to grow</p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-3">
            {[
              { name: 'Find Matches', description: 'Discover local tournaments for your favorite games.', icon: MonitorPlay },
              { name: 'Host Events', description: 'Easily set up and manage your own tournaments.', icon: Trophy },
              { name: 'Connect & Play', description: 'Build your squad and reputation in the community.', icon: Users },
            ].map((feature) => (
              <motion.div key={feature.name} className="flex flex-col items-center text-center p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 ring-1 ring-white/10">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <dt className="text-xl font-bold leading-7 text-white mb-4">{feature.name}</dt>
                <dd className="text-base leading-7 text-neutral-400">{feature.description}</dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>

      {/* 4. Supported Games */}
      <div className="w-full max-w-7xl mt-32 px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white mb-10">Supported Games</h2>
        {platformGames.length === 0 ? (
          <p className="text-neutral-500 text-center py-10 border border-neutral-800 rounded-xl bg-neutral-900/30">No games found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {platformGames.map((game) => (
              <motion.div key={game.id} className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer" whileHover={{ y: -5 }}>
                <img src={game.image_url} alt={game.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                   <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold uppercase text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full">{game.genre}</span>
                   <h3 className="text-2xl font-bold text-white mb-2">{game.title}</h3>
                   <p className="text-neutral-300 text-sm line-clamp-2">{game.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Upcoming Battles Preview */}
      <div className="w-full max-w-7xl mt-32 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10">
          <div>
             <h2 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center">
               <Zap className="w-6 h-6 mr-3 text-fuchsia-500" /> Upcoming Battles
             </h2>
             <p className="text-neutral-400">Join a lobby before spots fill up.</p>
          </div>
          <Link to="/tournaments" className="mt-4 sm:mt-0 text-cyan-400 hover:text-cyan-300 font-medium flex items-center group transition-colors">
            View all tournaments <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {upcomingTournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      </div>
    </div>
  );
}