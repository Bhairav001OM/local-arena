import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Loader2, MessageSquare, Users, ChevronLeft, Lock, Send, 
  Ban, Clock, CheckCircle2, Trophy, UploadCloud, AlertTriangle, 
  ThumbsUp, ThumbsDown, Link as LinkIcon, Image as ImageIcon, UserMinus, Gamepad2, ExternalLink, MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase"; 
import { 
  getTournamentById, fetchMessages, sendMessage, fetchTournamentRoster, 
  completeTournamentMatch, fetchMatchVotes, submitMatchVote, uploadScreenshot, joinTournament, kickPlayer, type Tournament 
} from "../../app/data"; 

export function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, session } = useAuth(); 
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isBanned, setIsBanned] = useState(false); 

  const [hostUploadType, setHostUploadType] = useState<"url" | "file">("file");
  const [disputeUploadType, setDisputeUploadType] = useState<"url" | "file">("file");

  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [hostFile, setHostFile] = useState<File | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [votes, setVotes] = useState<any[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeUrl, setDisputeUrl] = useState("");
  const [disputeFile, setDisputeFile] = useState<File | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [roster, setRoster] = useState<any[]>([]);

  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadChatData = async () => {
    if (!id) return;
    try {
      const msgs = await fetchMessages(id);
      setMessages(msgs);
    } catch (error) { console.error("Failed to load chat", error); }
  };

  const loadVotes = async () => {
    if (!id) return;
    try {
      const v = await fetchMatchVotes(id);
      setVotes(v);
    } catch (err) { console.error("Failed to load votes", err); }
  };

  useEffect(() => {
    let isMounted = true; 
    async function loadLobby() {
      if (!id) return;
      setIsLoading(true);
      try {
        const currentId = user?.id || session?.user?.id;
        if (currentId) {
          const { data: profileCheck } = await supabase.from("profiles").select("is_banned").eq("id", currentId).single();
          if (profileCheck?.is_banned === true) {
            if (isMounted) { setIsBanned(true); setIsLoading(false); }
            return; 
          }
        }
        const data = await getTournamentById(id);
        if (!isMounted) return;
        setTournament(data);

        if (data.status === "verifying" || data.status === "disputed" || data.status === "completed") {
          await loadVotes();
        }

        const rosterData = await fetchTournamentRoster(id, data.gameId);
        if (!isMounted) return;
        setRoster(rosterData);

        let isVIP = false;
        if (currentId) isVIP = rosterData.some((player: any) => player.user_id === currentId);
        setHasAccess(isVIP);

        if (isVIP || currentId === data.host_id) await loadChatData();
      } catch (error) { console.error("Failed to load lobby", error); } 
      finally { if (isMounted && !isBanned) setIsLoading(false); }
    }
    loadLobby();
    return () => { isMounted = false; };
  }, [id, user?.id, session?.user?.id]); 

  useEffect(() => {
    if (!id || !tournament || isBanned) return;
    const channel = supabase.channel(`tourn-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_messages', filter: `tournament_id=eq.${id}` }, () => { 
        loadChatData(); 
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, tournament, isBanned]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentId = user?.id || session?.user?.id;
    if (!newMessage.trim() || !currentId || !id) return;
    const textToSend = newMessage.trim();
    setNewMessage(""); 
    setIsSending(true);
    try { await sendMessage(id, currentId, textToSend); } catch (error) { console.error("Failed to send", error); } finally { setIsSending(false); }
  };

  const handleJoinTournament = async () => {
    const currentId = user?.id || session?.user?.id;
    if (!currentId || !id || !tournament) return;
    if (tournament.isPrivate && !showPasswordBox) { setShowPasswordBox(true); return; }
    setIsJoining(true);
    try {
      await joinTournament(id, currentId, passwordInput);
      window.location.reload(); 
    } catch (error: any) { alert(error.message || "Failed to join."); } 
    finally { setIsJoining(false); }
  };

  const handleCompleteMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentId = user?.id || session?.user?.id;
    if (!id || !currentId) return;
    setIsCompleting(true);
    try {
      let finalUrl = "";
      if (hostUploadType === "file" && hostFile) finalUrl = await uploadScreenshot(hostFile, currentId);
      else if (hostUploadType === "url" && screenshotUrl.trim()) finalUrl = screenshotUrl.trim();
      else throw new Error("Provide proof image.");
      await completeTournamentMatch(id, finalUrl);
      window.location.reload(); 
    } catch (err: any) { alert(err.message); } 
    finally { setIsCompleting(false); }
  };

  const handleVote = async (isApproved: boolean) => {
    const currentId = user?.id || session?.user?.id;
    if (!currentId) return;
    if (!isApproved && !showDisputeInput) { setShowDisputeInput(true); return; }
    setIsVoting(true);
    try {
      let proofUrl = undefined;
      if (!isApproved) {
        if (disputeUploadType === "file" && disputeFile) proofUrl = await uploadScreenshot(disputeFile, currentId);
        else if (disputeUploadType === "url") proofUrl = disputeUrl;
      }
      await submitMatchVote(id!, currentId, isApproved, isApproved ? undefined : disputeReason, proofUrl);
      await loadVotes();
      setShowDisputeInput(false);
    } catch (err: any) { alert(err.message); } 
    finally { setIsVoting(false); }
  };

  const handleKickPlayer = async (playerId: string, playerName: string) => {
    if (!window.confirm(`Kick ${playerName}?`)) return;
    try {
      await kickPlayer(id!, playerId);
      setRoster(prev => prev.filter(p => p.user_id !== playerId));
    } catch (error: any) { alert(error.message); }
  };

  if (isLoading) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" /></div>;
  if (isBanned) return <div className="min-h-screen bg-neutral-950 flex justify-center p-6 text-center"><div className="bg-red-950/30 border-2 border-red-500 p-10 rounded-3xl max-w-md w-full"><Ban className="w-20 h-20 text-red-500 mx-auto mb-6" /><h2 className="text-3xl font-black text-red-500 mb-4">Access Denied</h2><Link to="/" className="py-4 px-6 bg-red-600 text-white font-black rounded-xl block">Return Home</Link></div></div>;
  if (!tournament) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center text-white"><h2>Arena Not Found</h2></div>;

  const currentId = user?.id || session?.user?.id;
  const isHost = currentId === tournament.host_id;
  const myVote = votes.find(v => v.user_id === currentId);
  const approvedCount = votes.filter(v => v.is_approved).length;
  const disputedCount = votes.filter(v => !v.is_approved).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      {/* Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/tournaments" className="inline-flex items-center text-neutral-400 hover:text-white mb-6 font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Tournaments
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-black">{tournament.title}</h1>
                {tournament.isPrivate && <Lock className="w-6 h-6 text-red-500" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg font-mono text-sm font-bold">Code: {tournament.short_code}</span>
                <span className={`px-4 py-1 rounded-full font-bold uppercase tracking-wider text-xs border ${
                  tournament.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
                }`}>{tournament.status}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-neutral-500 text-sm uppercase font-bold tracking-widest">Prize Pool</p>
              <p className="text-3xl font-black text-fuchsia-500">{tournament.prizePool || "Bragging Rights"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Details & Roster */}
          <div className="space-y-6">
            
            {/* 1. Details Box (Wapas Add Kar Diya!) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 border-b border-neutral-800 pb-2">Tournament Intel</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Gamepad2 className="w-5 h-5 text-cyan-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Game</p><p className="font-bold">{tournament.gameName}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-fuchsia-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Date & Time</p><p className="font-bold">{new Date(tournament.date).toLocaleDateString()} @ {tournament.time || "TBA"}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Location</p><p className="font-bold">{tournament.location}</p></div>
                </div>
              </div>
            </div>

            {/* 2. Verification / Voting */}
            {(tournament.status === "verifying" || tournament.status === "completed") && tournament.result_image && (
              <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-2xl p-6">
                <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4"/> Match Result</h3>
                <a href={tournament.result_image} target="_blank" rel="noreferrer" className="block w-full h-32 bg-neutral-950 rounded-lg mb-3 overflow-hidden border border-neutral-800">
                  <img src={tournament.result_image} className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" alt="result" />
                </a>
                {!isHost && hasAccess && !myVote && (
                  <div className="flex gap-2">
                    <button onClick={() => handleVote(true)} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold">Approve</button>
                    <button onClick={() => handleVote(false)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Dispute</button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Host Controls */}
            {isHost && (tournament.status === "upcoming" || tournament.status === "ongoing") && (
              <div className="bg-fuchsia-950/30 border-2 border-fuchsia-500/50 rounded-2xl p-6">
                <h3 className="text-lg font-black text-fuchsia-400 mb-4">Host Panel</h3>
                <form onSubmit={handleCompleteMatch} className="space-y-3">
                   <input type="file" onChange={(e) => setHostFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                   <button type="submit" disabled={isCompleting} className="w-full py-3 bg-fuchsia-600 text-white font-bold rounded-lg">{isCompleting ? "Submitting..." : "Submit Match Proof"}</button>
                </form>
              </div>
            )}

            {/* 4. Roster */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4 border-b border-neutral-800 pb-2"><Users className="w-5 h-5 text-cyan-400" /> Players ({roster.length})</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {roster.map((player: any) => (
                  <Link key={player.user_id} to={`/player/${player.user_id}`} className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 hover:border-cyan-500/50 transition-all group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={player.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-9 h-9 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-cyan-400 truncate">{player.profiles?.display_name}</p>
                        <p className="text-[10px] text-neutral-500 font-mono truncate">IGN: {player.in_game_id}</p>
                      </div>
                    </div>
                    {isHost && player.user_id !== currentId && <UserMinus onClick={(e) => { e.preventDefault(); handleKickPlayer(player.user_id, player.profiles?.display_name); }} className="w-4 h-4 text-red-900 hover:text-red-500" />}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Chat & Verification */}
          <div className="lg:col-span-2">
            {!hasAccess && !isHost ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Lock className="w-16 h-16 text-cyan-500 mb-6 opacity-20" />
                <h2 className="text-3xl font-black mb-4">Lobby Restricted</h2>
                {tournament.isPrivate && showPasswordBox && (
                  <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="mb-4 p-3 bg-neutral-950 border border-neutral-700 rounded-xl text-center" />
                )}
                <button onClick={handleJoinTournament} disabled={isJoining} className="px-10 py-4 bg-cyan-600 text-white font-bold rounded-xl">{isJoining ? "Joining..." : "Join Now"}</button>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col h-[650px] overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5 text-cyan-400" /> Match Chat</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Live</div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-950 custom-scrollbar">
                  {messages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.user_id === currentId ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] flex flex-col ${msg.user_id === currentId ? "items-end" : "items-start"}`}>
                        <Link to={`/player/${msg.user_id}`} className="text-[10px] font-bold text-neutral-500 mb-1 hover:text-cyan-400 transition-colors">
                          {msg.profiles?.display_name}
                        </Link>
                        <div className={`px-4 py-2 rounded-2xl text-sm ${msg.user_id === currentId ? "bg-cyan-600 text-white rounded-tr-none" : "bg-neutral-800 text-neutral-200 rounded-tl-none"}`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-4 bg-neutral-900 border-t border-neutral-800 flex gap-2">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type match plans..." className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
                  <button type="submit" disabled={isSending || !newMessage.trim()} className="p-3 bg-cyan-600 text-white rounded-xl"><Send className="w-5 h-5" /></button>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}