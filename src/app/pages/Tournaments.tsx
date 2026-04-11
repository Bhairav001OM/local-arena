import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Lock, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { type Tournament, type TournamentStatus, fetchTournaments, joinTournament } from "../../app/data"; 
import { TournamentCard } from "../components/TournamentCard";
import { useAuth } from "../context/AuthContext";

export function Tournaments() {
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">("all");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState("");

  useEffect(() => {
    fetchTournaments()
      .then(setTournaments)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (t.title?.toLowerCase() || "").includes(searchLower) || 
        (t.location?.toLowerCase() || "").includes(searchLower) ||
        (t.short_code?.toLowerCase() || "").includes(searchLower);
        
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchTerm, statusFilter]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      setJoinError("You must be logged in to join a tournament.");
      return;
    }
    if (!selectedTournament) return;

    setIsJoining(true);
    setJoinError("");

    try {
      await joinTournament(selectedTournament.id, session.user.id, joinPassword);
      setJoinSuccess("Successfully joined the tournament!");
      
      setTimeout(() => {
        setSelectedTournament(null);
        setJoinSuccess("");
        setJoinPassword("");
      }, 2000);
    } catch (err: any) {
      setJoinError(err.message || "Failed to join tournament.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-2 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-8 md:mb-12 px-2 sm:px-0">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3 md:mb-4">
            Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">Tournaments</span>
          </h1>
          <p className="text-sm md:text-xl text-neutral-400 max-w-2xl">
            Find the perfect competition for your skill level. Browse upcoming events, check ongoing brackets, or view past results.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-8 md:mb-10 items-center justify-between bg-neutral-900/50 p-3 md:p-4 rounded-2xl border border-neutral-800 mx-2 sm:mx-0">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 md:h-5 md:w-5 text-neutral-500" />
            </div>
            <input
              type="text"
              placeholder="Search name, location, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 md:pl-10 pr-3 py-2.5 md:py-3 border border-neutral-700 rounded-xl leading-5 bg-neutral-950 text-neutral-300 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition-colors text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <Filter className="h-4 w-4 md:h-5 md:w-5 text-neutral-500 mr-1 md:mr-2 shrink-0" />
            {(["all", "upcoming", "ongoing", "completed"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium capitalize whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? "bg-white text-black shadow-md shadow-white/10"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* 🔥 MOBILE PAR 2 CARDS IN A ROW 🔥 */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-t-2 border-b-2 border-fuchsia-500"></div>
          </div>
        ) : filteredTournaments.length > 0 ? (
          <motion.div 
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 px-2 sm:px-0"
            layout
          >
            <AnimatePresence>
              {filteredTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }} // ✨ Cascade Animation ✨
                >
                  <TournamentCard 
                    tournament={tournament} 
                    onJoinClick={() => setSelectedTournament(tournament)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center py-16 md:py-20 bg-neutral-900/30 rounded-3xl border border-neutral-800 border-dashed mx-2 sm:mx-0">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full bg-neutral-800 mb-4">
              <Search className="h-6 w-6 md:h-8 md:w-8 text-neutral-500" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">No tournaments found</h3>
            <p className="text-sm md:text-base text-neutral-400 px-4">
              We couldn't find any tournaments matching your current filters.
            </p>
            <button 
              onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
              className="mt-6 px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition-colors text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* JOIN MODAL */}
      <AnimatePresence>
        {selectedTournament && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => { setSelectedTournament(null); setJoinError(""); setJoinPassword(""); }}
                className="absolute top-4 right-4 md:top-6 md:right-6 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Join Lobby</h3>
              <p className="text-sm md:text-base text-neutral-400 mb-6 md:mb-8">
                You are entering <span className="text-fuchsia-400 font-semibold">{selectedTournament.title}</span>
              </p>

              {joinSuccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl text-center text-sm md:text-base font-medium flex items-center justify-center gap-2">
                  {joinSuccess}
                </div>
              ) : (
                <form onSubmit={handleJoinSubmit} className="space-y-4 md:space-y-6">
                  {(selectedTournament.isPrivate || (selectedTournament as any).is_private) && (
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
                        <Lock className="w-3 h-3 md:w-4 md:h-4 text-fuchsia-500" /> Entry Password Required
                      </label>
                      <input
                        type="text"
                        required
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 md:py-3 text-sm md:text-base text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                        placeholder="Enter secret password..."
                      />
                    </div>
                  )}

                  {joinError && (
                    <p className="text-xs md:text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{joinError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white font-bold py-3 md:py-4 rounded-xl transition-all shadow-lg shadow-fuchsia-500/20 flex justify-center items-center gap-2 text-sm md:text-base"
                  >
                    {isJoining ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : "Confirm Join"}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}