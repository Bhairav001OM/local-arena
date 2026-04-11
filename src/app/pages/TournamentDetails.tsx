import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Loader2, MessageSquare, Users, ChevronLeft, Lock, Send, Megaphone, 
  Ban, Clock, CheckCircle2, Trophy, UploadCloud, AlertTriangle, ThumbsUp, ThumbsDown, Link as LinkIcon, Image as ImageIcon, UserMinus
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase"; 
import { 
  getTournamentById, fetchMessages, sendMessage, fetchTournamentRoster, 
  completeTournamentMatch, fetchMatchVotes, submitMatchVote, uploadScreenshot, joinTournament, kickPlayer, type Tournament 
} from "../../app/data"; 

export function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth(); 
  
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
  const [playerGameIds, setPlayerGameIds] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [roster, setRoster] = useState<any[]>([]);

  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadChatData = async (tourn: Tournament) => {
    if (!id) return;
    try {
      const msgs = await fetchMessages(id);
      setMessages(msgs);
      const userIds = [...new Set(msgs.map((m: any) => m.user_id))];
      if (userIds.length > 0) {
        const { data: linked } = await supabase.from("linked_games").select("user_id, in_game_id").eq("game_id", tourn.gameId).in("user_id", userIds);
        const idMap: Record<string, string> = {};
        linked?.forEach((link: { user_id: string | number; in_game_id: string; }) => { idMap[link.user_id] = link.in_game_id; });
        setPlayerGameIds(idMap);
      }
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
        if (user?.id) {
          const { data: profileCheck } = await supabase.from("profiles").select("is_banned").eq("id", user.id).single();
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
        if (user?.id) isVIP = rosterData.some((player: { user_id: string; }) => player.user_id === user.id);
        setHasAccess(isVIP);

        if (isVIP || user?.id === data.host_id) await loadChatData(data);
      } catch (error) { console.error("Failed to load lobby", error); } 
      finally { if (isMounted && !isBanned) setIsLoading(false); }
    }
    if (user !== undefined) loadLobby();
    return () => { isMounted = false; };
  }, [id, user?.id]); 

  useEffect(() => {
    if (!id || !tournament || isBanned || (!hasAccess && user?.id !== tournament.host_id)) return;
    const channel = supabase.channel('live-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_messages', filter: `tournament_id=eq.${id}` }, () => { loadChatData(tournament); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, tournament, isBanned, hasAccess]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id) return;
    const textToSend = newMessage.trim();
    setNewMessage(""); 
    const myProfile = roster.find(p => p.user_id === user.id)?.profiles || { display_name: "Player" };
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, user_id: user.id, message: textToSend, created_at: new Date().toISOString(), profiles: myProfile }]);
    setIsSending(true);
    try { await sendMessage(id, user.id, textToSend); } catch (error) { console.error("Failed to send", error); } finally { setIsSending(false); }
  };

  const handleJoinTournament = async () => {
    if (!user || !id || !tournament) return;
    const isPrivateArena = tournament.isPrivate || (tournament as any).is_private;
    if (isPrivateArena && !showPasswordBox) {
      setShowPasswordBox(true);
      return;
    }
    if (isPrivateArena && !passwordInput.trim()) {
      alert("Please enter the password!");
      return;
    }
    setIsJoining(true);
    try {
      await joinTournament(id, user.id, passwordInput);
      alert("✅ Successfully Joined!");
      window.location.reload(); 
    } catch (error: any) {
      alert(error.message || "Failed to join.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCompleteMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    setIsCompleting(true);
    try {
      let finalUrl = "";
      if (hostUploadType === "file" && hostFile) {
        finalUrl = await uploadScreenshot(hostFile, user.id);
      } else if (hostUploadType === "url" && screenshotUrl.trim()) {
        finalUrl = screenshotUrl.trim();
      } else {
        throw new Error("Please provide an image file or a valid URL.");
      }
      await completeTournamentMatch(id, finalUrl);
      alert("Results Submitted! Waiting for player verification.");
      window.location.reload(); 
    } catch (err: any) { alert(err.message || "Failed to save results."); } 
    finally { setIsCompleting(false); }
  };

  const handleVote = async (isApproved: boolean) => {
    if (!isApproved && !showDisputeInput) {
      setShowDisputeInput(true); 
      return;
    }
    if (!isApproved && !disputeReason.trim()) {
      alert("You must provide a reason for disputing the result.");
      return;
    }
    setIsVoting(true);
    try {
      let proofFinalUrl = undefined;
      if (!isApproved) {
        if (disputeUploadType === "file" && disputeFile) {
          proofFinalUrl = await uploadScreenshot(disputeFile, user!.id);
        } else if (disputeUploadType === "url" && disputeUrl.trim()) {
          proofFinalUrl = disputeUrl.trim();
        }
      }
      await submitMatchVote(id!, user!.id, isApproved, isApproved ? undefined : disputeReason, proofFinalUrl);
      await loadVotes();
      setShowDisputeInput(false);
    } catch (err: any) { alert(err.message || "Failed to cast vote."); } 
    finally { setIsVoting(false); }
  };

  // 🔥 NEW: HOST KICK ACTION 🔥
  const handleKickPlayer = async (playerId: string, playerName: string) => {
    if (!window.confirm(`Are you sure you want to kick ${playerName}? They will be removed from the lobby.`)) return;
    try {
      await kickPlayer(id!, playerId);
      setRoster(prev => prev.filter(p => p.user_id !== playerId));
      alert(`✅ ${playerName} has been kicked from the tournament.`);
    } catch (error: any) {
      alert("Error kicking player: " + error.message);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center"><Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" /></div>;
  if (isBanned) return <div className="min-h-screen bg-neutral-950 flex justify-center p-6 text-center"><div className="bg-red-950/30 border-2 border-red-500 p-10 rounded-3xl max-w-md w-full"><Ban className="w-20 h-20 text-red-500 mx-auto mb-6" /><h2 className="text-3xl font-black text-red-500 mb-4">Access Denied</h2><Link to="/profile" className="py-4 px-6 bg-red-600 text-white font-black rounded-xl block">Return</Link></div></div>;
  if (!tournament) return <div className="min-h-screen bg-neutral-950 flex justify-center items-center text-white"><h2>Arena Not Found</h2></div>;

  const isHost = user?.id === tournament.host_id;
  const myVote = votes.find(v => v.user_id === user?.id);
  const approvedCount = votes.filter(v => v.is_approved).length;
  const disputedCount = votes.filter(v => !v.is_approved).length;
  const isPrivateArena = tournament.isPrivate || (tournament as any).is_private;

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-24">
      <div className="bg-neutral-900 border-b border-neutral-800 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/tournaments" className="inline-flex items-center text-neutral-400 hover:text-white mb-6 font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Tournaments
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-4xl md:text-5xl font-black">{tournament.title}</h1>
              {tournament.short_code && <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg font-mono font-bold">Code: {tournament.short_code}</span>}
              
              {isPrivateArena && (
                <span className="bg-red-900/30 text-red-400 border border-red-500/30 px-3 py-1 rounded-lg font-bold flex items-center gap-1 text-sm">
                  <Lock className="w-4 h-4" /> Private
                </span>
              )}

              <span className={`px-4 py-1 rounded-full font-bold uppercase tracking-wider text-sm border ${
                tournament.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" :
                tournament.status === "verifying" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" :
                tournament.status === "disputed" ? "bg-red-500/20 text-red-500 border-red-500/50" :
                tournament.status === "ongoing" ? "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50" :
                "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
              }`}>{tournament.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ======================= LEFT COLUMN ======================= */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. HOST CONTROL PANEL */}
            {isHost && (tournament.status === "upcoming" || tournament.status === "ongoing") && (
              <div className="bg-fuchsia-950/30 border-2 border-fuchsia-500/50 rounded-2xl p-6 shadow-lg shadow-fuchsia-500/10">
                <h3 className="text-lg font-black text-fuchsia-400 flex items-center gap-2 mb-4"><Trophy className="w-5 h-5" /> Host Controls</h3>
                
                <div className="flex gap-2 mb-4 bg-fuchsia-950/50 p-1 rounded-lg border border-fuchsia-500/30">
                  <button onClick={() => setHostUploadType("file")} className={`flex-1 py-1.5 text-sm font-bold rounded-md flex items-center justify-center gap-2 ${hostUploadType === "file" ? "bg-fuchsia-600 text-white" : "text-fuchsia-400 hover:text-white"}`}><ImageIcon className="w-4 h-4"/> Device</button>
                  <button onClick={() => setHostUploadType("url")} className={`flex-1 py-1.5 text-sm font-bold rounded-md flex items-center justify-center gap-2 ${hostUploadType === "url" ? "bg-fuchsia-600 text-white" : "text-fuchsia-400 hover:text-white"}`}><LinkIcon className="w-4 h-4"/> URL</button>
                </div>

                <form onSubmit={handleCompleteMatch} className="space-y-3">
                  {hostUploadType === "file" ? (
                    <input type="file" accept="image/*" required onChange={(e) => setHostFile(e.target.files?.[0] || null)} className="w-full bg-neutral-950 border border-fuchsia-500/30 rounded-lg px-4 py-2 text-sm text-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-fuchsia-600 file:text-white hover:file:bg-fuchsia-500"/>
                  ) : (
                    <input type="url" required value={screenshotUrl} onChange={(e) => setScreenshotUrl(e.target.value)} placeholder="https://imgur.com/screenshot" className="w-full bg-neutral-950 border border-fuchsia-500/30 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500"/>
                  )}
                  
                  <button type="submit" disabled={isCompleting || (hostUploadType === "file" && !hostFile)} className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50">
                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UploadCloud className="w-4 h-4" /> Submit Results</>}
                  </button>
                </form>
              </div>
            )}

            {/* 2. VERIFICATION UI */}
            {(tournament.status === "verifying" || tournament.status === "completed" || tournament.status === "disputed") && tournament.result_image && (
              <div className="bg-yellow-950/20 border-2 border-yellow-500/50 rounded-2xl p-6">
                <h3 className="text-lg font-black text-yellow-400 flex items-center gap-2 mb-4">
                  {tournament.status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {tournament.status === "completed" ? "Final Match Results" : "Match Verification"}
                </h3>
                <a href={tournament.result_image} target="_blank" rel="noreferrer" className="block text-center py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg font-bold border border-yellow-500/20 transition-colors mb-6">
                  🔍 View Host's Screenshot
                </a>

                {(tournament.status === "verifying" || tournament.status === "disputed") && (
                  <>
                    <div className="flex justify-between text-sm font-bold mb-4 border-b border-neutral-800 pb-4">
                      <span className="text-emerald-400">{approvedCount} Approved</span>
                      <span className="text-red-400">{disputedCount} Disputed</span>
                    </div>

                    {!isHost && hasAccess && (
                      <div>
                        {myVote ? (
                          <div className={`p-3 rounded-lg text-center font-bold border ${myVote.is_approved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            You voted: {myVote.is_approved ? "Screenshot is Correct" : "Screenshot is Incorrect"}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-neutral-300 font-bold text-center mb-2">Is the Host's screenshot accurate?</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleVote(true)} disabled={isVoting} className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><ThumbsUp className="w-4 h-4" /> Yes</button>
                              <button onClick={() => handleVote(false)} disabled={isVoting} className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/50 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><ThumbsDown className="w-4 h-4" /> No</button>
                            </div>
                            
                            {showDisputeInput && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-2">
                                <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Explain what is wrong..." className="w-full bg-neutral-950 border border-red-500/30 rounded-lg p-3 text-sm focus:outline-none focus:border-red-500 mb-2" rows={2}/>
                                
                                <p className="text-xs text-red-400 font-bold mb-1">Upload Your Proof (Optional)</p>
                                <div className="flex gap-2 mb-2 bg-red-950/50 p-1 rounded-lg border border-red-500/30">
                                  <button onClick={() => setDisputeUploadType("file")} className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${disputeUploadType === "file" ? "bg-red-600 text-white" : "text-red-400"}`}><ImageIcon className="w-3 h-3"/> Device</button>
                                  <button onClick={() => setDisputeUploadType("url")} className={`flex-1 py-1 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${disputeUploadType === "url" ? "bg-red-600 text-white" : "text-red-400"}`}><LinkIcon className="w-3 h-3"/> URL</button>
                                </div>
                                
                                {disputeUploadType === "file" ? (
                                  <input type="file" accept="image/*" onChange={(e) => setDisputeFile(e.target.files?.[0] || null)} className="w-full mb-3 text-sm text-neutral-400 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white"/>
                                ) : (
                                  <input type="url" value={disputeUrl} onChange={(e) => setDisputeUrl(e.target.value)} placeholder="Proof Image URL" className="w-full bg-neutral-950 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mb-3"/>
                                )}

                                <button onClick={() => handleVote(false)} disabled={isVoting} className="w-full py-2 bg-red-600 text-white rounded-lg font-bold flex justify-center">
                                  {isVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute & Proof"}
                                </button>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {isHost && <p className="text-sm text-yellow-500/80 text-center italic mt-2">Waiting for player consensus...</p>}
                  </>
                )}
              </div>
            )}

            {/* 3. MATCH INTEL */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 border-b border-neutral-800 pb-2">Match Intel</h3>
              <div className="space-y-4 text-sm">
                <div><p className="text-neutral-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Date & Time</p><p className="font-medium">{new Date(tournament.date).toLocaleDateString()} at {tournament.time || "TBD"}</p></div>
                <div><p className="text-neutral-500 mb-1">Prize Pool</p><p className="font-medium text-fuchsia-400">{tournament.prizePool || "Bragging Rights"}</p></div>
                <div><p className="text-neutral-500 mb-1">Location / Venue</p><p className="font-medium">{tournament.location}</p></div>
              </div>
            </div>

            {/* 4. ACTIVE ROSTER BOX (WITH KICK BUTTON) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col max-h-[400px]">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-2">
                <h3 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Active Roster</h3>
                <span className="bg-neutral-800 text-neutral-300 text-xs font-bold px-2 py-1 rounded-md">{roster.length} Players</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {roster.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic text-center py-4">Lobby is currently empty.</p>
                ) : (
                  roster.map((player) => (
                    <div key={player.user_id} className="flex items-center gap-3 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/50 transition-all hover:bg-neutral-900">
                      <img src={player.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="avatar" className="w-10 h-10 rounded-full border border-neutral-700" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{player.profiles?.display_name} {player.user_id === tournament.host_id && <span className="ml-2 text-[10px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Host</span>}</p>
                        <p className="text-xs text-cyan-500 font-mono truncate">ID: {player.in_game_id}</p>
                      </div>
                      
                      {/* 🔥 NEW: KICK BUTTON (Only visible to Host) 🔥 */}
                      {isHost && player.user_id !== user?.id && tournament.status === "upcoming" && (
                        <button
                          onClick={() => handleKickPlayer(player.user_id, player.profiles?.display_name)}
                          className="p-2 bg-red-900/30 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-colors border border-red-500/20"
                          title="Kick Player"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* ======================= RIGHT COLUMN (JOIN / CHAT) ======================= */}
          <div className="lg:col-span-2">
            {!hasAccess && !isHost ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center h-[600px] p-6 text-center shadow-xl">
                <Lock className="w-16 h-16 text-cyan-500 mb-6" />
                <h2 className="text-3xl font-black mb-2">Join this Arena</h2>
                <p className="text-neutral-400 mb-8 max-w-md">You need to register to participate in this tournament and access the live match lobby.</p>

                {isPrivateArena && showPasswordBox && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm mb-4">
                    <input
                      type="password"
                      placeholder="Enter Secret Password 🔒"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-950 border border-cyan-500/50 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-center font-bold tracking-widest"
                    />
                  </motion.div>
                )}

                <button
                  onClick={handleJoinTournament}
                  disabled={isJoining}
                  className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : (isPrivateArena && showPasswordBox ? "Confirm Password" : "Join Tournament")}
                </button>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col h-[600px] overflow-hidden relative">
                <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5 text-cyan-400" /><h3 className="text-lg font-bold">Live Match Lobby</h3></div>
                  {(tournament.status === "completed" || tournament.status === "verifying" || tournament.status === "disputed") && <span className="text-xs text-yellow-400 font-bold bg-yellow-500/10 px-2 py-1 rounded">MATCH LOCKED</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-neutral-950">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.user_id === user?.id ? "justify-end" : "justify-start"}`}>
                      <div className={`px-4 py-3 rounded-2xl ${msg.user_id === user?.id ? "bg-cyan-600 text-white" : "bg-neutral-800 text-neutral-200"}`}>
                        <p className="text-xs opacity-50 mb-1">{msg.profiles?.display_name}</p>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-neutral-900 border-t border-neutral-800">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} disabled={tournament.status === "completed" || tournament.status === "verifying" || tournament.status === "disputed"} className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500" />
                    <button type="submit" disabled={isSending || !newMessage.trim() || tournament.status === "completed" || tournament.status === "verifying" || tournament.status === "disputed"} className="px-5 bg-cyan-600 text-white rounded-xl font-bold"><Send className="w-5 h-5" /></button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}