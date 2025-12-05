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
      <div className="bg-ios-gray/80 backdrop-blur-xl border-t border-ios-separator pb-safe">
        <div className="flex items-center gap-3 px-3 py-3">
          <button 
            className={`p-2.5 rounded-full bg-ios-lightGray text-ios-textSecondary transition-all active:scale-95 ${isMediaSheetOpen ? 'rotate-45 bg-ios-blue text-white' : ''}`}
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
              className="w-full bg-black border border-ios-separator rounded-full py-2.5 px-5 text-white placeholder-ios-textSecondary focus:outline-none focus:border-ios-blue transition-colors text-[17px]"
            />
          </div>

          {text.trim() ? (
             <button 
             onClick={handleSend}
             className="p-2.5 rounded-full bg-ios-blue text-white animate-scale-press shadow-lg"
           >
             <Send />
           </button>
          ) : (
            <button className="p-2.5 text-ios-textSecondary hover:text-white transition-colors">
              <Mic />
            </button>
          )}
         
        </div>
      </div>

      {/* Media Sheet */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 bg-ios-gray z-40 transition-transform duration-300 ease-in-out border-t border-ios-separator rounded-t-2xl shadow-2xl
          ${isMediaSheetOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ height: '320px', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-5 h-full overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-white font-semibold text-xl">Photos</h3>
            <button className="text-ios-blue text-[17px]">See All</button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-6">
            <button className="aspect-square bg-ios-lightGray rounded-xl flex flex-col items-center justify-center text-ios-textSecondary hover:bg-ios-separator transition-colors active:scale-95">
              <Camera />
              <span className="text-xs mt-2 font-medium">Camera</span>
            </button>
            {SUGGESTED_PHOTOS.map((url, idx) => (
              <img 
                key={idx} 
                src={url} 
                alt="Recent" 
                className="aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
                onClick={() => {
                  onSendMessage(`[Photo Shared]`); // Mock sending photo
                  setIsMediaSheetOpen(false);
                }}
              />
            ))}
          </div>

          <div className="space-y-2">
             <div className="text-ios-textSecondary text-xs uppercase font-bold tracking-wider mb-3">Apps</div>
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
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" 
          style={{ bottom: '320px' }}
          onClick={() => setIsMediaSheetOpen(false)}
        />
      )}
    </>
  );
};

export default InputArea;