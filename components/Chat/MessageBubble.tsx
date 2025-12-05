import React, { useState, useRef } from 'react';
import { Message } from '../../types';
import { Play, Pause, Bell } from '../Icons';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onOpenContext: (messageId: number, rect: DOMRect) => void;
  isContextActive: boolean;
  onReaction: (messageId: number, emoji: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  currentUserId, 
  onOpenContext, 
  isContextActive, 
  onReaction
}) => {
  const isMe = message.sender_id === currentUserId;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === 'contextmenu') {
       e.preventDefault();
       if (bubbleRef.current) {
         onOpenContext(message.id, bubbleRef.current.getBoundingClientRect());
       }
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
      
      {/* Message Content */}
      <div 
        ref={bubbleRef}
        className={`
          relative z-30 max-w-[75%] 
          ${isImage ? 'p-1' : 'px-4 py-2'}
          ${isNudge ? 'border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : ''}
          rounded-2xl text-[17px] leading-snug cursor-pointer transition-all duration-300 ease-ios
          ${isMe ? 'bg-ios-bubbleSent text-white rounded-br-none' : 'bg-ios-bubbleReceived text-white rounded-bl-none'}
          ${isContextActive ? 'scale-[1.02] shadow-2xl brightness-110' : 'active:scale-95'}
        `}
        onContextMenu={handleLongPress}
        onClick={() => !isAudio && bubbleRef.current && onOpenContext(message.id, bubbleRef.current.getBoundingClientRect())}
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
    </div>
  );
};

export default MessageBubble;