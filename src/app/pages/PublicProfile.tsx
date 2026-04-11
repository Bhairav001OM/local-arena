import { useEffect, useState } from "react";
import { useParams,  useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, fetchFullUserProfile, sendFriendRequest, type EnhancedUserProfile } from "../data"; 
import { Gamepad2, Loader2,  UserPlus, MessageSquare, Check, Copy, Flag } from "lucide-react";
import { supabase } from "../../utils/supabase";

// 🔥 FIX: Removed 'export'
const generateFriendCode = (uuid: string) => {
  if (!uuid) return "";
  return parseInt(uuid.split('-')[0], 16).toString().padStart(10, '0');
};

export function PublicProfile() {
  const { id } = useParams<{ id: string }>(); 
  const { session } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [linkedGames, setLinkedGames] = useState<any[]>([]);
  const [enhancedData, setEnhancedData] = useState<EnhancedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [friendStatus, setFriendStatus] = useState<"none" | "request_sent" | "request_received" | "friends">("none");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const currentUserId = session?.user?.id;

  const checkDirectFriendship = async () => {
    if (!currentUserId || !id) return "none";
    try {
      const { data, error } = await supabase.from("friendships").select("*").or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
      if (error || !data) return "none";
      const relation = data.find(f => (f.requester_id === currentUserId && f.receiver_id === id) || (f.receiver_id === currentUserId && f.requester_id === id));
      if (!relation) return "none";
      if (relation.status === "accepted") return "friends";
      if (relation.requester_id === currentUserId) return "request_sent";
      return "request_received";
    } catch (e) { return "none"; }
  };

  useEffect(() => {
    if (currentUserId === id) { navigate("/profile"); return; }
    const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const [profileData, dashboardData, status] = await Promise.all([getUserProfile(id), fetchFullUserProfile(id), checkDirectFriendship()]);
        setProfile(profileData?.profile || null);
        setLinkedGames(profileData?.linkedGames || []);
        setEnhancedData(dashboardData);
        setFriendStatus(status as any);
      } catch (error) { console.error(error); } 
      finally { setIsLoading(false); }
    };
    loadData();
  }, [id, currentUserId, navigate]);

  const handleFriendAction = async () => {
    if (!currentUserId || !id) return;
    setIsActionLoading(true);
    try {
      if (friendStatus === "none") {
        await sendFriendRequest(currentUserId, id);
        setFriendStatus("request_sent"); 
      } else { navigate("/inbox"); }
    } catch (e: any) {
      const newStatus = await checkDirectFriendship();
      setFriendStatus(newStatus as any);
    } finally { setIsActionLoading(false); }
  };

  const copyCode = () => {
    if (!id) return;
    navigator.clipboard.writeText(generateFriendCode(id));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><Loader2 className="w-12 h-12 text-cyan-500 animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center text-white"><h2 className="text-xl font-bold">Player not found</h2></div>;

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6 lg:px-8 pb-24 w-full">
      <div className="max-w-5xl mx-auto space-y-10 w-full">
        
        {/* PUBLIC PROFILE HEADER & STATS */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
          <img src={profile.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="w-28 h-28 rounded-full border-2 border-cyan-500 object-cover z-10 shrink-0" />
          
          <div className="text-center md:text-left flex-1 z-10">
            <h1 className="text-4xl font-black truncate">{profile.display_name}</h1>
            <div className="mt-2 flex items-center justify-center md:justify-start gap-2">
              <p className="text-cyan-400 font-mono text-base font-bold tracking-widest">ID: {generateFriendCode(profile.id)}</p>
              <button onClick={copyCode} className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors border border-neutral-700">{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
            </div>
            
            {currentUserId && (
              <div className="mt-5">
                <button onClick={handleFriendAction} disabled={isActionLoading || friendStatus === "request_sent"} className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${friendStatus === "friends" ? "bg-cyan-600 text-white" : friendStatus === "request_sent" ? "bg-emerald-900/30 text-emerald-500 cursor-not-allowed" : friendStatus === "request_received" ? "bg-emerald-600 text-white" : "bg-fuchsia-600 text-white"}`}>
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : friendStatus === "friends" ? <><MessageSquare className="w-4 h-4"/> Message Player</> : friendStatus === "request_sent" ? <><Check className="w-4 h-4"/> Request Sent</> : friendStatus === "request_received" ? <><Check className="w-4 h-4"/> Review in Inbox</> : <><UserPlus className="w-4 h-4"/> Add Friend</>}
                </button>
              </div>
            )}
          </div>
          
          {/* 🔥 NEW STATS ROW: Penalties, Joined, Completed, Hosted 🔥 */}
          <div className="flex flex-wrap justify-center gap-3 z-10 mt-6 md:mt-0">
            
            {/* Penalty Tracker */}
            <div className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center ${
              (profile.penalties || 0) >= 3 ? "bg-red-900/30 border-red-500 text-red-500" : "bg-neutral-950 border-neutral-800 text-neutral-400"
            }`}>
              <Flag className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Penalties</span>
              <span className="text-xl font-black">{(profile.penalties || 0)} / 5</span>
            </div>

            {/* Joined */}
            <div className="bg-neutral-950 border border-neutral-800 px-5 py-3 rounded-xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Joined</span>
              <span className="text-2xl font-black text-emerald-400">{enhancedData?.playerTournaments?.upcoming?.length || 0}</span>
            </div>
            
            {/* Completed (Replaced Played) */}
            <div className="bg-neutral-950 border border-neutral-800 px-5 py-3 rounded-xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Completed</span>
              <span className="text-2xl font-black text-cyan-400">{enhancedData?.playerTournaments?.completed?.length || 0}</span>
            </div>

            {/* Hosted */}
            <div className="bg-neutral-950 border border-neutral-800 px-5 py-3 rounded-xl flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Hosted</span>
              <span className="text-2xl font-black text-fuchsia-500">{enhancedData?.stats?.tournamentsHosted || 0}</span>
            </div>
          </div>
        </div>

        {/* LINKED GAMES */}
        <div className="w-full">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6"><Gamepad2 className="w-6 h-6 text-cyan-400" /> Linked Accounts</h2>
          {linkedGames.length === 0 ? (
            <div className="text-center py-10 border border-neutral-800 border-dashed rounded-3xl bg-neutral-900/30 w-full text-neutral-500 italic">This player hasn't linked any games yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
              {linkedGames.map((linkedData) => (
                <div key={linkedData.game_id} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 relative shadow-lg w-full">
                  <h3 className="font-bold text-xl mb-4 pr-16 text-white truncate">{linkedData.in_game_name}</h3>
                  <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 overflow-hidden mb-4">
                    <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider font-bold">Account ID</p>
                    <p className="font-mono text-cyan-400 break-all text-sm">{linkedData.in_game_id}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center"><p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Matches</p><p className="text-lg font-black text-white">{linkedData.matches_played || 0}</p></div>
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center"><p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Wins</p><p className="text-lg font-black text-emerald-400">{linkedData.wins || 0}</p></div>
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center"><p className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1">Kills</p><p className="text-lg font-black text-fuchsia-400">{linkedData.kills || 0}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}