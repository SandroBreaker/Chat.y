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
    e.preventDefault();
    onOpenContext(message.id);
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
          relative z-30 max-w-[75%] px-4 py-2 rounded-2xl text-[17px] leading-snug cursor-pointer transition-transform duration-200
          ${isMe ? 'bg-ios-bubbleSent text-white rounded-br-none' : 'bg-ios-bubbleReceived text-white rounded-bl-none'}
          ${isContextActive ? 'scale-105 shadow-2xl' : 'active:scale-95'}
        `}
        onClick={handleLongPress}
        style={{
          boxShadow: isContextActive ? '0 0 0 1000px rgba(0,0,0,0.0)' : 'none'
        }}
      >
        {message.content}
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