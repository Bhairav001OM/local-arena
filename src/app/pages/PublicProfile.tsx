import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile, fetchFullUserProfile, getFriendshipStatus, sendFriendRequest, acceptFriendRequest, type EnhancedUserProfile } from "../data"; 
import { Gamepad2, Loader2, Crown, Swords, ShieldAlert, UserPlus, Clock, MessageSquare, Check } from "lucide-react";
import { motion } from "framer-motion";

export function PublicProfile() {
  const { id } = useParams<{ id: string }>(); // URL se player ki ID aayegi
  const { session } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [linkedGames, setLinkedGames] = useState<any[]>([]);
  const [enhancedData, setEnhancedData] = useState<EnhancedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [friendStatus, setFriendStatus] = useState<"none" | "request_sent" | "request_received" | "friends">("none");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (currentUserId === id) {
      navigate("/profile"); // Agar apni hi id kholi toh original profile pe bhej do
      return;
    }

    const loadData = async () => {
      if (!id) return;
      try {
        const [profileData, dashboardData, status] = await Promise.all([
          getUserProfile(id),
          fetchFullUserProfile(id),
          currentUserId ? getFriendshipStatus(currentUserId, id) : Promise.resolve("none")
        ]);
        
        setProfile(profileData?.profile || null);
        setLinkedGames(profileData?.linkedGames || []);
        setEnhancedData(dashboardData);
        setFriendStatus(status as any);
      } catch (error) {
        console.error("Error loading public profile:", error);
      } finally {
        setIsLoading(false);
      }
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
      } else if (friendStatus === "request_received") {
        // Find the specific friendship ID to accept it (requires an extra fetch in a real app, but for now we rely on the Inbox for accepting to be safe, or we can just redirect to inbox)
        navigate("/inbox"); 
      } else if (friendStatus === "friends") {
        navigate("/inbox"); // Take them to chat
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><Loader2 className="w-12 h-12 text-cyan-500 animate-spin" /></div>;
  if (!profile) return <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center text-white"><ShieldAlert className="w-16 h-16 text-neutral-600 mb-4" /><h2 className="text-xl font-bold text-neutral-400">Player not found</h2></div>;

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4 sm:px-6 lg:px-8 pb-24 w-full overflow-hidden">
      <div className="max-w-5xl mx-auto space-y-10 w-full">
        
        {/* HEADER */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden w-full shadow-2xl">
          <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <img src={profile.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="w-28 h-28 rounded-full border-2 border-cyan-500 object-cover z-10 shrink-0" />
          
          <div className="text-center md:text-left flex-1 z-10 w-full md:w-auto min-w-0">
            <h1 className="text-4xl font-black truncate">{profile.display_name}</h1>
            <p className="text-neutral-400 font-mono text-sm mt-1 truncate">ID: {profile.id}</p>
            
            {/* FRIEND ACTION BUTTON */}
            {currentUserId && (
              <div className="mt-5">
                <button 
                  onClick={handleFriendAction}
                  disabled={isActionLoading || friendStatus === "request_sent"}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    friendStatus === "friends" ? "bg-cyan-600 hover:bg-cyan-500 text-white" :
                    friendStatus === "request_sent" ? "bg-neutral-800 text-neutral-400 cursor-not-allowed" :
                    friendStatus === "request_received" ? "bg-emerald-600 hover:bg-emerald-500 text-white" :
                    "bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                  }`}
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                    friendStatus === "friends" ? <><MessageSquare className="w-4 h-4"/> Message</> :
                    friendStatus === "request_sent" ? <><Clock className="w-4 h-4"/> Request Sent</> :
                    friendStatus === "request_received" ? <><Check className="w-4 h-4"/> Review in Inbox</> :
                    <><UserPlus className="w-4 h-4"/> Add Friend</>
                  }
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4 z-10 mt-6 md:mt-0 shrink-0">
            <div className="bg-neutral-950 border border-neutral-800 px-6 py-4 rounded-2xl flex flex-col items-center justify-center">
              <Swords className="w-5 h-5 text-cyan-400 mb-2" />
              <span className="text-3xl font-black text-white">{enhancedData?.stats.tournamentsPlayed || 0}</span>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Played</span>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 px-6 py-4 rounded-2xl flex flex-col items-center justify-center">
              <Crown className="w-5 h-5 text-fuchsia-400 mb-2" />
              <span className="text-3xl font-black text-white">{enhancedData?.stats.tournamentsHosted || 0}</span>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Hosted</span>
            </div>
          </div>
        </div>

        {/* LINKED GAMES (Read Only) */}
        <div className="w-full">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6"><Gamepad2 className="w-6 h-6 text-cyan-400" /> Linked Accounts</h2>
          
          {linkedGames.length === 0 ? (
            <div className="text-center py-10 border border-neutral-800 border-dashed rounded-3xl bg-neutral-900/30 w-full text-neutral-500 italic">
              This player hasn't linked any games yet.
            </div>
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
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Matches</p>
                      <p className="text-lg font-black text-white">{linkedData.matches_played || 0}</p>
                    </div>
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Wins</p>
                      <p className="text-lg font-black text-emerald-400">{linkedData.wins || 0}</p>
                    </div>
                    <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wider mb-1">Kills</p>
                      <p className="text-lg font-black text-fuchsia-400">{linkedData.kills || 0}</p>
                    </div>
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