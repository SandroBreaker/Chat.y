import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, Camera } from '../Icons';
import { SUGGESTED_PHOTOS } from '../../constants';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage }) => {
  const [text, setText] = useState('');
  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      {/* Input Bar */}
      <div className="bg-ios-gray/80 backdrop-blur-xl border-t border-ios-separator p-2 pb-safe">
        <div className="flex items-center gap-3 px-2">
          <button 
            className={`p-2 rounded-full bg-ios-lightGray text-ios-textSecondary transition-transform ${isMediaSheetOpen ? 'rotate-45 bg-ios-blue text-white' : ''}`}
            onClick={() => setIsMediaSheetOpen(!isMediaSheetOpen)}
          >
            <Plus />
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="iMessage"
              className="w-full bg-black border border-ios-separator rounded-full py-2 px-4 text-white placeholder-ios-textSecondary focus:outline-none focus:border-ios-blue transition-colors"
            />
          </div>

          {text.trim() ? (
             <button 
             onClick={handleSend}
             className="p-2 rounded-full bg-ios-blue text-white animate-scale-press"
           >
             <Send />
           </button>
          ) : (
            <button className="p-2 text-ios-textSecondary">
              <Mic />
            </button>
          )}
         
        </div>
      </div>

      {/* Media Sheet */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 bg-ios-gray z-40 transition-transform duration-300 ease-in-out border-t border-ios-separator
          ${isMediaSheetOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ height: '300px', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-4 h-full overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold text-lg">Photos</h3>
            <button className="text-ios-blue text-sm">See All</button>
          </div>
          
          <div className="grid grid-cols-3 gap-1 mb-4">
            <button className="aspect-square bg-ios-lightGray rounded-lg flex flex-col items-center justify-center text-ios-textSecondary hover:bg-ios-separator transition-colors">
              <Camera />
              <span className="text-xs mt-1">Camera</span>
            </button>
            {SUGGESTED_PHOTOS.map((url, idx) => (
              <img 
                key={idx} 
                src={url} 
                alt="Recent" 
                className="aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  onSendMessage(`[Photo Shared]`); // Mock sending photo
                  setIsMediaSheetOpen(false);
                }}
              />
            ))}
          </div>

          <div className="space-y-1">
             <div className="text-ios-textSecondary text-xs uppercase font-bold tracking-wider mb-2">Apps</div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex-shrink-0 w-16 h-16 bg-ios-lightGray rounded-2xl animate-pulse"></div>
                ))}
             </div>
          </div>
        </div>
      </div>
      
      {/* Overlay to close sheet when clicking outside (on the chat area) */}
      {isMediaSheetOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/20" 
          style={{ bottom: '300px' }}
          onClick={() => setIsMediaSheetOpen(false)}
        />
      )}
    </>
  );
};

export default InputArea;