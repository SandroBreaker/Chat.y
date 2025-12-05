import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Message, Profile, ScreenType } from './types';
import { ChevronLeft, Video, Info, Phone, Mail, Search, NewMessage, Pencil, X } from './components/Icons';
import MessageBubble from './components/Chat/MessageBubble';
import InputArea from './components/Chat/InputArea';
import Auth from './components/Auth';
import { SUGGESTED_PHOTOS } from './constants';

// Som de alerta (beep curto e agradável para NUDGE)
const ALERT_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
// Som de mensagem normal (pop suave estilo iOS)
const MSG_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [screen, setScreen] = useState<ScreenType>('home');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Data States
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  
  // UI States
  const [activeContextMenu, setActiveContextMenu] = useState<number | string | null>(null);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  // Audio State (Single Source of Truth)
  const [playingAudioId, setPlayingAudioId] = useState<number | string | null>(null);
  
  // Profile Editing States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  // New Features States
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const alertAudioRef = useRef<HTMLAudioElement>(new Audio(ALERT_SOUND_URL));
  const msgAudioRef = useRef<HTMLAudioElement>(new Audio(MSG_SOUND_URL));
  const broadcastChannelRef = useRef<any>(null);
  
  // -- Initialization & Auth --
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => subscription.unsubscribe();
  }, []);

  // -- Fetch Profiles & Last Messages --
  useEffect(() => {
    if (session?.user) {
      const fetchData = async () => {
        // 1. Fetch Contacts
        const { data: contactsData } = await supabase
          .from('profilesMSP')
          .select('*')
          .neq('id', session.user.id);
        
        if (contactsData) setContacts(contactsData);

        // 2. Fetch My Profile
        const { data: myData } = await supabase
          .from('profilesMSP')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (myData) setCurrentUserProfile(myData);

        // 3. Fetch Recent Messages (Snapshot for Home Screen)
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
          .order('created_at', { ascending: false })
          .limit(200);

        if (recentMsgs) {
          const lastMsgMap: Record<string, Message> = {};
          recentMsgs.forEach((msg: Message) => {
             const partnerId = msg.sender_id === session.user.id ? msg.recipient_id : msg.sender_id;
             if (!lastMsgMap[partnerId]) {
               lastMsgMap[partnerId] = msg;
             }
          });
          setLastMessages(lastMsgMap);
        }
      };
      fetchData();
    }
  }, [session]);

  // -- Computed Contacts (Sorted by Recent Activity) --
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const msgA = lastMessages[a.id];
      const msgB = lastMessages[b.id];
      const timeA = msgA ? new Date(msgA.created_at).getTime() : 0;
      const timeB = msgB ? new Date(msgB.created_at).getTime() : 0;
      return timeB - timeA; // Descending
    });
  }, [contacts, lastMessages]);

  // -- Fetch & Subscribe Messages & Presence --
  useEffect(() => {
    if (!session?.user) return;

    // Fetch history only if we have an active chat
    if (activeChatId) {
      const fetchHistory = async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},recipient_id.eq.${session.user.id})`)
          .order('created_at', { ascending: true });

        if (data) setMessages(data);
      };
      fetchHistory();
    }

    // Subscribe to DB Changes
    const channel = supabase
      .channel(`global_messages:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'messages',
          // Receives messages where I am the recipient
          filter: `recipient_id=eq.${session.user.id}`, 
        },
        (payload) => {
           if (payload.eventType === 'INSERT') {
             const newMessage = payload.new as Message;
             
             // Update Last Messages for Home Screen
             setLastMessages(prev => ({ ...prev, [newMessage.sender_id]: newMessage }));

             // --- Notification Logic ---
             if (newMessage.sender_id !== session.user.id) {
                const playSound = async (audio: HTMLAudioElement) => {
                  try {
                    audio.currentTime = 0;
                    await audio.play();
                  } catch (e) { /* Autoplay handler */ }
                };

                if (newMessage.content === '[NUDGE]') {
                  playSound(alertAudioRef.current);
                  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
                  
                  // Trigger Shake Animation
                  setIsShaking(true);
                  setTimeout(() => setIsShaking(false), 600);
                } else {
                  playSound(msgAudioRef.current);
                }

                if (document.visibilityState === 'hidden' || Notification.permission === 'granted') {
                   const sender = contacts.find(c => c.id === newMessage.sender_id);
                   const senderName = sender?.username || 'New Message';
                   let bodyText = newMessage.content;
                   if (bodyText.startsWith('[IMAGE]')) bodyText = '📷 Photo';
                   else if (bodyText.startsWith('[AUDIO]')) bodyText = '🎤 Audio';
                   else if (bodyText === '[NUDGE]') bodyText = '🔔 Nudge!';

                   try {
                     new Notification(senderName, { body: bodyText, silent: true });
                   } catch (e) { /* ignore */ }
                }

                // If chat active, append
                if (activeChatId === newMessage.sender_id) {
                   setMessages(prev => [...prev, newMessage]);
                   // Also clear typing indicator for this user when they send a message
                   setTypingUsers(prev => ({ ...prev, [newMessage.sender_id]: false }));
                }
             }
           } else if (payload.eventType === 'UPDATE') {
             if (activeChatId) {
                setMessages(prev => prev.map(msg => 
                  msg.id === payload.new.id ? payload.new as Message : msg
                ));
             }
           }
        }
      )
      .on(
        'postgres_changes',
        {
           event: '*', 
           schema: 'public',
           table: 'messages',
           filter: `sender_id=eq.${session.user.id}`
        },
        (payload) => {
           if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as Message;
              // Update Last Messages for Home Screen
              setLastMessages(prev => ({ ...prev, [newMessage.recipient_id]: newMessage }));

              if (activeChatId === newMessage.recipient_id) {
                setMessages(prev => {
                  if (prev.find(m => m.id === payload.new.id)) return prev;
                  return [...prev, payload.new as Message];
                });
              }
           } else if (payload.eventType === 'UPDATE') {
              if (activeChatId) {
                setMessages(prev => prev.map(msg => 
                   msg.id === payload.new.id ? payload.new as Message : msg
                ));
              }
           }
        }
      )
      .subscribe();

    // --- Typing Indicators (Broadcast Channel) ---
    // Use a shared channel for signaling typing status
    const signalChannel = supabase.channel('global_signaling');
    
    signalChannel
      .on(
        'broadcast',
        { event: 'typing' },
        ({ payload }: { payload: { from: string, to: string, isTyping: boolean } }) => {
          if (payload.to === session.user.id) {
             setTypingUsers(prev => ({ ...prev, [payload.from]: payload.isTyping }));
          }
        }
      )
      .subscribe();

    broadcastChannelRef.current = signalChannel;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(signalChannel);
    };
  }, [activeChatId, session, contacts]); 

  // Auto-scroll logic (Key for keyboard responsiveness)
  const scrollToBottom = () => {
    // Timeout helps wait for keyboard animation
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (screen === 'chat') {
      scrollToBottom();
      
      // Listen for visual viewport resize (keyboard open/close)
      const handleResize = () => {
        scrollToBottom();
      };

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
      } else {
        window.addEventListener('resize', handleResize);
      }

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleResize);
          window.visualViewport.removeEventListener('scroll', handleResize);
        } else {
          window.removeEventListener('resize', handleResize);
        }
      };
    }
  }, [screen, messages, typingUsers]); // Re-scroll when typing indicator appears

  // -- Profile Update Handlers --
  const openEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditName(profile.username || '');
    setIsEditProfileOpen(true);
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editingProfile) return;
    
    setIsUploadingProfile(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '')) {
        alert("Invalid file type");
        setIsUploadingProfile(false);
        return;
    }

    const fileName = `avatar_${editingProfile.id}_${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('files_chat.y')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('files_chat.y').getPublicUrl(fileName);
      setEditingProfile({ ...editingProfile, avatar_url: data.publicUrl });
      
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const saveProfileChanges = async () => {
    if (!editingProfile) return;

    try {
      const { error } = await supabase
        .from('profilesMSP')
        .update({ 
          username: editName,
          avatar_url: editingProfile.avatar_url
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      if (editingProfile.id === session.user.id) {
        setCurrentUserProfile({ ...editingProfile, username: editName });
      } else {
        setContacts(prev => prev.map(c => c.id === editingProfile.id ? { ...c, username: editName, avatar_url: editingProfile.avatar_url } : c));
      }
      setIsEditProfileOpen(false);
    } catch (error) {
      alert("Failed to save profile");
    }
  };

  // -- Chat Handlers --
  const handleOpenChat = (contactId: string) => {
    setActiveChatId(contactId);
    setScreen('chat');
    setPlayingAudioId(null);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeChatId || !session?.user) return;

    const newMessagePayload = {
      content: text,
      sender_id: session.user.id,
      recipient_id: activeChatId,
      is_read: false
    };
    
    // Optimistic UI updates could go here, but focusing on robustness for now
    
    const { error } = await supabase
      .from('messages')
      .insert([newMessagePayload]);

    if (error) {
       console.error("Failed to send", error);
       alert("Error sending message");
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeChatId || !session?.user || !broadcastChannelRef.current) return;
    
    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { 
        from: session.user.id, 
        to: activeChatId,
        isTyping 
      }
    });
  };

  const handleReaction = async (messageId: number | string, emoji: string) => {
    if (!session?.user) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions ? { ...message.reactions } : {};
    currentReactions[session.user.id] = emoji;

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, reactions: currentReactions } : m
    ));

    await supabase
      .from('messages')
      .update({ reactions: currentReactions })
      .eq('id', messageId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setScreen('home');
    setContacts([]);
    setMessages([]);
    setLastMessages({});
  };

  // -- Format Time Helper --
  const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  const getActiveProfile = () => contacts.find(c => c.id === activeChatId);

  // -- Renders --

  if (!session) {
    return (
       <div className="max-w-md mx-auto h-full relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator">
          <Auth onAuthSuccess={() => {}} />
       </div>
    );
  }

  const renderEditProfileModal = () => (
    isEditProfileOpen && editingProfile && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-ios-gray w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scale-press">
           <div className="p-4 border-b border-ios-separator flex justify-between items-center bg-ios-lightGray/30">
              <button onClick={() => setIsEditProfileOpen(false)}><X /></button>
              <h3 className="text-white font-semibold">Edit Profile</h3>
              <button onClick={saveProfileChanges} className="text-ios-blue font-bold">Save</button>
           </div>
           <div className="p-6 flex flex-col items-center gap-6">
              <div className="relative group">
                 <img 
                   src={editingProfile.avatar_url || `https://ui-avatars.com/api/?name=${editingProfile.username}`} 
                   className="w-24 h-24 rounded-full object-cover border-4 border-ios-lightGray"
                 />
                 <button 
                   onClick={() => profileFileInputRef.current?.click()}
                   className="absolute bottom-0 right-0 bg-ios-blue text-white p-1.5 rounded-full border-4 border-ios-gray shadow-md"
                 >
                    <Pencil />
                 </button>
                 <input 
                   ref={profileFileInputRef}
                   type="file" 
                   hidden 
                   accept="image/*"
                   onChange={handleProfilePhotoUpload}
                 />
                 {isUploadingProfile && <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-xs">...</div>}
              </div>
              <div className="w-full space-y-2">
                 <label className="text-ios-textSecondary text-xs font-bold uppercase ml-1">Name</label>
                 <input 
                   type="text" 
                   value={editName}
                   onChange={(e) => setEditName(e.target.value)}
                   className="w-full bg-ios-lightGray border border-ios-separator rounded-xl px-4 py-3 text-white focus:border-ios-blue outline-none"
                 />
              </div>
           </div>
        </div>
      </div>
    )
  );

  const renderLightbox = () => {
    if (!lightboxImage) return null;
    return (
      <div 
        className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-fade-in"
        onClick={() => setLightboxImage(null)}
      >
         <button className="absolute top-safe right-4 p-4 text-white opacity-70 z-10">
            <X />
         </button>
         <img 
           src={lightboxImage} 
           className="max-w-full max-h-full object-contain pointer-events-none" 
           alt="Fullscreen" 
         />
      </div>
    );
  };

  const renderHomeScreen = () => (
    <div className="flex flex-col h-full bg-ios-black animate-slide-in-left">
      <div className="flex-none bg-ios-gray/90 backdrop-blur-md z-10 border-b border-ios-separator pt-safe">
        <header className="px-5 py-4 flex justify-between items-center">
          <button className="text-red-500 text-[17px] font-medium" onClick={handleLogout}>Sign Out</button>
          <div className="flex flex-col items-center">
            <h1 className="text-white font-bold text-[17px]">Messages</h1>
          </div>
          <button 
            className="text-ios-blue"
            onClick={() => setIsNewMessageModalOpen(true)}
          >
            <NewMessage />
          </button>
        </header>

        {currentUserProfile && (
           <div className="px-5 pb-4 flex items-center justify-between">
              <div className="text-3xl font-bold text-white">Chats</div>
              <div onClick={() => openEditProfile(currentUserProfile)}>
                 <img 
                   src={currentUserProfile.avatar_url} 
                   className="w-9 h-9 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                   alt="My Profile"
                 />
              </div>
           </div>
        )}

        <div className="px-4 pb-3">
           <div className="bg-ios-lightGray rounded-xl flex items-center px-3 py-2.5 gap-2">
              <div className="text-ios-textSecondary"><Search /></div>
              <input type="text" placeholder="Search" className="bg-transparent text-white placeholder-ios-textSecondary focus:outline-none w-full text-[17px]" />
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {sortedContacts.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-ios-textSecondary p-8 text-center">
             <p className="text-lg font-medium mb-2">No conversations</p>
             <p className="text-sm">Tap the icon above to start a new chat.</p>
           </div>
        )}
        <div className="pt-2">
          {sortedContacts.map(contact => {
            const lastMsg = lastMessages[contact.id];
            const isTyping = typingUsers[contact.id];
            
            let displayText = "Tap to start chatting";
            let displayTime = "";
            let isMedia = false;

            if (isTyping) {
               displayText = "Typing...";
            } else if (lastMsg) {
                if (lastMsg.content.startsWith('[IMAGE]')) { displayText = '📷 Photo'; isMedia = true; }
                else if (lastMsg.content.startsWith('[AUDIO]')) { displayText = '🎤 Audio'; isMedia = true; }
                else if (lastMsg.content === '[NUDGE]') { displayText = '🔔 Nudge'; isMedia = true; }
                else { displayText = lastMsg.content; }
                displayTime = formatTime(lastMsg.created_at);
            }

            return (
              <div 
                key={contact.id}
                onClick={() => handleOpenChat(contact.id)}
                className="flex items-center gap-4 px-5 py-4 active:bg-ios-lightGray transition-colors cursor-pointer group border-b border-ios-separator ml-5 border-l-0 pl-0"
              >
                <div className="relative shrink-0">
                  <img src={contact.avatar_url || `https://ui-avatars.com/api/?name=${contact.username}&background=random`} alt={contact.username} className="w-14 h-14 rounded-full object-cover" />
                  {/* Presence/Typing Indicator on Avatar */}
                  {isTyping && (
                    <div className="absolute -bottom-1 -right-1 bg-ios-gray rounded-full p-1 border border-black">
                       <div className="flex gap-0.5">
                          <span className="w-1 h-1 bg-ios-blue rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-ios-blue rounded-full animate-bounce animation-delay-200"></span>
                          <span className="w-1 h-1 bg-ios-blue rounded-full animate-bounce animation-delay-400"></span>
                       </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <h3 className="text-white font-semibold text-[17px] truncate flex items-center gap-1">
                      {contact.username}
                    </h3>
                    <span className="text-ios-textSecondary text-[15px]">{displayTime}</span>
                  </div>
                  <p className={`text-[15px] truncate leading-snug ${isTyping ? 'text-ios-blue font-medium italic' : isMedia ? 'text-white/80 italic' : 'text-ios-textSecondary'}`}>
                    {displayText}
                  </p>
                </div>
                
                <div className="text-ios-textSecondary opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                  <ChevronLeft />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderChatScreen = () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return null;
    
    const isPartnerTyping = typingUsers[activeProfile.id];

    return (
      <div className="flex flex-col h-full bg-ios-black relative">
        <header className="flex-none px-4 py-3 flex items-center justify-between bg-ios-gray/80 backdrop-blur-xl z-20 border-b border-ios-separator pt-safe">
          <button 
            onClick={() => { setScreen('home'); setPlayingAudioId(null); }}
            className="flex items-center text-ios-blue hover:opacity-70 transition-opacity px-2 -ml-2 h-10"
          >
            <ChevronLeft />
            <span className="text-[17px] -ml-0.5 font-medium">Messages</span>
          </button>

          <div 
            className="flex flex-col items-center cursor-pointer"
            onClick={() => setScreen('info')}
          >
            <div className="relative">
               <img src={activeProfile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover mb-0.5" />
            </div>
            <span className="text-[11px] text-white font-medium flex items-center gap-0.5 mt-0.5">
               {activeProfile.username} <span className="text-[8px] opacity-60">›</span>
            </span>
          </div>

          <button className="p-2 text-ios-blue rounded-full hover:bg-ios-lightGray/50 transition-colors">
            <Video />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar space-y-1">
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-50">
               <img src={activeProfile.avatar_url} className="w-20 h-20 rounded-full grayscale mb-4 opacity-50" alt="" />
               <div className="text-center text-ios-textSecondary text-sm">No messages yet with {activeProfile.username}</div>
             </div>
          )}
          
          {messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              currentUserId={session.user.id}
              onOpenContext={setActiveContextMenu}
              isContextActive={activeContextMenu === msg.id}
              closeContext={() => setActiveContextMenu(null)}
              onReaction={handleReaction}
              currentlyPlayingId={playingAudioId}
              setCurrentlyPlayingId={setPlayingAudioId}
              onImageClick={setLightboxImage}
            />
          ))}

          {/* Typing Indicator Bubble */}
          {isPartnerTyping && (
             <div className="flex justify-start mb-6 animate-slide-up">
                <div className="bg-ios-bubbleReceived rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5 w-16 h-10">
                   <div className="w-2 h-2 bg-ios-textSecondary rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-ios-textSecondary rounded-full animate-bounce animation-delay-200"></div>
                   <div className="w-2 h-2 bg-ios-textSecondary rounded-full animate-bounce animation-delay-400"></div>
                </div>
             </div>
          )}
          
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="shrink-0 z-30">
           <InputArea onSendMessage={handleSendMessage} onTyping={handleTyping} />
        </div>
      </div>
    );
  };

  const renderInfoScreen = () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return null;

    // Maintained animate-slide-in-right for drilling down into details
    return (
      <div className="flex flex-col h-full bg-black animate-slide-in-right">
         <header className="flex-none px-4 py-3 flex justify-between items-center bg-transparent z-10 pt-safe">
            <button onClick={() => setScreen('chat')} className="flex items-center text-white font-semibold gap-1 bg-ios-gray/50 py-2 pl-3 pr-4 rounded-full backdrop-blur-md hover:bg-ios-gray transition-colors">
               <ChevronLeft /> Done
            </button>
            <button 
               onClick={() => openEditProfile(activeProfile)}
               className="text-ios-blue font-medium px-2"
            >
               Edit
            </button>
         </header>

         <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            <div className="flex flex-col items-center pt-6 pb-10">
                <img src={activeProfile.avatar_url} className="w-28 h-28 rounded-full object-cover mb-4 shadow-2xl border-4 border-black" alt="" />
                <h2 className="text-3xl font-bold text-white mb-1">{activeProfile.username}</h2>
                <p className="text-ios-textSecondary text-[17px]">{activeProfile.email}</p>
            </div>

            <div className="grid grid-cols-4 gap-6 px-6 mb-10 max-w-sm mx-auto">
                {[
                { icon: <Phone />, label: "call" },
                { icon: <Video />, label: "video" },
                { icon: <Mail />, label: "mail" },
                { icon: <Info />, label: "info" }
                ].map((action, i) => (
                <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-16 h-16 rounded-2xl bg-ios-lightGray text-ios-blue flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                        {action.icon}
                    </div>
                    <span className="text-[11px] text-ios-blue font-medium capitalize tracking-wide">{action.label}</span>
                </div>
                ))}
            </div>

            <div className="px-4 space-y-8 mb-8">
                <div className="bg-ios-gray rounded-2xl overflow-hidden">
                {['Share Location', 'Hide Alerts', 'Read Receipts'].map((setting, i) => (
                    <div key={i} className={`flex justify-between items-center p-4 py-4 ${i !== 2 ? 'border-b border-ios-separator' : ''}`}>
                        <span className="text-white text-[17px]">{setting}</span>
                        <div className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${i === 2 ? 'bg-ios-blue' : 'bg-ios-lightGray'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${i === 2 ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>
                ))}
                </div>
            </div>

            <div className="px-4 mb-10">
                <h3 className="text-ios-textSecondary text-xs font-bold uppercase tracking-wider mb-3 pl-4">Shared Photos</h3>
                <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
                {SUGGESTED_PHOTOS.slice(0,4).map((url, i) => (
                    <img key={i} src={url} alt="Shared" className="w-full h-40 object-cover hover:opacity-80 transition-opacity" />
                ))}
                </div>
            </div>
         </div>
      </div>
    );
  };

  const renderNewMessageModal = () => (
    <div className={`fixed inset-0 z-50 flex flex-col items-end justify-end pointer-events-none ${isNewMessageModalOpen ? 'pointer-events-auto' : ''}`}>
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isNewMessageModalOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setIsNewMessageModalOpen(false)}
      />
      
      <div className={`
        bg-ios-gray w-full h-[92vh] rounded-t-[2rem] shadow-2xl transform transition-transform duration-300 flex flex-col z-50 overflow-hidden
        ${isNewMessageModalOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-ios-separator bg-ios-gray">
           <button className="text-ios-blue text-[17px]" onClick={() => setIsNewMessageModalOpen(false)}>Cancel</button>
           <h2 className="text-white font-semibold text-[17px]">New Message</h2>
           <button className="text-ios-textSecondary text-[17px] opacity-50" disabled>Next</button>
        </div>
        
        <div className="p-3 border-b border-ios-separator flex items-center gap-3 bg-ios-black/20">
           <span className="text-ios-textSecondary pl-2 text-[17px]">To:</span>
           <input type="text" autoFocus className="bg-transparent text-white focus:outline-none flex-1 py-1 text-[17px]" />
           <button className="text-ios-blue text-2xl pr-2">+</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
           <div className="text-ios-textSecondary text-xs font-bold uppercase tracking-wider mb-3 px-2">Suggested</div>
           <div className="space-y-1">
              {contacts.map(contact => (
                 <div key={contact.id} className="flex items-center gap-4 p-2 rounded-xl active:bg-ios-lightGray transition-colors" onClick={() => {
                   handleOpenChat(contact.id);
                   setIsNewMessageModalOpen(false);
                 }}>
                    <img src={contact.avatar_url} className="w-12 h-12 rounded-full" alt="" />
                    <div className="border-b border-ios-separator flex-1 py-3 pr-2">
                       <div className="text-white font-semibold text-[17px]">{contact.username}</div>
                       <div className="text-ios-textSecondary text-[15px]">Mobile</div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );

  return (
    // Applied Shake Animation class dynamically
    <div className={`max-w-md mx-auto h-full relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator flex flex-col ${isShaking ? 'animate-shake' : ''}`}>
      {screen === 'home' && renderHomeScreen()}
      {screen === 'chat' && renderChatScreen()}
      {screen === 'info' && renderInfoScreen()}
      {renderNewMessageModal()}
      {renderEditProfileModal()}
      {renderLightbox()}
    </div>
  );
}