import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, ChevronRight, Gamepad2, Loader2, AlertCircle, 
  Swords, Users, Search, X, Calendar, Clock, MapPin, Trophy, Shield, ChevronDown
} from "lucide-react";
import { Link } from "react-router-dom";
import { createTournament } from "../data"; 
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase";

type HostFormInputs = {
  title: string;
  gameId: string;
  mode: string;       
  teamSize: string;   
  date: string;
  time: string;
  location: string;
  maxPlayers: number;
  prizePool: string;
  rules: string;
  isPrivate: boolean; 
  password?: string;  
};

export function HostTournament() {
  const { session, signInWithGoogle } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Custom Dropdown State
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [gameSearchQuery, setGameSearchQuery] = useState("");
  const [platformGames, setPlatformGames] = useState<any[]>([]);
  
  // We need 'setValue' to programmatically update the hidden gameId input
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset, clearErrors } = useForm<HostFormInputs>({
    defaultValues: { isPrivate: false }
  });

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase.from('games').select('*').order('title', { ascending: true });
        if (error) throw error;
        if (data) setPlatformGames(data);
      } catch (err: any) {
        console.error("Failed to load games:", err.message);
      }
    };
    fetchGames();
  }, []);

  const isPrivate = watch("isPrivate");
  const watchedGameId = watch("gameId");
  const selectedGame = platformGames.find(g => g.id === watchedGameId);

  // Filter games based on the search bar
  const filteredGames = platformGames.filter(game => 
    game.title.toLowerCase().includes(gameSearchQuery.toLowerCase())
  );

  const handleGameSelect = (gameId: string) => {
    setValue("gameId", gameId, { shouldValidate: true });
    // Reset mode/team when game changes
    setValue("mode", "");
    setValue("teamSize", "");
    setIsGameMenuOpen(false);
    setGameSearchQuery("");
  };

  const onSubmit: SubmitHandler<HostFormInputs> = async (data) => {
    if (!session?.access_token) return;
    try {
      setIsSubmitting(true);
      setErrorMsg("");
      await createTournament(data, session.access_token, session.user.id);
      setIsSubmitted(true);
      reset();
    } catch (error) {
      setErrorMsg("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
        <Gamepad2 className="w-20 h-20 text-fuchsia-500 mb-6" />
        <h2 className="text-3xl font-bold text-white mb-4 text-center">Login Required</h2>
        <p className="text-neutral-400 mb-8 max-w-md text-center">
          You must be logged in to host a tournament. Create an account to organize your own local esports events.
        </p>
        <button onClick={signInWithGoogle} className="bg-white text-neutral-900 px-6 py-3 rounded-lg font-bold hover:bg-neutral-200 transition-colors">
          Login with Google
        </button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 py-20">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Tournament Created!</h2>
          <p className="text-neutral-400 mb-8">Your event is live! Get ready for battle.</p>
          <button onClick={() => setIsSubmitted(false)} className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors">
            Create Another Event
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-fuchsia-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Host an <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">Event</span>
          </h1>
          <p className="text-lg text-neutral-400">Build your local esports community.</p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* THE NEW COLUMN LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* ================= LEFT COLUMN ================= */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* BLOCK 1: Core Details */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                  <div className="p-2 bg-fuchsia-500/20 rounded-lg"><Gamepad2 className="w-5 h-5 text-fuchsia-400" /></div>
                  <h3 className="text-2xl font-bold text-white">Event Basics</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Tournament Name <span className="text-fuchsia-500">*</span></label>
                    <input
                      {...register("title", { required: "Name is required" })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none"
                      placeholder="e.g., Summer Smash Local"
                    />
                    {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title.message}</p>}
                  </div>

                  {/* CUSTOM SEARCHABLE GAME DROPDOWN */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Select Game <span className="text-fuchsia-500">*</span></label>
                    
                    {/* Hidden input to register with react-hook-form */}
                    <input type="hidden" {...register("gameId", { required: "Please select a game" })} />
                    
                    {/* Fake Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
                      className="w-full flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-left focus:ring-2 focus:ring-fuchsia-500 transition-all hover:border-neutral-600"
                    >
                      {selectedGame ? (
                        <span className="flex items-center text-white font-medium">
                           {selectedGame.image_url && <img src={selectedGame.image_url} alt="game" className="w-6 h-6 rounded object-cover mr-3" />}
                           {selectedGame.title}
                        </span>
                      ) : (
                        <span className="text-neutral-500">Search and select a game...</span>
                      )}
                      <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform ${isGameMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* The Search Popover Menu */}
                    <AnimatePresence>
                      {isGameMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsGameMenuOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                          >
                            <div className="p-3 border-b border-neutral-800 relative">
                              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search games..."
                                value={gameSearchQuery}
                                onChange={(e) => setGameSearchQuery(e.target.value)}
                                className="w-full bg-neutral-950 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-fuchsia-500 border border-neutral-800"
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                              {filteredGames.length === 0 ? (
                                <p className="text-center text-neutral-500 py-4 text-sm">No games found.</p>
                              ) : (
                                filteredGames.map((game) => (
                                  <div 
                                    key={game.id} 
                                    onClick={() => handleGameSelect(game.id)}
                                    className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors"
                                  >
                                    {game.image_url ? (
                                      <img src={game.image_url} alt={game.title} className="w-10 h-10 rounded-md object-cover mr-3" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-md bg-neutral-800 flex items-center justify-center mr-3"><Gamepad2 className="w-5 h-5 text-neutral-500"/></div>
                                    )}
                                    <span className="text-white text-sm font-medium">{game.title}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                    {errors.gameId && <p className="mt-1 text-sm text-red-400">{errors.gameId.message}</p>}
                  </div>

                  {/* Dynamic Options based on Selected Game */}
                  {selectedGame && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
                      {selectedGame.official_modes && selectedGame.official_modes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-fuchsia-400 mb-2">Game Mode <span className="text-fuchsia-500">*</span></label>
                          <div className="relative">
                            <select {...register("mode", { required: "Select mode" })} className="w-full appearance-none bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 transition-all">
                              <option value="">Select mode...</option>
                              {selectedGame.official_modes.map((mode: string, idx: number) => <option key={idx} value={mode}>{mode}</option>)}
                            </select>
                            <Swords className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                          </div>
                          {errors.mode && <p className="mt-1 text-sm text-red-400">{errors.mode.message}</p>}
                        </div>
                      )}
                      {selectedGame.team_sizes && selectedGame.team_sizes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-fuchsia-400 mb-2">Team Size <span className="text-fuchsia-500">*</span></label>
                          <div className="relative">
                            <select {...register("teamSize", { required: "Select team size" })} className="w-full appearance-none bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 transition-all">
                              <option value="">Select size...</option>
                              {selectedGame.team_sizes.map((size: string, idx: number) => <option key={idx} value={size}>{size}</option>)}
                            </select>
                            <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                          </div>
                          {errors.teamSize && <p className="mt-1 text-sm text-red-400">{errors.teamSize.message}</p>}
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Max Players / Teams <span className="text-fuchsia-500">*</span></label>
                    <input type="number" {...register("maxPlayers", { required: "Required", min: 2 })} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-fuchsia-500 transition-all outline-none" placeholder="e.g., 32" />
                    {errors.maxPlayers && <p className="mt-1 text-sm text-red-400">Must be at least 2</p>}
                  </div>
                </div>
              </motion.div>

              {/* BLOCK 2: Rules (Now grouped with basics) */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                  <div className="p-2 bg-neutral-800 rounded-lg"><Trophy className="w-5 h-5 text-neutral-400" /></div>
                  <h3 className="text-2xl font-bold text-white">Rules & Prizes</h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Prize Pool <span className="text-neutral-500 font-normal">(Optional)</span></label>
                    <input {...register("prizePool")} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 transition-all outline-none" placeholder="e.g., $500 or Hardware Prizes" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Rules & Format</label>
                    <textarea rows={4} {...register("rules")} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 transition-all outline-none resize-y" placeholder="Describe format, check-in time, specific rules..." />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* BLOCK 3: Logistics */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8">
                 <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                  <div className="p-2 bg-cyan-500/20 rounded-lg"><MapPin className="w-5 h-5 text-cyan-400" /></div>
                  <h3 className="text-2xl font-bold text-white">Logistics</h3>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-500"/> Date <span className="text-cyan-500">*</span></label>
                    <input type="date" {...register("date", { required: "Date is required" })} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 transition-all [color-scheme:dark] outline-none" />
                    {errors.date && <p className="mt-1 text-sm text-red-400">{errors.date.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-500"/> Start Time <span className="text-cyan-500">*</span></label>
                    <input type="time" {...register("time", { required: "Time is required" })} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 transition-all [color-scheme:dark] outline-none" />
                    {errors.time && <p className="mt-1 text-sm text-red-400">{errors.time.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Venue / Location <span className="text-cyan-500">*</span></label>
                    <input {...register("location", { required: "Location required" })} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 transition-all outline-none" placeholder="e.g., Cyber Cafe or Discord Link" />
                    {errors.location && <p className="mt-1 text-sm text-red-400">{errors.location.message}</p>}
                  </div>
                </div>
              </motion.div>

              {/* BLOCK 4: Privacy & Security */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8">
                 <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg"><Shield className="w-5 h-5 text-yellow-400" /></div>
                  <h3 className="text-2xl font-bold text-white">Security</h3>
                </div>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3 cursor-pointer p-4 bg-neutral-950/50 border border-neutral-800 rounded-xl hover:bg-neutral-900 transition-colors">
                    <input type="checkbox" {...register("isPrivate")} className="w-5 h-5 accent-yellow-500 bg-neutral-950 border-neutral-700 rounded cursor-pointer" />
                    <span className="text-white font-medium">Make this tournament Private</span>
                  </label>
                  {isPrivate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-yellow-400 mb-2">Entry Password <span className="text-yellow-500">*</span></label>
                        <input type="text" {...register("password", { required: isPrivate ? "Required" : false })} className="w-full bg-neutral-950 border border-yellow-500/50 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all" placeholder="Secret password..." />
                        {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>}
                        <p className="text-xs text-neutral-500 mt-2">Required for players to join.</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* SUBMIT BUTTON */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full group relative flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-bold text-xl px-8 py-5 rounded-2xl hover:from-fuchsia-500 hover:to-cyan-500 transition-all shadow-[0_0_30px_rgba(217,70,239,0.3)] overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center">
                    {isSubmitting ? (
                      <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Publishing...</>
                    ) : (
                      <>Publish Tournament <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </span>
                  {!isSubmitting && <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out" />}
                </button>
              </motion.div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}