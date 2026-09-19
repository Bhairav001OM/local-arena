import { useState, useEffect } from "react";
import { motion } from "framer-motion"; 
import { Link } from "react-router-dom"; 
import { ArrowRight, Trophy, Users, MonitorPlay, Zap, Search, UserPlus, Loader2, MapPin, Navigation, CalendarDays, Clock3, Star, Gamepad2, CheckCircle2, Bot, Sparkles } from "lucide-react";
import { type Tournament, fetchTournaments, searchPlayers, sendFriendRequest } from "../data"; 
import { TournamentCard } from "../components/TournamentCard";
import { supabase } from "../../utils/supabase"; 
import { useAuth } from "../context/AuthContext";

type TournamentPlan = {
  summary: string;
  checklist: string[];
  schedule: string[];
  risks: string[];
  nextAction: string;
};

const ARENAS = [
  { id: 1, name: "Pixel District Gaming Lounge", area: "Andheri West", distance: "1.2 km", rating: "4.9", price: "₹120/hr", image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=900", tags: ["PC", "PS5", "24/7"], slots: 8 },
  { id: 2, name: "The Respawn Room", area: "Powai", distance: "3.8 km", rating: "4.8", price: "₹150/hr", image: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&q=80&w=900", tags: ["PC", "Sim Racing"], slots: 4 },
  { id: 3, name: "Game On Arena", area: "Bandra East", distance: "5.1 km", rating: "4.7", price: "₹100/hr", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=900", tags: ["PC", "Console"], slots: 6 },
];

export function Home() {
  const { session } = useAuth();
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [platformGames, setPlatformGames] = useState<any[]>([]); 

  // Player Search States
  const [playerSearch, setPlayerSearch] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedArena, setSelectedArena] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("6:00 PM");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [activeArenaFilter, setActiveArenaFilter] = useState("Near me");
  const [agentForm, setAgentForm] = useState({ game: "Valorant", entries: "100", format: "32-player knockout", city: "Mumbai", prizePool: "₹50,000" });
  const [agentPlan, setAgentPlan] = useState<TournamentPlan | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState("");

  const runTournamentTeammate = async () => {
    setAgentBusy(true);
    setAgentError("");
    try {
      const response = await fetch("/api/tournament-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...agentForm, entries: Number(agentForm.entries) }) });
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The teammate could not create a plan.");
        setAgentPlan(data.plan as TournamentPlan);
        return;
      }

      // Vite previews do not run Vercel functions, so keep the planning flow useful locally.
      const entries = Number(agentForm.entries);
      setAgentPlan({
        summary: `Run a ${agentForm.format} ${agentForm.game} tournament for ${entries} paid entries in ${agentForm.city}.`,
        checklist: [
          `Publish the event page and collect ${entries} registrations with a verified Riot ID.`,
          "Lock the 32-player bracket, check-in window, and substitute policy.",
          `Confirm arena capacity, admins, match servers, and the ${agentForm.prizePool || "prize pool"} payout rules.`,
          "Send match-room links, report results, and escalate disputes to the tournament admin."
        ],
        schedule: ["T-7 days: open registrations and announce rules", "T-1 day: seed bracket and verify check-ins", "Event day: check-in, run rounds, publish results and payouts"],
        risks: ["Late check-ins or no-shows", "Unverified player identities", "Match disputes and payout delays"],
        nextAction: "Open the event workspace, confirm the rules, then publish registrations when the server-side teammate is enabled."
      });
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setAgentBusy(false);
    }
  };

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

      {/* 3. Nearby Arena Finder */}
      <section className="w-full max-w-7xl mt-20 sm:mt-28 px-4 sm:px-6 lg:px-8" aria-labelledby="arena-heading">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-400 mb-3">Play in person</p>
            <h2 id="arena-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Find your arena</h2>
            <p className="text-neutral-400 mt-3 max-w-xl">Discover trusted gaming lounges nearby, check live availability, and reserve your setup before you arrive.</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 self-start rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20 transition-colors">
            <Navigation className="w-4 h-4" /> Use my location
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3" role="list" aria-label="Arena filters">
          {['Near me', 'PC gaming', 'Console', 'Open now'].map((filter) => (
            <button key={filter} type="button" onClick={() => setActiveArenaFilter(filter)} aria-pressed={activeArenaFilter === filter} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeArenaFilter === filter ? 'bg-white text-black' : 'border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-600'}`}>
              {filter}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {ARENAS.map((arena) => (
            <motion.article key={arena.id} className="group overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70 shadow-xl" whileHover={{ y: -4 }}>
              <div className="relative h-44 overflow-hidden">
                <img src={arena.image} alt={`${arena.name} gaming setup`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30"><span className="size-1.5 rounded-full bg-emerald-300" /> Open now</span>
                <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 text-sm text-white"><MapPin className="w-4 h-4 text-cyan-300" /> {arena.distance} away</span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-lg font-bold text-white">{arena.name}</h3><p className="mt-1 text-sm text-neutral-500">{arena.area}</p></div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-300"><Star className="w-4 h-4 fill-current" /> {arena.rating}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{arena.tags.map((tag) => <span key={tag} className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-400">{tag}</span>)}</div>
                <div className="mt-5 flex items-center justify-between border-t border-neutral-800 pt-4 text-sm"><span className="text-neutral-400"><strong className="text-white">{arena.price}</strong> onwards</span><span className="text-cyan-300">{arena.slots} slots left</span></div>
                <button type="button" onClick={() => { setSelectedArena(arena.id); setSelectedSlot("6:00 PM"); setBookingConfirmed(false); }} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-cyan-300 transition-colors">View slots & book</button>
              </div>
            </motion.article>
          ))}
        </div>

        {selectedArena && (
          <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 sm:p-6" role="dialog" aria-label="Book arena slot">
            {bookingConfirmed ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><CheckCircle2 className="w-7 h-7 text-emerald-300" /><div><p className="font-bold text-white">Slot held for your squad.</p><p className="text-sm text-neutral-300">{selectedSlot} is reserved in this demo. Share the arena with your squad and get playing.</p></div></div>
            ) : (
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Quick booking</p><h3 className="mt-1 text-xl font-bold text-white">Reserve a 2-hour gaming session</h3><div className="mt-3 flex flex-wrap gap-2" aria-label="Available time slots">{["4:00 PM", "6:00 PM", "8:00 PM"].map((slot) => <button key={slot} type="button" onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot === slot} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${selectedSlot === slot ? "border-cyan-300 bg-cyan-300 text-neutral-950" : "border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-cyan-400"}`}><Clock3 className="mr-1 inline h-4 w-4" />{slot}</button>)}</div><div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-300"><span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-cyan-300" /> Today</span><span className="inline-flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-cyan-300" /> 1 setup</span></div></div><button type="button" onClick={() => setBookingConfirmed(true)} className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-neutral-950 hover:bg-white transition-colors">Confirm {selectedSlot}</button></div>
            )}
          </div>
        )}
      </section>

      {/* 4. Autonomous tournament teammate */}
      <section className="w-full max-w-7xl mt-20 sm:mt-28 px-4 sm:px-6 lg:px-8" aria-labelledby="teammate-heading">
        <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 via-neutral-900 to-fuchsia-950/30 p-6 sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300"><Bot className="h-4 w-4" /> Autonomous teammate</p>
              <h2 id="teammate-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Plan your tournament with AI.</h2>
              <p className="mt-3 text-neutral-300">Describe your event and get an operations plan for entries, brackets, venue timing, and community readiness. Your teammate prepares the plan; you approve every real-world action.</p>
            </div>
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {([['game', 'Game'], ['entries', 'Entries'], ['format', 'Format'], ['city', 'City'], ['prizePool', 'Prize pool']] as const).map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}
                    <input value={agentForm[key]} onChange={(event) => setAgentForm({ ...agentForm, [key]: event.target.value })} className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-white outline-none transition-colors focus:border-cyan-400" />
                  </label>
                ))}
              </div>
              <button type="button" onClick={runTournamentTeammate} disabled={agentBusy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-neutral-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"><Sparkles className="h-4 w-4" />{agentBusy ? 'Building tournament plan…' : 'Build autonomous plan'}</button>
              {agentError && <p className="mt-3 text-sm text-rose-300">{agentError}</p>}
              {agentPlan && (
    <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-cyan-400/20 bg-neutral-950 p-4 text-left text-sm text-cyan-100">
      <p className="text-base font-semibold leading-6 text-white">{agentPlan.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          ["Execution checklist", agentPlan.checklist],
          ["Schedule", agentPlan.schedule],
          ["Risks to manage", agentPlan.risks],
        ].map(([heading, items]) => (
          <div key={heading}>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">{heading}</h3>
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-5 text-neutral-300">
              {(items as string[]).map((item) => <li key={item} className="flex gap-2"><span className="text-cyan-400">•</span><span>{item}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/5 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-300">Next action</p>
        <p className="mt-1 text-xs leading-5 text-neutral-200">{agentPlan.nextAction}</p>
      </div>
    </div>
  )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Community hub */}
      <section className="w-full max-w-7xl mt-20 sm:mt-28 px-4 sm:px-6 lg:px-8" aria-labelledby="community-heading">
        <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/30 via-neutral-900 to-cyan-950/20 p-6 sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-fuchsia-300">India&apos;s gaming community</p><h2 id="community-heading" className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Meet your next squad.</h2><p className="mt-3 max-w-2xl text-neutral-300">Connect with local players, join open events, or give your community a place to compete. Local Arena brings online players and offline arenas together.</p></div>
            <Link to="/host" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-neutral-950 transition-colors hover:bg-cyan-300">Host a community event <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[{ label: "Players online", value: "12.8K", icon: Users }, { label: "Events this week", value: "86", icon: Trophy }, { label: "Arenas across India", value: "240+", icon: MapPin }].map((stat) => <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/20 p-4"><stat.icon className="h-5 w-5 text-cyan-300" /><p className="mt-4 text-2xl font-bold text-white">{stat.value}</p><p className="mt-1 text-sm text-neutral-400">{stat.label}</p></div>)}
          </div>
        </div>
      </section>

      {/* 5. Features Section */}
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
