import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Loader2, MessageSquare, Users, ChevronLeft, Lock, Send, 
  Ban, Clock, CheckCircle2, Trophy, UploadCloud, AlertTriangle, 
  ThumbsUp, ThumbsDown, Link as LinkIcon, Image as ImageIcon, UserMinus, Gamepad2, MapPin, Flag, BrainCircuit, AlertOctagon, ShieldAlert, Timer, Database, RefreshCw, Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase"; 
import { 
  getTournamentById, fetchMessages, sendMessage, fetchTournamentRoster, 
  completeTournamentMatch, fetchMatchVotes, submitMatchVote, uploadScreenshot, joinTournament, kickPlayer, markPlayerNoShow, reRunAIVerification, type Tournament 
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
  const [isRetryingAI, setIsRetryingAI] = useState(false);

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

  const [syncCountdown, setSyncCountdown] = useState<number | null>(null);

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

        if (data.status === "completed") {
          setSyncCountdown(5); 
        }

        if (data.status === "verifying" || data.status === "disputed" || data.status === "completed" || data.status === "admin_review") {
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
    if (syncCountdown !== null && syncCountdown > 0) {
      const timer = setTimeout(() => setSyncCountdown(syncCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [syncCountdown]);

  useEffect(() => {
    if (!id || !tournament || isBanned) return;
    
    const channel = supabase.channel(`tourn-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_messages', filter: `tournament_id=eq.${id}` }, () => { 
        loadChatData(); 
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, (payload) => {
        const newData = { ...tournament, ...payload.new } as any;
        setTournament(newData);
        if (payload.new.status === "completed" && tournament.status !== "completed") {
           setSyncCountdown(5);
        }
      })
      .subscribe();
      
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
    if (!id || !currentId || !tournament) return;
    setIsCompleting(true);
    try {
      let finalUrl = "";
      if (hostUploadType === "file" && hostFile) finalUrl = await uploadScreenshot(hostFile, currentId);
      else if (hostUploadType === "url" && screenshotUrl.trim()) finalUrl = screenshotUrl.trim();
      else throw new Error("Provide proof image.");
      
      await completeTournamentMatch(id, finalUrl, tournament.gameName);
      alert("Screenshot Uploaded! AI is scanning now...");
      window.location.reload(); 
    } catch (err: any) { alert(err.message); } 
    finally { setIsCompleting(false); }
  };

  const handleRetryAI = async () => {
    if (!id || !tournament || !tournament.result_image) return;
    setIsRetryingAI(true);
    try {
       setTournament({ 
         ...tournament, 
         ai_stats: null, 
         status: "verifying", 
         ai_tampering_flag: undefined, 
         ai_confidence: undefined 
       } as any);
       
       await reRunAIVerification(id, tournament.result_image, tournament.gameName);
    } catch (error: any) {
       alert(error.message || "Failed to re-scan image.");
    } finally {
       setIsRetryingAI(false);
    }
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
      
      alert("Vote submitted!");
      window.location.reload(); 
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

  const handleNoShowPenalty = async (playerId: string, playerName: string) => {
    if (!window.confirm(`Give ${playerName} a No-Show Penalty? They will be removed from the lobby. 5 penalties = Permanent Ban.`)) return;
    try {
      const result = await markPlayerNoShow(id!, playerId);
      setRoster(prev => prev.filter(p => p.user_id !== playerId));
      alert(`🚨 Penalty Added! ${playerName} now has ${result.penalties}/5 penalties. ${result.isBanned ? 'THEY ARE NOW BANNED.' : ''}`);
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
      <div className="bg-neutral-900 border-b border-neutral-800 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/tournaments" className="inline-flex items-center text-neutral-400 hover:text-white mb-6 font-medium">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Tournaments
          </Link>

          {tournament.status === "admin_review" && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-950/50 border border-red-500 p-4 rounded-2xl mb-6 flex items-center gap-4 shadow-lg shadow-red-500/10">
              <AlertOctagon className="w-10 h-10 text-red-500 animate-pulse shrink-0" />
              <div>
                <h4 className="text-lg font-black text-red-500 uppercase tracking-widest">Under Admin Review</h4>
                <p className="text-sm text-red-300 font-medium">The AI detected potential tampering or low confidence in the results. An Admin will review this match manually.</p>
              </div>
            </motion.div>
          )}

          {syncCountdown !== null && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 overflow-hidden">
              {syncCountdown > 0 ? (
                <div className="bg-cyan-950/40 border border-cyan-500/50 p-4 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <Timer className="w-8 h-8 text-cyan-400 animate-spin" />
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-cyan-400 uppercase tracking-widest">Updating Player Profiles...</h4>
                    <p className="text-sm text-cyan-200">Database is syncing AI stats for all players. Estimated Time: <span className="font-bold text-white">{syncCountdown}s</span></p>
                  </div>
                  <Database className="w-6 h-6 text-cyan-500/50 animate-pulse" />
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/50 p-4 rounded-2xl flex items-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-emerald-400 uppercase tracking-widest">Global Sync Complete!</h4>
                    <p className="text-sm text-emerald-200">All player stats, kills, and victory records have been successfully updated.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-black">{tournament.title}</h1>
                {tournament.isPrivate && <Lock className="w-6 h-6 text-red-500" />}
              </div>
              <div className="flex flex-wrap gap-2">
                {tournament.short_code && <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg font-mono text-sm font-bold">Code: {tournament.short_code}</span>}
                <span className={`px-4 py-1 rounded-full font-bold uppercase tracking-wider text-xs border ${
                  tournament.status === "completed" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : 
                  tournament.status === "admin_review" ? "bg-red-500/20 text-red-400 border-red-500/50" :
                  "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
                }`}>{tournament.status.replace("_", " ")}</span>
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
          
          <div className="space-y-6">
            
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 border-b border-neutral-800 pb-2">Tournament Intel</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Gamepad2 className="w-5 h-5 text-cyan-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Game</p><p className="font-bold text-cyan-400 uppercase">{tournament.gameName}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-fuchsia-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Date & Time</p><p className="font-medium">{new Date(tournament.date).toLocaleDateString()} @ {tournament.time || "TBA"}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-500 mt-1" />
                  <div><p className="text-xs text-neutral-500 uppercase font-bold">Location</p><p className="font-medium">{tournament.location}</p></div>
                </div>
              </div>
            </div>

            {(tournament.status === "verifying" || tournament.status === "completed" || tournament.status === "disputed" || tournament.status === "admin_review") && tournament.result_image && (
              <div className="bg-yellow-950/20 border-2 border-yellow-500/50 rounded-2xl p-6">
                <h3 className="text-lg font-black text-yellow-400 flex items-center gap-2 mb-4">
                  {tournament.status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {tournament.status === "completed" ? "Final Match Results" : "Match Verification"}
                </h3>
                <a href={tournament.result_image} target="_blank" rel="noreferrer" className="block text-center py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg font-bold border border-yellow-500/20 transition-colors mb-6">
                  🔍 View Host's Screenshot
                </a>

                {['verifying', 'admin_review', 'disputed'].includes(tournament.status) && !tournament.ai_stats ? (
                   <div className="bg-indigo-950/30 border border-indigo-500/40 rounded-2xl p-6 text-center mb-6 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]">
                     <BrainCircuit className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-pulse" />
                     <h3 className="text-lg font-black text-indigo-400 animate-pulse">AI is Scanning Image...</h3>
                     <p className="text-xs text-indigo-300 mt-2">Please wait. Checking text and verifying winner.</p>
                   </div>
                ) : (
                  <>
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
                        {isHost && <p className="text-sm text-yellow-500/80 text-center italic mt-2">Waiting for players to approve...</p>}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {isHost && (tournament.status === "upcoming" || tournament.status === "ongoing") && (
              <div className="bg-fuchsia-950/30 border-2 border-fuchsia-500/50 rounded-2xl p-6">
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
                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UploadCloud className="w-4 h-4" /> Submit Results & Run AI</>}
                  </button>
                </form>
              </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col max-h-[400px]">
              <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-2">
                <h3 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Active Roster</h3>
                <span className="bg-neutral-800 text-neutral-300 text-xs font-bold px-2 py-1 rounded-md">{roster.length} Players</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {roster.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic text-center py-4">Lobby is currently empty.</p>
                ) : (
                  roster.map((player: any) => {
                    const displayName = player.in_game_name && player.in_game_name !== "Unknown" ? player.in_game_name : player.profiles?.display_name;
                    
                    return (
                      <Link 
                        key={player.user_id} 
                        to={`/player/${player.user_id}`}
                        className="flex items-center gap-3 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/50 transition-all hover:bg-neutral-900 hover:border-cyan-500/50 group block"
                      >
                        <img src={player.profiles?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="avatar" className="w-10 h-10 rounded-full border border-neutral-700 object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                            {displayName} 
                            {player.user_id === tournament.host_id && <span className="ml-2 text-[10px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Host</span>}
                          </p>
                          <p className="text-[10px] text-cyan-500 font-mono truncate">
                            App ID: {player.profiles?.display_name} | Game ID: {player.in_game_id}
                          </p>
                        </div>
                        
                        {isHost && player.user_id !== currentId && tournament.status === "upcoming" && (
                          <div className="flex gap-1 z-10 relative shrink-0">
                            <button onClick={(e) => { e.preventDefault(); handleKickPlayer(player.user_id, player.profiles?.display_name); }} className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white border border-neutral-700"><UserMinus className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.preventDefault(); handleNoShowPenalty(player.user_id, player.profiles?.display_name); }} className="p-2 bg-red-900/30 text-red-500 rounded-lg hover:bg-red-600 hover:text-white border border-red-500/20"><Flag className="w-4 h-4" /></button>
                          </div>
                        )}
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {!hasAccess && !isHost ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                <Lock className="w-16 h-16 text-cyan-500 mb-6 opacity-20" />
                <h2 className="text-3xl font-black mb-4">Lobby Restricted</h2>
                {tournament.isPrivate && showPasswordBox && (
                  <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="mb-4 p-3 bg-neutral-950 border border-neutral-700 rounded-xl text-center" />
                )}
                <button onClick={handleJoinTournament} disabled={isJoining} className="px-10 py-4 bg-cyan-600 text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform">{isJoining ? "Joining..." : "Join Now"}</button>
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

            {/* 🔥 NEW AI REPORT WITH K/D/A + DAMAGE TABLE 🔥 */}
            {tournament.ai_stats && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-indigo-950/30 border-2 border-indigo-500/40 rounded-3xl p-8 shadow-[0_0_30px_rgba(99,102,241,0.1)] mt-4">
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-indigo-500/30 pb-4 gap-4">
                  <h3 className="text-2xl font-black text-indigo-400 flex items-center gap-3">
                    <BrainCircuit className="w-8 h-8" /> Final AI Match Report
                  </h3>
                  <div className="flex items-center gap-3">
                    {isHost && (
                      <button 
                        onClick={handleRetryAI}
                        disabled={isRetryingAI}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
                      >
                        {isRetryingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Re-Scan
                      </button>
                    )}
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider ${tournament.ai_confidence && tournament.ai_confidence > 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                      {tournament.ai_confidence || 0}% Confident
                    </span>
                  </div>
                </div>

                {tournament.ai_stats.summary && (
                  <div className="mb-6 bg-black/50 border border-neutral-800 rounded-xl p-4 font-mono text-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                      <Terminal className="w-4 h-4" /> <span className="font-bold tracking-widest text-xs uppercase">AI Processing Log</span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed pl-2">{tournament.ai_stats.summary}</p>
                  </div>
                )}

                {tournament.ai_tampering_flag && (
                  <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6 font-bold">
                    <ShieldAlert className="w-6 h-6 shrink-0" /> 
                    Warning: The AI detected potential image tampering or editing in the screenshot!
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-neutral-950/80 rounded-2xl p-6 border border-neutral-800 flex items-center gap-6 justify-center">
                    <Trophy className="w-12 h-12 text-yellow-500" />
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-1">Detected Winner</p>
                      <p className="text-2xl font-black text-white">{tournament.ai_stats.winner || "Unknown"}</p>
                    </div>
                  </div>

                  {/* 🔥 K/D/A & DAMAGE TABLE 🔥 */}
                  {tournament.ai_stats.players && tournament.ai_stats.players.length > 0 ? (
                    <div className="bg-neutral-950/80 rounded-2xl overflow-hidden border border-neutral-800">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900 text-neutral-400">
                          <tr>
                            <th className="px-5 py-4 font-bold uppercase text-xs tracking-wider">Player</th>
                            <th className="px-5 py-4 font-bold uppercase text-xs tracking-wider text-center">K / D / A</th>
                            <th className="px-5 py-4 font-bold uppercase text-xs tracking-wider text-right">Damage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                          {tournament.ai_stats.players.map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-neutral-900/50 transition-colors">
                              <td className="px-5 py-4 font-bold text-white text-base">{p.name}</td>
                              <td className="px-5 py-4 font-black text-neutral-300 text-center tracking-widest">
                                <span className="text-emerald-400">{p.kills ?? 0}</span> / <span className="text-red-400">{p.deaths ?? 0}</span> / <span className="text-yellow-400">{p.assists ?? 0}</span>
                              </td>
                              <td className="px-5 py-4 font-black text-cyan-400 text-right text-lg">{p.damage ?? (p.score ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-neutral-950/80 rounded-2xl border border-neutral-800 flex items-center justify-center p-6">
                      <p className="text-neutral-500 italic">No player stats extracted.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}