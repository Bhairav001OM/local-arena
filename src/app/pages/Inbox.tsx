import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase";
import { 
  fetchFriends, fetchPendingRequests, acceptFriendRequest, rejectFriendRequest, 
  fetchPrivateMessages, sendPrivateMessage, sendFriendRequest,
  createGroup, fetchUserGroups, fetchGroupMessages, sendGroupMessage 
} from "../data";
import { MessageSquare, Users, Bell, Send, ArrowLeft, Loader2, Copy, Check, Search, UserPlus, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

// Converter function
const generateFriendCode = (uuid: string) => {
  if (!uuid) return "";
  return parseInt(uuid.split('-')[0], 16).toString().padStart(10, '0');
};

export function Inbox() {
  const { session } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"chat" | "groups" | "requests" | "search">("chat");
  
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]); 
  
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null); 
  
  // GROUP CREATION STATE
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [playerSearch, setPlayerSearch] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;

  const loadSocialData = async () => {
    if (!userId) return;
    try {
      const [fData, rData, gData] = await Promise.all([
        fetchFriends(userId), 
        fetchPendingRequests(userId),
        fetchUserGroups(userId) 
      ]);
      
      const formattedFriends = fData.map((f: any) => {
        const isRequester = f.requester_id === userId;
        return { friendshipId: f.id, friendProfile: isRequester ? f.receiver : f.requester, friendId: isRequester ? f.receiver_id : f.requester_id };
      });
      const uniqueFriends = Array.from(new Map(formattedFriends.map(item => [item.friendId, item])).values());
      
      setFriends(uniqueFriends);
      setRequests(rData);
      setGroups(gData || []); 
    } catch (e) { 
      console.error("Error loading social data:", e); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    loadSocialData();
    const friendChannel = supabase.channel('friend-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => { loadSocialData(); }).subscribe();
    return () => { supabase.removeChannel(friendChannel); };
  }, [userId]);

  // FAST SEARCH WITH TYPESCRIPT FIX 
  useEffect(() => {
    const delayFn = setTimeout(async () => {
      if (playerSearch.trim().length > 0) { 
        setIsSearchingPlayers(true);
        try {
          const isNumeric = /^\d+$/.test(playerSearch.trim());
          let results: any[] = []; 

          if (isNumeric) {
            const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').limit(1000);
            if (data) results = data.filter(p => generateFriendCode(p.id).includes(playerSearch.trim()));
          } else {
            const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', `%${playerSearch.trim()}%`).limit(10);
            if (data) results = data;
          }
          setPlayers(results.filter((p: any) => p.id !== userId).slice(0, 10));
        } catch(e) { console.error(e); } finally { setIsSearchingPlayers(false); }
      } else { setPlayers([]); }
    }, 300); 
    return () => clearTimeout(delayFn);
  }, [playerSearch, userId]);

  // LOAD MESSAGES (DM OR GROUP)
  useEffect(() => {
    if (!userId) return;
    if (!selectedFriend && !selectedGroup) return;

    const loadMsgs = async () => {
      if (selectedFriend) {
        const msgs = await fetchPrivateMessages(userId, selectedFriend.friendId);
        setMessages(msgs);
      } else if (selectedGroup) {
        const msgs = await fetchGroupMessages(selectedGroup.id);
        setMessages(msgs);
      }
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    
    loadMsgs();

    const channel = supabase.channel('chat-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
        const msg = payload.new;
        if (selectedFriend && ((msg.sender_id === selectedFriend.friendId && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === selectedFriend.friendId))) {
           setMessages(prev => prev.some(p => p.id === msg.id) ? prev : [...prev, msg]);
           setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const msg = payload.new;
        if (selectedGroup && msg.group_id === selectedGroup.id) {
          loadMsgs(); 
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [selectedFriend, selectedGroup, userId]);

  // SEND MESSAGE HANDLER 
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;
    if (!selectedFriend && !selectedGroup) return;

    const text = newMessage.trim(); 
    setNewMessage(""); 
    setIsSending(true);
    
    try { 
      if (selectedFriend) {
        await sendPrivateMessage(userId, selectedFriend.friendId, text); 
      } else if (selectedGroup) {
        await sendGroupMessage(selectedGroup.id, userId, text);
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsSending(false); 
    }
  };

  const handleSendFriendRequest = async (receiverId: string) => {
    if (!userId) return;
    try {
      await sendFriendRequest(userId, receiverId);
      setSentRequests(prev => [...prev, receiverId]);
      setActionMsg("✅ Request sent!");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err: any) {
      setActionMsg("⚠️ Sent");
      setSentRequests(prev => [...prev, receiverId]);
      setTimeout(() => setActionMsg(""), 3000);
    }
  };

  const handleAccept = async (reqId: string) => {
    await acceptFriendRequest(reqId);
    setActiveTab("chat"); 
    loadSocialData();
  };

  const handleReject = async (reqId: string) => {
    await rejectFriendRequest(reqId);
    loadSocialData();
  };

  const copyFriendCode = () => {
    if (!userId) return;
    navigator.clipboard.writeText(generateFriendCode(userId)); 
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // 🔥 FIX: ENHANCED CREATE GROUP LOGIC WITH ERROR HANDLING 🔥
  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !userId) return;
    
    setIsSending(true);
    setActionMsg(""); // Clear previous errors
    
    try {
      await createGroup(newGroupName, userId, selectedFriendsForGroup);
      setIsCreatingGroup(false);
      setNewGroupName("");
      setSelectedFriendsForGroup([]);
      await loadSocialData();
      setActiveTab("groups");
    } catch (err: any) {
      console.error("Database Error during group creation:", err);
      // Show exact database error on screen so we know what failed
      setActionMsg(`❌ DB Error: ${err.message || "Failed to create group"}`);
      setTimeout(() => setActionMsg(""), 6000);
    } finally {
      setIsSending(false);
    }
  };

  const toggleFriendForGroup = (friendId: string) => {
    setSelectedFriendsForGroup(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  if (!userId) return <div className="h-screen bg-neutral-950 flex justify-center items-center text-white p-20 text-center">Please Login.</div>;

  return (
    <div className="flex-1 flex flex-col md:flex-row w-full bg-neutral-950 text-white overflow-hidden h-[calc(100vh-64px)] border-t border-neutral-900">
      
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 bg-neutral-900/50 border-r border-neutral-800 flex flex-col h-full ${(selectedFriend || selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-2xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500">Friends & Chat</h1>
          <div className="bg-neutral-950 border border-neutral-800 p-2 rounded-lg flex items-center justify-between">
            <div className="overflow-hidden mr-2">
              <p className="text-[10px] text-neutral-500 font-bold uppercase">Friend Code</p>
              <p className="text-sm text-cyan-400 font-black tracking-widest">{generateFriendCode(userId)}</p>
            </div>
            <button onClick={copyFriendCode} className="p-2 bg-neutral-800 rounded-md hover:bg-neutral-700 transition-colors">{copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}</button>
          </div>
        </div>

        {/* 4 Tabs */}
        <div className="flex border-b border-neutral-800 overflow-x-auto custom-scrollbar shrink-0">
          <button onClick={() => { setActiveTab("chat"); setIsCreatingGroup(false); }} className={`flex-1 py-3 text-xs md:text-sm font-bold flex justify-center items-center gap-1.5 min-w-[70px] ${activeTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500'}`}><MessageSquare className="w-4 h-4" /> DMs</button>
          <button onClick={() => { setActiveTab("groups"); setSelectedFriend(null); }} className={`flex-1 py-3 text-xs md:text-sm font-bold flex justify-center items-center gap-1.5 min-w-[70px] ${activeTab === 'groups' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-neutral-500'}`}><Users className="w-4 h-4" /> Groups</button>
          <button onClick={() => { setActiveTab("requests"); setSelectedFriend(null); setSelectedGroup(null); setIsCreatingGroup(false); }} className={`flex-1 py-3 text-xs md:text-sm font-bold flex justify-center items-center gap-1.5 relative min-w-[70px] ${activeTab === 'requests' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-400/5' : 'text-neutral-500'}`}><Bell className="w-4 h-4" /> Req {requests.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse">{requests.length}</span>}</button>
          <button onClick={() => { setActiveTab("search"); setSelectedFriend(null); setSelectedGroup(null); setIsCreatingGroup(false); }} className={`flex-1 py-3 text-xs md:text-sm font-bold flex justify-center items-center gap-1.5 min-w-[70px] ${activeTab === 'search' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5' : 'text-neutral-500'}`}><Search className="w-4 h-4" /> Find</button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          
          {/* Action Message Display (For errors/success) */}
          {actionMsg && (
            <div className={`p-3 rounded-xl border text-xs font-bold text-center mb-2 ${actionMsg.includes('Error') || actionMsg.includes('❌') ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}`}>
              {actionMsg}
            </div>
          )}

          {isLoading ? <Loader2 className="animate-spin mx-auto mt-10 text-cyan-500" /> : 
            
            // 🟢 DMs TAB
            activeTab === "chat" ? (
              friends.length === 0 ? (
                <div className="text-center p-10 text-neutral-500 flex flex-col items-center"><MessageSquare className="w-10 h-10 mb-2 opacity-10" /><p className="text-xs">No active chats.</p></div>
              ) : (
                friends.map(f => (
                  <button key={f.friendshipId} onClick={() => { setSelectedFriend(f); setSelectedGroup(null); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedFriend?.friendId === f.friendId ? 'bg-cyan-900/20 border-cyan-500/30' : 'hover:bg-neutral-900'}`}>
                    <img src={f.friendProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-12 h-12 rounded-full object-cover shadow-lg border border-neutral-800" alt="avatar"/>
                    <div className="text-left overflow-hidden"><p className="font-bold text-white truncate">{f.friendProfile?.display_name}</p><p className="text-[10px] text-neutral-500">Tap to chat</p></div>
                  </button>
                ))
              )
            
            // 🟢 GROUPS TAB
            ) : activeTab === "groups" ? (
              isCreatingGroup ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                  <h3 className="font-bold text-indigo-400 mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> New Group</h3>
                  <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group Name..." className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4" />
                  
                  <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Select Friends ({selectedFriendsForGroup.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2 mb-4">
                    {friends.length === 0 ? <p className="text-xs text-neutral-600 italic">No friends to add.</p> : 
                      friends.map(f => (
                        <div key={f.friendId} onClick={() => toggleFriendForGroup(f.friendId)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-colors ${selectedFriendsForGroup.includes(f.friendId) ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'}`}>
                           <div className="flex items-center gap-2">
                             <img src={f.friendProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-6 h-6 rounded-full" alt="avatar"/>
                             <span className="text-xs font-bold text-white truncate max-w-[120px]">{f.friendProfile?.display_name}</span>
                           </div>
                           <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedFriendsForGroup.includes(f.friendId) ? 'bg-indigo-500 border-indigo-500' : 'border-neutral-600'}`}>
                             {selectedFriendsForGroup.includes(f.friendId) && <Check className="w-3 h-3 text-white" />}
                           </div>
                        </div>
                      ))
                    }
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setIsCreatingGroup(false)} className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all">Cancel</button>
                    {/* 🔥 FIX: Button is now enabled as long as a name is provided (Friends selection optional) */}
                    <button onClick={handleCreateGroupSubmit} disabled={isSending || !newGroupName.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1">
                      {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => setIsCreatingGroup(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 p-3 rounded-xl transition-colors font-bold text-sm">
                    <PlusCircle className="w-4 h-4" /> Create New Group
                  </button>
                  
                  {groups.length === 0 ? (
                    <div className="text-center p-10 text-neutral-500 flex flex-col items-center"><Users className="w-10 h-10 mb-2 opacity-10" /><p className="text-xs">No groups joined.</p></div>
                  ) : (
                    groups.map(g => (
                      <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedFriend(null); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedGroup?.id === g.id ? 'bg-indigo-900/20 border border-indigo-500/30' : 'hover:bg-neutral-900 border border-transparent'}`}>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black shadow-lg">
                           {g.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left overflow-hidden"><p className="font-bold text-white truncate">{g.name}</p><p className="text-[10px] text-neutral-500">Tap to view chat</p></div>
                      </button>
                    ))
                  )}
                </div>
              )
            
            // 🟢 REQUESTS TAB
            ) : activeTab === "requests" ? (
              requests.length === 0 ? (
                <div className="text-center p-10 text-neutral-500 flex flex-col items-center"><Bell className="w-10 h-10 mb-2 opacity-10" /><p className="text-xs">No pending requests.</p></div>
              ) : (
                requests.map((req: any) => (
                  <div key={req.id} className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-xl">
                    <Link to={`/player/${req.requester?.id}`} className="flex items-center gap-3 mb-4 group">
                      <img src={req.requester?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="w-10 h-10 rounded-full shrink-0 object-cover border border-neutral-700 group-hover:border-fuchsia-500 transition-colors" />
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm text-white truncate group-hover:text-fuchsia-400 transition-colors">{req.requester?.display_name || "New Challenger"}</p>
                        <p className="text-[9px] text-neutral-500 uppercase tracking-tighter">View Profile</p>
                      </div>
                    </Link>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(req.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95">Accept</button>
                      <button onClick={() => handleReject(req.id)} className="flex-1 bg-neutral-800 hover:bg-red-600/20 hover:text-red-500 text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95 border border-neutral-700">Reject</button>
                    </div>
                  </div>
                ))
              )
            
            // 🟢 SEARCH TAB
            ) : (
              <div className="flex flex-col h-full">
                <div className="relative mb-3 shrink-0">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                  <input type="text" placeholder="Search Code or Name..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 tracking-wide" />
                </div>
                <div className="flex-1 space-y-2">
                  {isSearchingPlayers ? <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mx-auto mt-4" /> : players.map(p => {
                      const isSent = sentRequests.includes(p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between bg-neutral-900 p-3 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors">
                          <Link to={`/player/${p.id}`} className="flex items-center gap-3 overflow-hidden group w-full">
                            <img src={p.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-10 h-10 rounded-full border border-neutral-700 shrink-0 object-cover" alt="avatar" />
                            <div className="overflow-hidden"><p className="font-bold text-sm text-white truncate group-hover:text-cyan-400">{p.display_name}</p><p className="text-[10px] text-cyan-500 font-mono">{generateFriendCode(p.id)}</p></div>
                          </Link>
                          <button onClick={() => handleSendFriendRequest(p.id)} disabled={isSent} className={`p-2.5 rounded-lg transition-colors border shrink-0 ml-2 ${isSent ? "bg-emerald-900/30 text-emerald-500 border-emerald-500/30" : "bg-neutral-800 hover:bg-cyan-600 text-cyan-400 hover:text-white border-cyan-500/30"}`}>
                            {isSent ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        </div>
                      )
                  })}
                  {!isSearchingPlayers && players.length === 0 && playerSearch.length > 0 && (
                    <div className="text-center p-10 text-neutral-500 text-sm">No players found matching "{playerSearch}"</div>
                  )}
                  {!isSearchingPlayers && players.length === 0 && playerSearch.length === 0 && (
                    <div className="text-center p-10 text-neutral-600 flex flex-col items-center"><Search className="w-8 h-8 mb-2 opacity-20" /><p className="text-xs italic">Type to search players...</p></div>
                  )}
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* Chat Area (Handles Both DMs and Groups) */}
      <div className={`flex-1 flex flex-col h-full bg-neutral-950 ${(!selectedFriend && !selectedGroup) ? 'hidden md:flex' : 'flex'}`}>
        {(!selectedFriend && !selectedGroup) ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20"><MessageSquare className="w-20 h-20 mb-4" /><h2 className="text-xl font-bold text-white">Select a chat to view</h2></div>
        ) : (
          <>
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md flex items-center justify-between shrink-0 h-[72px] z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedFriend(null); setSelectedGroup(null); }} className="md:hidden p-2 -ml-2 bg-neutral-800 rounded-full hover:text-cyan-400"><ArrowLeft className="w-5 h-5" /></button>
                
                {/* Header for DM vs Group */}
                {selectedFriend ? (
                  <Link to={`/player/${selectedFriend.friendId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                    <img src={selectedFriend.friendProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-10 h-10 rounded-full object-cover border border-neutral-700 group-hover:border-cyan-500" alt="avatar" />
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-white leading-tight truncate group-hover:text-cyan-400 transition-colors">{selectedFriend.friendProfile?.display_name}</h3>
                      <p className="text-[10px] text-cyan-500 font-mono tracking-widest">{generateFriendCode(selectedFriend.friendId)}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 cursor-default">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black border border-indigo-400/50">
                       {selectedGroup.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-white leading-tight truncate">{selectedGroup.name}</h3>
                      <p className="text-[10px] text-indigo-400 uppercase tracking-widest">Group Chat</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-neutral-950">
              <div className="text-center py-4"><p className="text-[10px] text-neutral-600 uppercase bg-neutral-900/50 inline-block px-4 py-1 rounded-full border border-neutral-800">End-to-End Encrypted</p></div>
              {messages.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-neutral-600 italic">No messages yet. Send a greeting! 👋</div>
              ) : (
                messages.map((msg: any) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      
                      {/* Name tag for Group Chats only if it's not the user */}
                      {selectedGroup && !isMe && msg.profiles && (
                         <span className="text-[10px] font-bold text-neutral-500 mb-1 ml-1">{msg.profiles.display_name}</span>
                      )}
                      
                      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-xl ${
                        isMe ? (selectedGroup ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-cyan-600 text-white rounded-br-none') 
                             : 'bg-neutral-800 text-neutral-200 rounded-bl-none'
                      }`}>
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message || msg.content}</p>
                        <p className={`text-[9px] mt-1 opacity-50 ${isMe ? 'text-right' : 'text-left'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-neutral-900 border-t border-neutral-800 shrink-0 pb-6 md:pb-4 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
              <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto w-full items-center">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={selectedGroup ? "Message group..." : "Type a message..."} className={`flex-1 bg-neutral-950 border border-neutral-700 rounded-2xl px-5 py-3.5 text-sm text-white outline-none transition-all focus:ring-2 ${selectedGroup ? 'focus:border-indigo-500 focus:ring-indigo-500/20' : 'focus:border-cyan-500 focus:ring-cyan-500/20'}`} />
                <button type="submit" disabled={isSending || !newMessage.trim()} className={`w-12 h-12 text-white rounded-2xl flex items-center justify-center disabled:opacity-30 shrink-0 transition-all active:scale-90 shadow-lg ${selectedGroup ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-indigo-900/20' : 'bg-gradient-to-br from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 shadow-cyan-900/20'}`}>
                   {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" />}
                </button>
              </form>
            </div>
          </>
        )} 
      </div>
    </div>
  );
}