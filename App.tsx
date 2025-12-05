import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { ChatSession, Message, Profile, ScreenType } from './types';
import { ChevronLeft, Video, Info, Phone, Mail, Search, NewMessage, Camera, Pencil, X } from './components/Icons';
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
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  
  // UI States
  const [activeContextMenu, setActiveContextMenu] = useState<number | null>(null);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  
  // Profile Editing States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const alertAudioRef = useRef<HTMLAudioElement>(new Audio(ALERT_SOUND_URL));
  const msgAudioRef = useRef<HTMLAudioElement>(new Audio(MSG_SOUND_URL));
  
  // -- Initialization & Auth --
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Request Notification Permission on load
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    return () => subscription.unsubscribe();
  }, []);

  // -- Fetch Profiles --
  useEffect(() => {
    if (session?.user) {
      const fetchProfiles = async () => {
        // Fetch contacts
        const { data: contactsData } = await supabase
          .from('profilesMSP')
          .select('*')
          .neq('id', session.user.id);
        
        if (contactsData) setContacts(contactsData);

        // Fetch my profile
        const { data: myData } = await supabase
          .from('profilesMSP')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (myData) setCurrentUserProfile(myData);
      };
      fetchProfiles();
    }
  }, [session]);

  // -- Fetch & Subscribe Messages --
  useEffect(() => {
    if (!session?.user) return; // Keep subscription active even if no active chat to get notifications

    // Only fetch history if we have an active chat
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

    const channel = supabase
      .channel(`global_messages:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${session.user.id}`, 
        },
        (payload) => {
           if (payload.eventType === 'INSERT') {
             const newMessage = payload.new as Message;
             
             // --- Lógica de Notificação e Som ---
             // Verifica se a mensagem é para mim e não fui eu que enviei (redundante pelo filtro, mas seguro)
             if (newMessage.sender_id !== session.user.id) {
                
                // 1. Som e Vibração
                const playSound = async (audio: HTMLAudioElement) => {
                  try {
                    audio.currentTime = 0;
                    await audio.play();
                  } catch (e) {
                    console.log("Autoplay blocked by browser policy. Interaction needed.");
                  }
                };

                if (newMessage.content === '[NUDGE]') {
                  playSound(alertAudioRef.current);
                  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
                } else {
                  // Mensagem normal
                  playSound(msgAudioRef.current);
                }

                // 2. Notificação do Sistema (Browser)
                if (document.visibilityState === 'hidden' || Notification.permission === 'granted') {
                   const sender = contacts.find(c => c.id === newMessage.sender_id);
                   const senderName = sender?.username || 'Novo Mensagem';
                   
                   let bodyText = newMessage.content;
                   if (bodyText.startsWith('[IMAGE]')) bodyText = '📷 Enviou uma foto';
                   else if (bodyText.startsWith('[AUDIO]')) bodyText = '🎤 Enviou um áudio';
                   else if (bodyText === '[NUDGE]') bodyText = '🔔 Chamou sua atenção!';

                   try {
                     new Notification(senderName, {
                        body: bodyText,
                        icon: '/vite.svg', // Icone padrão
                        silent: true // Já tocamos nosso som
                     });
                   } catch (e) {
                     console.log("Notification failed", e);
                   }
                }

                // Se estivermos no chat ativo, adiciona à lista
                if (activeChatId === newMessage.sender_id) {
                   setMessages(prev => [...prev, newMessage]);
                }
             }
           } else if (payload.eventType === 'UPDATE') {
             // Atualiza mensagem se estiver no chat ativo
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
           // Atualizações enviadas por MIM (ex: em outra aba/dispositivo)
           if (payload.eventType === 'INSERT') {
              if (activeChatId === payload.new.recipient_id) {
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, session, contacts]); // Add contacts dependency to resolve sender name

  // Scroll to bottom
  useEffect(() => {
    if (screen === 'chat') {
      setTimeout(() => {
         messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100); // Small delay to allow layout animation
    }
  }, [screen, messages]);

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
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar_${editingProfile.id}_${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('files_chat.y')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('files_chat.y').getPublicUrl(fileName);
      
      // Update local state temporarily
      setEditingProfile({ ...editingProfile, avatar_url: data.publicUrl });
      
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload avatar");
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

      // Update local lists
      if (editingProfile.id === session.user.id) {
        setCurrentUserProfile({ ...editingProfile, username: editName });
      } else {
        setContacts(prev => prev.map(c => c.id === editingProfile.id ? { ...c, username: editName, avatar_url: editingProfile.avatar_url } : c));
      }
      
      setIsEditProfileOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to save profile");
    }
  };

  // -- Chat Handlers --

  const handleOpenChat = (contactId: string) => {
    setActiveChatId(contactId);
    setScreen('chat');
  };

  const handleSendMessage = async (text: string) => {
    if (!activeChatId || !session?.user) return;

    const newMessagePayload = {
      content: text,
      sender_id: session.user.id,
      recipient_id: activeChatId,
      is_read: false
    };
    
    const { error } = await supabase
      .from('messages')
      .insert([newMessagePayload]);

    if (error) {
       console.error("Failed to send", error);
       alert("Error sending message");
    }
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    if (!session?.user) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const updatedReactions = {
      ...currentReactions,
      [session.user.id]: emoji
    };

    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, reactions: updatedReactions } : m
    ));

    await supabase
      .from('messages')
      .update({ reactions: updatedReactions })
      .eq('id', messageId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setScreen('home');
  };

  // -- Helpers --
  const getActiveProfile = () => contacts.find(c => c.id === activeChatId);

  // -- Renders --

  if (!session) {
    return (
       <div className="max-w-md mx-auto h-[100dvh] relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator">
          <Auth onAuthSuccess={() => {}} />
       </div>
    );
  }

  const renderEditProfileModal = () => (
    isEditProfileOpen && editingProfile && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all duration-300 ease-ios">
        <div className="bg-ios-gray w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scale-press" style={{ transform: 'none' }}>
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

  const renderHomeScreen = () => (
    <div className="flex flex-col h-full bg-ios-black animate-fade-in">
      {/* Fixed Header Section */}
      <div className="flex-none bg-ios-gray/90 backdrop-blur-md z-10 border-b border-ios-separator pt-safe transition-all duration-300 ease-ios">
        <header className="px-5 py-4 flex justify-between items-center">
          <button className="text-red-500 text-[17px] font-medium transition-opacity active:opacity-60" onClick={handleLogout}>Sair</button>
          
          <div className="flex flex-col items-center">
            <h1 className="text-white font-bold text-[17px]">Messages</h1>
          </div>

          <button 
            className="text-ios-blue active:opacity-60 transition-opacity"
            onClick={() => setIsNewMessageModalOpen(true)}
          >
            <NewMessage />
          </button>
        </header>

        {/* Current User Avatar (Click to Edit) */}
        {currentUserProfile && (
           <div className="px-5 pb-4 flex items-center justify-between">
              <div className="text-3xl font-bold text-white tracking-tight">Chats</div>
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
           <div className="bg-ios-lightGray rounded-xl flex items-center px-3 py-2.5 gap-2 group focus-within:bg-ios-lightGray/80 transition-colors">
              <div className="text-ios-textSecondary"><Search /></div>
              <input type="text" placeholder="Search" className="bg-transparent text-white placeholder-ios-textSecondary focus:outline-none w-full text-[17px]" />
           </div>
        </div>
      </div>

      {/* Scrollable Contact List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {contacts.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-ios-textSecondary p-8 text-center animate-fade-in">
             <p className="text-lg font-medium mb-2">No conversations</p>
             <p className="text-sm">Tap the icon above to start a new chat.</p>
           </div>
        )}
        <div className="pt-2">
          {contacts.map(contact => (
            <div 
              key={contact.id}
              onClick={() => handleOpenChat(contact.id)}
              className="flex items-center gap-4 px-5 py-4 active:bg-ios-lightGray transition-colors cursor-pointer group border-b border-ios-separator ml-5 border-l-0 pl-0"
            >
              <div className="relative shrink-0">
                <img src={contact.avatar_url || `https://ui-avatars.com/api/?name=${contact.username}&background=random`} alt={contact.username} className="w-14 h-14 rounded-full object-cover" />
              </div>
              
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex justify-between items-baseline mb-1.5">
                  <h3 className="text-white font-semibold text-[17px] truncate flex items-center gap-1">
                    {contact.username}
                  </h3>
                  <span className="text-ios-textSecondary text-[15px]">12:30 PM</span>
                </div>
                <p className="text-[15px] truncate text-ios-textSecondary leading-snug">
                  Click to start chatting with {contact.username}
                </p>
              </div>
              
              <div className="text-ios-textSecondary opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                 <ChevronLeft />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderChatScreen = () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return null;

    return (
      <div className="flex flex-col h-full bg-ios-black relative animate-slide-in-right">
        {/* Fixed Header */}
        <header className="flex-none px-4 py-3 flex items-center justify-between bg-ios-gray/80 backdrop-blur-xl z-20 border-b border-ios-separator pt-safe transition-all duration-300 ease-ios">
          <button 
            onClick={() => setScreen('home')}
            className="flex items-center text-ios-blue hover:opacity-70 transition-opacity px-2 -ml-2 h-10 active:opacity-50"
          >
            <ChevronLeft />
            <span className="text-[17px] -ml-0.5 font-medium">Messages</span>
          </button>

          <div 
            className="flex flex-col items-center cursor-pointer active:opacity-60 transition-opacity"
            onClick={() => setScreen('info')}
          >
            <div className="relative">
               <img src={activeProfile.avatar_url} alt="Avatar" className="w-9 h-9 rounded-full object-cover mb-0.5" />
            </div>
            <span className="text-[11px] text-white font-medium flex items-center gap-0.5 mt-0.5">
               {activeProfile.username} <span className="text-[8px] opacity-60">›</span>
            </span>
          </div>

          <button className="p-2 text-ios-blue rounded-full hover:bg-ios-lightGray/50 transition-colors active:opacity-50">
            <Video />
          </button>
        </header>

        {/* Scrollable Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar space-y-1">
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-50 animate-fade-in">
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
            />
          ))}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* Fixed Input Area */}
        <div className="shrink-0 z-30">
           <InputArea onSendMessage={handleSendMessage} />
        </div>
      </div>
    );
  };

  const renderInfoScreen = () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return null;

    return (
      <div className="flex flex-col h-full bg-black animate-slide-in-right">
         {/* Fixed Header */}
         <header className="flex-none px-4 py-3 flex justify-between items-center bg-transparent z-10 pt-safe transition-all duration-300 ease-ios">
            <button onClick={() => setScreen('chat')} className="flex items-center text-white font-semibold gap-1 bg-ios-gray/50 py-2 pl-3 pr-4 rounded-full backdrop-blur-md hover:bg-ios-gray transition-colors active:scale-95">
               <ChevronLeft /> Done
            </button>
            <button 
               onClick={() => openEditProfile(activeProfile)}
               className="text-ios-blue font-medium px-2 active:opacity-50"
            >
               Edit
            </button>
         </header>

         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            <div className="flex flex-col items-center pt-6 pb-10 animate-fade-in">
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
                    <div className="w-16 h-16 rounded-2xl bg-ios-lightGray text-ios-blue flex items-center justify-center shadow-lg group-active:scale-95 transition-transform duration-200 ease-ios">
                        {action.icon}
                    </div>
                    <span className="text-[11px] text-ios-blue font-medium capitalize tracking-wide">{action.label}</span>
                </div>
                ))}
            </div>

            <div className="px-4 space-y-8 mb-8 animate-slide-up">
                <div className="bg-ios-gray rounded-2xl overflow-hidden">
                {['Share Location', 'Hide Alerts', 'Read Receipts'].map((setting, i) => (
                    <div key={i} className={`flex justify-between items-center p-4 py-4 ${i !== 2 ? 'border-b border-ios-separator' : ''}`}>
                        <span className="text-white text-[17px]">{setting}</span>
                        <div className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-ios ${i === 2 ? 'bg-ios-blue' : 'bg-ios-lightGray'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-ios ${i === 2 ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>
                ))}
                </div>
            </div>

            <div className="px-4 mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
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
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-ios ${isNewMessageModalOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setIsNewMessageModalOpen(false)}
      />
      
      <div className={`
        bg-ios-gray w-full h-[92vh] rounded-t-[2rem] shadow-2xl transform transition-transform duration-500 ease-ios-spring flex flex-col z-50 overflow-hidden
        ${isNewMessageModalOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-ios-separator bg-ios-gray">
           <button className="text-ios-blue text-[17px] active:opacity-50" onClick={() => setIsNewMessageModalOpen(false)}>Cancel</button>
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
    <div className="max-w-md mx-auto h-[100dvh] relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator flex flex-col transition-all duration-300 ease-ios-spring">
      {screen === 'home' && renderHomeScreen()}
      {screen === 'chat' && renderChatScreen()}
      {screen === 'info' && renderInfoScreen()}
      {renderNewMessageModal()}
      {renderEditProfileModal()}
    </div>
  );
}