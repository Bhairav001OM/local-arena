import { type Tournament, GAMES } from "../data";
import { Calendar, Trophy, Lock, Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";

interface TournamentCardProps {
  tournament: Tournament;
  onJoinClick?: () => void;
}

export function TournamentCard({ tournament, onJoinClick }: TournamentCardProps) {
  
  const displayPrize = tournament.prizePool || "Bragging Rights";
  const gameName = tournament.gameName || "Unknown Game"; 

  const getStatusBadge = (status?: string) => {
    const s = status?.toLowerCase() || 'upcoming';
    if (s === 'ongoing' || s === 'live') return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase flex items-center gap-1 w-max"><span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>LIVE</span>;
    if (s === 'completed') return <span className="bg-neutral-800 text-neutral-400 border border-neutral-700 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase">COMPLETED</span>;
    return <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase">UPCOMING</span>;
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 sm:p-4 md:p-6 hover:border-fuchsia-500/50 transition-colors flex flex-col h-full relative overflow-hidden group shadow-md">
      
      {tournament.isPrivate && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] md:text-[10px] font-bold px-2 py-1 md:px-3 md:py-1 rounded-bl-lg flex items-center shadow-lg shadow-red-500/20 z-10">
          <Lock className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1" /> PRIVATE
        </div>
      )}

     <div className="flex justify-between items-start mb-2 gap-1 md:gap-2 mt-2 md:mt-0">
        <h3 className="text-sm sm:text-base md:text-xl font-bold text-white truncate pr-1">{tournament.title}</h3>
        
        {tournament.short_code && (
          <div className="bg-neutral-950 border border-neutral-800 text-cyan-400 text-[9px] md:text-xs font-mono font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded shrink-0 flex items-center shadow-inner">
            <span className="hidden sm:inline text-neutral-500 mr-1 text-[8px] md:text-[10px] uppercase tracking-wider">Code</span>
            {tournament.short_code}
          </div>
        )}
      </div>

      <div className="mb-3 md:mb-4">
        {getStatusBadge(tournament.status)}
      </div>
      
      <div className="flex items-center text-neutral-400 text-xs md:text-sm mb-1.5 md:mb-2">
        <Gamepad2 className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 text-cyan-500 shrink-0" /> 
        <span className="truncate font-bold text-cyan-400 uppercase tracking-tight">{gameName}</span>
      </div>

      <div className="flex items-center text-neutral-400 text-xs md:text-sm mb-1.5 md:mb-2">
        <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 text-neutral-500 shrink-0" /> 
        <span className="truncate">{new Date(tournament.date).toLocaleDateString()}</span>
      </div>
      
      <div className="flex items-center text-neutral-400 text-xs md:text-sm mb-4 md:mb-6">
        <Trophy className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 text-fuchsia-500 shrink-0" /> 
        <span className="truncate font-bold text-fuchsia-400">{displayPrize}</span>
      </div>
      
      <div className="mt-auto flex flex-col sm:flex-row gap-2 md:gap-3">
        <Link 
          to={`/tournaments/${tournament.id}`} 
          className="flex-1 py-1.5 md:py-2.5 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-xs md:text-sm font-semibold"
        >
          Details
        </Link>
        
        <button 
          onClick={onJoinClick}
          className="flex-1 py-1.5 md:py-2.5 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white rounded-lg transition-all text-xs md:text-sm font-bold shadow-lg shadow-fuchsia-500/20"
        >
          Join
        </button>
      </div>
    </div>
  );
}