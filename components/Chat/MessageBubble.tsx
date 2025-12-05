import React from 'react';
import { Message } from '../../types';
import { supabase } from '../../supabaseClient';

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onOpenContext: (messageId: number) => void;
  isContextActive: boolean;
  closeContext: () => void;
}

const REACTIONS = ["❤️", "👍", "👎", "😂", "❓", "‼️"];

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, currentUserId, onOpenContext, isContextActive, closeContext }) => {
  const isMe = message.sender_id === currentUserId;

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
  
  const cleanContent = isImage 
    ? message.content.replace('[IMAGE]', '') 
    : isAudio 
      ? message.content.replace('[AUDIO]', '') 
      : message.content;

  const renderContent = () => {
    if (isImage) {
      return (
        <img 
          src={cleanContent} 
          alt="Shared" 
          className="rounded-lg max-w-full h-auto object-cover min-w-[150px] min-h-[150px]"
          loading="lazy"
        />
      );
    }
    
    if (isAudio) {
      return (
        <div className="flex items-center gap-3 min-w-[160px] py-1">
           <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shrink-0">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           </div>
           <div className="flex flex-col gap-1 w-full">
              <div className="h-1 bg-white/30 rounded-full w-full overflow-hidden">
                 <div className="h-full bg-white w-1/3"></div>
              </div>
              <span className="text-[10px] opacity-70">Audio Message</span>
           </div>
           {/* Native audio element hidden but could be controlled */}
           <audio src={cleanContent} controls className="hidden" />
        </div>
      );
    }

    return message.content;
  };

  return (
    <div className={`relative mb-2 flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
      {/* Backdrop for Context Menu */}
      {isContextActive && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); closeContext(); }} 
        />
      )}

      {/* Message Content */}
      <div 
        className={`
          relative z-30 max-w-[75%] 
          ${isImage ? 'p-1' : 'px-4 py-2'}
          rounded-2xl text-[17px] leading-snug cursor-pointer transition-transform duration-200
          ${isMe ? 'bg-ios-bubbleSent text-white rounded-br-none' : 'bg-ios-bubbleReceived text-white rounded-bl-none'}
          ${isContextActive ? 'scale-105 shadow-2xl' : 'active:scale-95'}
        `}
        onContextMenu={handleLongPress}
        onClick={() => {
           if(isAudio) {
              const audio = new Audio(cleanContent);
              audio.play();
           } else {
              onOpenContext(message.id);
           }
        }}
        style={{
          boxShadow: isContextActive ? '0 0 0 1000px rgba(0,0,0,0.0)' : 'none'
        }}
      >
        {renderContent()}
      </div>

      {/* Context Menu Overlay */}
      {isContextActive && (
        <div className={`absolute z-50 flex flex-col gap-2 ${isMe ? 'items-end right-0' : 'items-start left-0'} -top-16 min-w-[200px]`}>
          
          <div className="bg-ios-gray p-2 rounded-full flex gap-3 shadow-lg border border-ios-separator animate-slide-up">
            {REACTIONS.map(emoji => (
              <button 
                key={emoji} 
                className="hover:scale-125 transition-transform text-xl"
                onClick={() => closeContext()}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="bg-ios-gray/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-ios-separator w-48 mt-2 animate-slide-up origin-bottom">
            <button className="w-full text-left px-4 py-3 text-white border-b border-ios-separator hover:bg-ios-lightGray flex justify-between">
              Reply <span className="opacity-50">↩️</span>
            </button>
            <button className="w-full text-left px-4 py-3 text-white hover:bg-ios-lightGray flex justify-between">
              Copy <span className="opacity-50">Cc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;