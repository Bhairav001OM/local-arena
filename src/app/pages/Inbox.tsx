import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../utils/supabase";
import { fetchFriends, fetchPendingRequests, acceptFriendRequest, rejectFriendRequest, fetchPrivateMessages, sendPrivateMessage } from "../data";
import { MessageSquare, Users, Bell, Send, ArrowLeft, Loader2, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Inbox() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"chat" | "requests">("chat");
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userId = session?.user?.id;

  const loadSocialData = async () => {
    if (!userId) return;
    try {
      const [fData, rData] = await Promise.all([
        fetchFriends(userId),
        fetchPendingRequests(userId)
      ]);
      
      const formattedFriends = fData.map((f: any) => {
        const isRequester = f.requester_id === userId;
        return {
          friendshipId: f.id,
          friendProfile: isRequester ? f.receiver : f.requester,
          friendId: isRequester ? f.receiver_id : f.requester_id
        };
      });
      
      // 🔥 THE FIX: Yahan duplicates remove ho jayenge 🔥
      const uniqueFriends = Array.from(new Map(formattedFriends.map(item => [item.friendId, item])).values());
      
      setFriends(uniqueFriends);
      setRequests(rData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    setIsLoading(true);
    loadSocialData();

    const friendChannel = supabase.channel('friend-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
        loadSocialData();
      }).subscribe();

    return () => { supabase.removeChannel(friendChannel); };
  }, [userId]);

  useEffect(() => {
    if (!userId || !selectedFriend) return;
    
    const loadMsgs = async () => {
      const msgs = await fetchPrivateMessages(userId, selectedFriend.friendId);
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    loadMsgs();

    const channel = supabase.channel('private-chat')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'private_messages'
      }, (payload) => {
        const msg = payload.new;
        if (
          (msg.sender_id === selectedFriend.friendId && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === selectedFriend.friendId)
        ) {
           setMessages(prev => {
             if (prev.some(p => p.id === msg.id)) return prev;
             return [...prev, msg];
           });
           setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedFriend, userId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId || !selectedFriend) return;
    
    const text = newMessage.trim();
    setNewMessage("");
    setIsSending(true);
    
    try {
      await sendPrivateMessage(userId, selectedFriend.friendId, text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async (reqId: string) => {
    await acceptFriendRequest(reqId);
    setActiveTab("chat"); 
  };

  const handleReject = async (reqId: string) => {
    await rejectFriendRequest(reqId);
  };

  const copyFriendCode = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!userId) return <div className="h-full bg-neutral-950 flex justify-center items-center text-white">Please Login to view your Inbox.</div>;

  return (
    <div className="flex-1 flex flex-col md:flex-row w-full bg-neutral-950 text-white overflow-hidden border-t border-neutral-900">
      
      {/* LEFT SIDEBAR (Friends List) */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 bg-neutral-900/50 border-r border-neutral-800 flex flex-col h-full ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 shrink-0">
          <h1 className="text-2xl font-black mb-3">Messages</h1>
          <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded-lg flex items-center justify-between">
            <div className="overflow-hidden mr-2">
              <p className="text-[10px] text-neutral-500 font-bold uppercase mb-0.5">Your Friend Code</p>
              <p className="text-xs text-cyan-400 font-mono truncate select-all">{userId}</p>
            </div>
            <button onClick={copyFriendCode} className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors shrink-0">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 shrink-0">
          <button onClick={() => setActiveTab("chat")} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 ${activeTab === 'chat' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-neutral-500 hover:text-white'}`}>
            <MessageSquare className="w-4 h-4" /> Chats
          </button>
          <button onClick={() => setActiveTab("requests")} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 relative ${activeTab === 'requests' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-400/5' : 'text-neutral-500 hover:text-white'}`}>
            <Bell className="w-4 h-4" /> Requests
            {requests.length > 0 && <span className="absolute top-2 right-6 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{requests.length}</span>}
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-neutral-950/50">
          {isLoading ? (
             <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-cyan-500" /></div>
          ) : activeTab === "chat" ? (
            friends.length === 0 ? (
              <div className="text-center p-10 text-neutral-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No friends yet.<br/>Search players on Home to add!</p>
              </div>
            ) : (
              friends.map(f => (
                <button 
                  key={f.friendshipId}
                  onClick={() => setSelectedFriend(f)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${selectedFriend?.friendId === f.friendId ? 'bg-cyan-900/30 border border-cyan-500/30' : 'hover:bg-neutral-900 border border-neutral-800'}`}
                >
                  <img src={f.friendProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="w-12 h-12 rounded-full border border-neutral-700 shrink-0 object-cover" />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-white truncate">{f.friendProfile?.display_name || "Unknown Player"}</p>
                    <p className="text-xs text-neutral-500 truncate">Tap to open chat</p>
                  </div>
                </button>
              ))
            )
          ) : (
            requests.length === 0 ? (
              <div className="text-center p-10 text-neutral-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No pending requests.</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={req.requester?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="w-10 h-10 rounded-full shrink-0 object-cover" />
                    <p className="font-bold text-sm truncate">{req.requester?.display_name || "Unknown Player"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(req.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg transition-colors">Accept</button>
                    <button onClick={() => handleReject(req.id)} className="flex-1 bg-neutral-800 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">Reject</button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* RIGHT SIDE (Chat Box) */}
      <div className={`flex-1 flex flex-col h-full bg-neutral-950 relative ${!selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        {!selectedFriend ? (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 p-4 text-center">
            <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
            <h2 className="text-xl font-bold text-neutral-600">Select a friend to start chatting</h2>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-3 shrink-0 h-[72px]">
              <button onClick={() => setSelectedFriend(null)} className="md:hidden p-2 bg-neutral-800 rounded-full hover:text-cyan-400">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img src={selectedFriend.friendProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-10 h-10 rounded-full object-cover border border-neutral-700" alt="avatar" />
              <div className="overflow-hidden">
                <h3 className="font-bold text-white leading-tight truncate">{selectedFriend.friendProfile?.display_name}</h3>
                <p className="text-[10px] text-cyan-400 font-mono truncate">Code: {selectedFriend.friendId}</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-neutral-950">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-neutral-600 italic">Say hi to {selectedFriend.friendProfile?.display_name}!</div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl ${isMe ? 'bg-cyan-600 text-white rounded-br-sm' : 'bg-neutral-800 text-neutral-200 rounded-bl-sm'}`}>
                        <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-neutral-900 border-t border-neutral-800 shrink-0 pb-6 md:pb-4">
              <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto w-full">
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder="Type a message..." 
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-full px-5 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none" 
                />
                <button type="submit" disabled={isSending || !newMessage.trim()} className="w-12 h-12 bg-cyan-600 text-white rounded-full flex items-center justify-center hover:bg-cyan-500 disabled:opacity-50 shrink-0 transition-transform active:scale-95">
                  <Send className="w-5 h-5 -ml-1" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

    </div>
  );
}