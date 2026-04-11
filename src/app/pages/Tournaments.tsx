import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Lock, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 
import { type Tournament, type TournamentStatus, fetchTournaments, joinTournament } from "../../app/data"; // Make sure path matches
import { TournamentCard } from "../components/TournamentCard";
import { useAuth } from "../context/AuthContext";

export function Tournaments() {
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">("all");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
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

  // 🔥 THE FIX: Added 'tournaments' to the dependency array, plus Room Code search! 🔥
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      const searchLower = searchTerm.toLowerCase();
      
      // Upgraded Search: Now checks Title, Location, AND the new Room Code!
      const matchesSearch = 
        (t.title?.toLowerCase() || "").includes(searchLower) || 
        (t.location?.toLowerCase() || "").includes(searchLower) ||
        (t.short_code?.toLowerCase() || "").includes(searchLower);
        
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchTerm, statusFilter]); // <-- The missing dependency is now here!

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
    <div className="min-h-screen bg-neutral-950 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">Tournaments</span>
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl">
            Find the perfect competition for your skill level. Browse upcoming events, check ongoing brackets, or view past results.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 items-center justify-between bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-500" />
            </div>
            <input
              type="text"
              placeholder="Search by name, location, or Room Code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-neutral-700 rounded-xl leading-5 bg-neutral-950 text-neutral-300 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition-colors sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Filter className="h-5 w-5 text-neutral-500 mr-2 shrink-0" />
            {(["all", "upcoming", "ongoing", "completed"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-all ${
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

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-fuchsia-500"></div>
          </div>
        ) : filteredTournaments.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            layout
          >
            <AnimatePresence>
              {filteredTournaments.map((tournament) => (
                <motion.div
                  key={tournament.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
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
          <div className="text-center py-20 bg-neutral-900/30 rounded-3xl border border-neutral-800 border-dashed">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-800 mb-4">
              <Search className="h-8 w-8 text-neutral-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No tournaments found</h3>
            <p className="text-neutral-400">
              We couldn't find any tournaments matching your current filters. Try adjusting your search.
            </p>
            <button 
              onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
              className="mt-6 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full transition-colors font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* The Join Modal overlay */}
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
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => { setSelectedTournament(null); setJoinError(""); setJoinPassword(""); }}
                className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-3xl font-bold text-white mb-2">Join Lobby</h3>
              <p className="text-neutral-400 mb-8">
                You are entering <span className="text-fuchsia-400 font-semibold">{selectedTournament.title}</span>
              </p>

              {joinSuccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-4 rounded-xl text-center font-medium flex items-center justify-center gap-2">
                  {joinSuccess}
                </div>
              ) : (
                <form onSubmit={handleJoinSubmit} className="space-y-6">
                  {/* 🔥 FIX: Checks both isPrivate and is_private 🔥 */}
                  {(selectedTournament.isPrivate || (selectedTournament as any).is_private) && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-fuchsia-500" /> Entry Password Required
                      </label>
                      <input
                        type="text"
                        required
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                        placeholder="Enter the host's secret password..."
                      />
                    </div>
                  )}

                  {joinError && (
                    <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{joinError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-fuchsia-500/20 flex justify-center items-center gap-2"
                  >
                    {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Join"}
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