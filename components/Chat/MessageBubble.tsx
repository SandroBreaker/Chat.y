import React, { useState, useRef } from 'react';
import { Message } from '../../types';
import { Play, Pause, Bell } from '../Icons';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onOpenContext: (messageId: number) => void;
  isContextActive: boolean;
  closeContext: () => void;
  onReaction: (messageId: number, emoji: string) => void;
}

const REACTIONS = ["❤️", "👍", "👎", "😂", "❓", "‼️"];

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  currentUserId, 
  onOpenContext, 
  isContextActive, 
  closeContext,
  onReaction
}) => {
  const isMe = message.sender_id === currentUserId;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    // For simplicity using onClick in parent, but preventing default for context
    if (e.type === 'contextmenu') {
       e.preventDefault();
       onOpenContext(message.id);
    }
  };
  
  // Detect content type hacks
  const isImage = message.content.startsWith('[IMAGE]');
  const isAudio = message.content.startsWith('[AUDIO]');
  const isNudge = message.content === '[NUDGE]';
  
  const cleanContent = isImage 
    ? message.content.replace('[IMAGE]', '') 
    : isAudio 
      ? message.content.replace('[AUDIO]', '') 
      : message.content;

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Reset all other audios if needed, for now just play
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const renderContent = () => {
    if (isNudge) {
      return (
        <div className="flex items-center gap-2 px-2 py-1 font-semibold text-yellow-400">
           <Bell />
           <span className="italic">Chamou sua atenção!</span>
        </div>
      );
    }

    if (isImage) {
      return (
        <img 
          src={cleanContent} 
          alt="Shared" 
          className="rounded-lg max-w-full h-auto object-cover min-w-[150px] min-h-[150px] animate-fade-in"
          loading="lazy"
        />
      );
    }
    
    if (isAudio) {
      return (
        <div className="flex items-center gap-3 min-w-[160px] py-1">
           <button 
             onClick={toggleAudio}
             className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors"
           >
             {isPlaying ? <Pause /> : <Play />}
           </button>
           <div className="flex flex-col gap-1 w-full">
              <div className="h-1 bg-white/30 rounded-full w-full overflow-hidden">
                 <div className={`h-full bg-white w-full origin-left transition-transform duration-[2000ms] ease-linear ${isPlaying ? 'scale-x-100' : 'scale-x-0'}`}></div>
              </div>
              <span className="text-[10px] opacity-70">Audio Message</span>
           </div>
           <audio 
             ref={audioRef} 
             src={cleanContent} 
             onEnded={() => setIsPlaying(false)}
             onPause={() => setIsPlaying(false)}
             onPlay={() => setIsPlaying(true)}
             className="hidden" 
           />
        </div>
      );
    }

    return message.content;
  };

  // Process reactions to display distinct ones
  const reactionsList = message.reactions ? Object.values(message.reactions) : [];
  const distinctReactions = Array.from(new Set(reactionsList)).slice(0, 3);

  return (
    <div className={`relative mb-6 flex ${isMe ? 'justify-end' : 'justify-start'} group animate-message-pop`}>
      {/* Backdrop for Context Menu */}
      {isContextActive && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-ios"
          onClick={(e) => { e.stopPropagation(); closeContext(); }} 
        />
      )}

      {/* Message Content */}
      <div 
        className={`
          relative z-30 max-w-[75%] 
          ${isImage ? 'p-1' : 'px-4 py-2'}
          ${isNudge ? 'border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : ''}
          rounded-2xl text-[17px] leading-snug cursor-pointer transition-all duration-300 ease-ios
          ${isMe ? 'bg-ios-bubbleSent text-white rounded-br-none' : 'bg-ios-bubbleReceived text-white rounded-bl-none'}
          ${isContextActive ? 'scale-105 shadow-2xl' : 'active:scale-95'}
        `}
        onContextMenu={handleLongPress}
        onClick={() => !isAudio && onOpenContext(message.id)}
        style={{
          boxShadow: isContextActive ? '0 0 0 1000px rgba(0,0,0,0.0)' : undefined
        }}
      >
        {renderContent()}

        {/* Reactions Display */}
        {reactionsList.length > 0 && (
          <div className={`
            absolute -bottom-4 ${isMe ? 'left-0 -translate-x-1/4' : 'right-0 translate-x-1/4'}
            bg-ios-gray border-2 border-black rounded-full px-1.5 py-0.5 shadow-sm flex items-center -space-x-1 z-20 min-w-[24px] justify-center h-[24px] animate-scale-press
          `}>
             {distinctReactions.map((r, i) => (
               <span key={i} className="text-[14px] leading-none">{r}</span>
             ))}
             {reactionsList.length > 3 && (
                <span className="text-[10px] text-white pl-1">+{reactionsList.length - 3}</span>
             )}
          </div>
        )}
      </div>

      {/* Context Menu Overlay */}
      {isContextActive && (
        <div className={`absolute z-50 flex flex-col gap-2 ${isMe ? 'items-end right-0' : 'items-start left-0'} -top-16 min-w-[240px]`}>
          
          <div className="bg-ios-gray p-2 rounded-full flex gap-3 shadow-lg border border-ios-separator animate-slide-up justify-between px-4 origin-bottom">
            {REACTIONS.map(emoji => (
              <button 
                key={emoji} 
                className="hover:scale-125 transition-transform duration-200 ease-ios-spring text-2xl active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  onReaction(message.id, emoji);
                  closeContext();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="bg-ios-gray/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-ios-separator w-48 mt-2 animate-slide-up origin-top duration-300">
            <button className="w-full text-left px-4 py-3 text-white border-b border-ios-separator hover:bg-ios-lightGray flex justify-between items-center transition-colors">
              Reply <span className="opacity-50 text-sm">↩️</span>
            </button>
            <button className="w-full text-left px-4 py-3 text-white border-b border-ios-separator hover:bg-ios-lightGray flex justify-between items-center transition-colors">
              Copy <span className="opacity-50 text-sm">📄</span>
            </button>
            <button className="w-full text-left px-4 py-3 text-white border-b border-ios-separator hover:bg-ios-lightGray flex justify-between items-center transition-colors">
              Forward <span className="opacity-50 text-sm">➡️</span>
            </button>
            <button className="w-full text-left px-4 py-3 text-white border-b border-ios-separator hover:bg-ios-lightGray flex justify-between items-center transition-colors">
              Star <span className="opacity-50 text-sm">⭐</span>
            </button>
            <button className="w-full text-left px-4 py-3 text-red-500 hover:bg-ios-lightGray flex justify-between items-center transition-colors">
              Report <span className="opacity-50 text-sm">⚠️</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;