import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { ChatSession, Message, Profile, ScreenType } from './types';
import { ChevronLeft, Video, Info, Phone, Mail, Search, NewMessage } from './components/Icons';
import MessageBubble from './components/Chat/MessageBubble';
import InputArea from './components/Chat/InputArea';
import Auth from './components/Auth';
import { SUGGESTED_PHOTOS } from './constants';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [screen, setScreen] = useState<ScreenType>('home');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContextMenu, setActiveContextMenu] = useState<number | null>(null);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // -- Initialization & Auth --
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // -- Fetch Contacts (Profiles) --
  useEffect(() => {
    if (session?.user) {
      const fetchProfiles = async () => {
        // Fetch everyone except me
        const { data, error } = await supabase
          .from('profilesMSP')
          .select('*')
          .neq('id', session.user.id);
        
        if (data) setContacts(data);
      };
      fetchProfiles();
    }
  }, [session]);

  // -- Fetch & Subscribe Messages for Active Chat --
  useEffect(() => {
    if (!session?.user || !activeChatId) return;

    // 1. Fetch initial history
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},recipient_id.eq.${session.user.id})`)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    };

    fetchHistory();

    // 2. Realtime Subscription
    const channel = supabase
      .channel(`chat:${activeChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${session.user.id}`, 
        },
        (payload) => {
          // If the message is from the person we are currently chatting with
          if (payload.new.sender_id === activeChatId) {
             setMessages(prev => [...prev, payload.new as Message]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
           event: 'INSERT',
           schema: 'public',
           table: 'messages',
           filter: `sender_id=eq.${session.user.id}`
        },
        (payload) => {
           // Optimistic update handled by sendMessage, but good to sync or confirm
           // Check if we already have it (optimistic UI) to avoid dupe, or just rely on state
           setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as Message];
           });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, session]);

  // Scroll to bottom
  useEffect(() => {
    if (screen === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [screen, messages]);

  // -- Handlers --

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

    // Optimistic Update
    /* 
       Note: We can't know the exact ID before insert, but we can fake it for UI response 
       and let the subscription or fetch fix it. For now, we await the insert for simplicity 
       to get the real ID, or just render.
    */
    
    const { error } = await supabase
      .from('messages')
      .insert([newMessagePayload]);

    if (error) {
       console.error("Failed to send", error);
       alert("Error sending message");
    }
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
       <div className="max-w-md mx-auto h-screen relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator">
          <Auth onAuthSuccess={() => {}} />
       </div>
    );
  }

  const renderHomeScreen = () => (
    <div className="flex flex-col h-full bg-ios-black animate-slide-in-right">
      <header className="px-4 py-3 flex justify-between items-center bg-ios-gray/90 backdrop-blur-md sticky top-0 z-10 border-b border-ios-separator">
        <button className="text-ios-blue text-[17px]" onClick={handleLogout}>Log Out</button>
        <h1 className="text-white font-semibold text-[17px]">Messages</h1>
        <button 
          className="text-ios-blue"
          onClick={() => setIsNewMessageModalOpen(true)}
        >
          <NewMessage />
        </button>
      </header>

      <div className="px-4 py-2">
         <div className="bg-ios-lightGray rounded-xl flex items-center px-3 py-2 gap-2">
            <div className="text-ios-textSecondary"><Search /></div>
            <input type="text" placeholder="Search" className="bg-transparent text-white placeholder-ios-textSecondary focus:outline-none w-full text-[17px]" />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {contacts.length === 0 && (
           <div className="text-center text-ios-textSecondary mt-10">No contacts found.<br/>Wait for your partner to sign up!</div>
        )}
        {contacts.map(contact => (
          <div 
            key={contact.id}
            onClick={() => handleOpenChat(contact.id)}
            className="flex items-center gap-3 px-4 py-3 active:bg-ios-lightGray transition-colors cursor-pointer group border-b border-ios-separator ml-4 border-l-0 pl-0"
          >
            <div className="relative">
              <img src={contact.avatar_url || `https://ui-avatars.com/api/?name=${contact.username}&background=random`} alt={contact.username} className="w-12 h-12 rounded-full object-cover" />
            </div>
            
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="text-white font-semibold text-[17px] truncate flex items-center gap-1">
                  {contact.username}
                </h3>
              </div>
              <p className="text-[15px] truncate text-ios-textSecondary">
                Tap to chat
              </p>
            </div>
            
            <div className="text-ios-textSecondary opacity-0 group-hover:opacity-100 transition-opacity">
               <ChevronLeft />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChatScreen = () => {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return null;

    return (
      <div className="flex flex-col h-full bg-ios-black relative">
        <header className="px-2 py-2 flex items-center justify-between bg-ios-gray/80 backdrop-blur-xl sticky top-0 z-20 border-b border-ios-separator">
          <button 
            onClick={() => setScreen('home')}
            className="flex items-center text-ios-blue hover:opacity-70 transition-opacity px-2"
          >
            <ChevronLeft />
            <span className="text-[17px] -ml-1">Messages</span>
          </button>

          <div 
            className="flex flex-col items-center cursor-pointer"
            onClick={() => setScreen('info')}
          >
            <div className="relative">
               <img src={activeProfile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover mb-0.5" />
            </div>
            <span className="text-xs text-ios-textSecondary font-medium flex items-center gap-1">
               {activeProfile.username} <span className="text-[8px]">›</span>
            </span>
          </div>

          <button className="p-2 text-ios-blue rounded-full hover:bg-ios-lightGray/50 transition-colors">
            <Video />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar space-y-1">
          {messages.length === 0 && (
             <div className="text-center text-ios-textSecondary text-xs mt-4">Start the conversation</div>
          )}
          
          {messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              currentUserId={session.user.id}
              onOpenContext={setActiveContextMenu}
              isContextActive={activeContextMenu === msg.id}
              closeContext={() => setActiveContextMenu(null)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

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
      <div className="flex flex-col h-full bg-black animate-slide-in-right overflow-y-auto no-scrollbar">
         <header className="px-4 py-3 flex justify-between items-center bg-transparent sticky top-0 z-10">
            <button onClick={() => setScreen('chat')} className="flex items-center text-white font-semibold gap-1 bg-ios-gray/50 p-2 pr-4 rounded-full backdrop-blur-md hover:bg-ios-gray transition-colors">
               <ChevronLeft /> Done
            </button>
         </header>

         <div className="flex flex-col items-center pt-4 pb-8">
            <img src={activeProfile.avatar_url} className="w-24 h-24 rounded-full object-cover mb-3 shadow-2xl" alt="" />
            <h2 className="text-2xl font-bold text-white mb-1">{activeProfile.username}</h2>
            <p className="text-ios-textSecondary text-[17px]">{activeProfile.email}</p>
         </div>

         <div className="grid grid-cols-4 gap-4 px-6 mb-8">
            {[
               { icon: <Phone />, label: "call" },
               { icon: <Video />, label: "video" },
               { icon: <Mail />, label: "mail" },
               { icon: <Info />, label: "info" }
            ].map((action, i) => (
               <div key={i} className="flex flex-col items-center gap-1 group cursor-pointer">
                  <div className="w-14 h-14 rounded-xl bg-ios-lightGray text-ios-blue flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                     {action.icon}
                  </div>
                  <span className="text-xs text-ios-blue font-medium capitalize">{action.label}</span>
               </div>
            ))}
         </div>

         <div className="px-4 space-y-6 mb-8">
            <div className="bg-ios-gray rounded-xl overflow-hidden">
               {['Share Location', 'Hide Alerts', 'Read Receipts'].map((setting, i) => (
                  <div key={i} className={`flex justify-between items-center p-4 ${i !== 2 ? 'border-b border-ios-separator' : ''}`}>
                     <span className="text-white text-[17px]">{setting}</span>
                     <div className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${i === 2 ? 'bg-ios-blue' : 'bg-ios-lightGray'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${i === 2 ? 'translate-x-5' : ''}`}></div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="px-4 mb-10">
            <h3 className="text-ios-textSecondary text-xs font-bold uppercase tracking-wider mb-2 pl-4">Shared Photos</h3>
            <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
               {SUGGESTED_PHOTOS.slice(0,4).map((url, i) => (
                  <img key={i} src={url} alt="Shared" className="w-full h-32 object-cover hover:opacity-80 transition-opacity" />
               ))}
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
        bg-ios-gray w-full h-[90vh] rounded-t-2xl shadow-2xl transform transition-transform duration-300 flex flex-col z-50
        ${isNewMessageModalOpen ? 'translate-y-0' : 'translate-y-full'}
      `}>
        <div className="flex justify-between items-center p-4 border-b border-ios-separator">
           <button className="text-ios-blue text-[17px]" onClick={() => setIsNewMessageModalOpen(false)}>Cancel</button>
           <h2 className="text-white font-semibold text-[17px]">New Message</h2>
           <button className="text-ios-textSecondary text-[17px]" disabled>Next</button>
        </div>
        
        <div className="p-2 border-b border-ios-separator flex items-center gap-2">
           <span className="text-ios-textSecondary pl-2">To:</span>
           <input type="text" autoFocus className="bg-transparent text-white focus:outline-none flex-1 py-1" />
           <button className="text-ios-blue text-2xl pr-2">+</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
           <div className="text-ios-textSecondary text-xs font-bold uppercase tracking-wider mb-2">Contacts</div>
           <div className="space-y-4">
              {contacts.map(contact => (
                 <div key={contact.id} className="flex items-center gap-3" onClick={() => {
                   handleOpenChat(contact.id);
                   setIsNewMessageModalOpen(false);
                 }}>
                    <img src={contact.avatar_url} className="w-10 h-10 rounded-full" alt="" />
                    <div className="border-b border-ios-separator flex-1 py-3">
                       <div className="text-white font-semibold">{contact.username}</div>
                       <div className="text-ios-textSecondary text-sm">Mobile</div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto h-screen relative overflow-hidden bg-black shadow-2xl sm:border-x border-ios-separator">
      {screen === 'home' && renderHomeScreen()}
      {screen === 'chat' && renderChatScreen()}
      {screen === 'info' && renderInfoScreen()}
      {renderNewMessageModal()}
    </div>
  );
}