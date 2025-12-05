import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, Camera } from '../Icons';
import { SUGGESTED_PHOTOS } from '../../constants';
import { supabase } from '../../supabaseClient';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage }) => {
  const [text, setText] = useState('');
  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // --- Image Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploading(true);
    setIsMediaSheetOpen(false);

    try {
      const { error: uploadError } = await supabase.storage
        .from('files_chat.y')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('files_chat.y').getPublicUrl(filePath);
      
      // Send as a specially formatted string that MessageBubble will parse
      onSendMessage(`[IMAGE]${data.publicUrl}`);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Make sure "files_chat.y" bucket exists and is public.');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `audio_${Date.now()}.webm`;
        
        setUploading(true);
        try {
          const { error: uploadError } = await supabase.storage
            .from('files_chat.y')
            .upload(fileName, audioBlob);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('files_chat.y').getPublicUrl(fileName);
          onSendMessage(`[AUDIO]${data.publicUrl}`);
        } catch (error) {
          console.error('Error uploading audio:', error);
          alert('Error sending audio. Check bucket "files_chat.y" permissions.');
        } finally {
          setUploading(false);
          // Stop all tracks to release mic
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Input Bar */}
      <div className="bg-ios-gray/80 backdrop-blur-xl border-t border-ios-separator pb-safe transition-all duration-200">
        <div className="flex items-center gap-3 px-3 py-3">
          <button 
            className={`p-2.5 rounded-full bg-ios-lightGray text-ios-textSecondary transition-all active:scale-95 ${isMediaSheetOpen ? 'rotate-45 bg-ios-blue text-white' : ''}`}
            onClick={() => setIsMediaSheetOpen(!isMediaSheetOpen)}
            disabled={isRecording}
          >
            <Plus />
          </button>

          <div className="flex-1 relative">
             {isRecording ? (
               <div className="w-full bg-red-500/10 border border-red-500/30 rounded-full py-2.5 px-5 flex items-center justify-between text-red-500 animate-pulse-slow">
                 <span className="text-[15px] font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Recording...
                 </span>
                 <button onClick={stopRecording} className="text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full">STOP</button>
               </div>
             ) : uploading ? (
                <div className="w-full bg-ios-lightGray border border-ios-separator rounded-full py-2.5 px-5 text-ios-textSecondary text-center text-sm italic">
                  Uploading media...
                </div>
             ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="iMessage"
                  className="w-full bg-black border border-ios-separator rounded-full py-2.5 px-5 text-white placeholder-ios-textSecondary focus:outline-none focus:border-ios-blue transition-colors text-[17px]"
                />
             )}
          </div>

          {text.trim() ? (
             <button 
             onClick={handleSend}
             className="p-2.5 rounded-full bg-ios-blue text-white animate-scale-press shadow-lg"
           >
             <Send />
           </button>
          ) : (
            <button 
              className={`p-2.5 transition-colors ${isRecording ? 'text-red-500 scale-110' : 'text-ios-textSecondary hover:text-white'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
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
            <button className="text-ios-blue text-[17px]" onClick={triggerFileSelect}>All Photos</button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-6">
            <button 
              onClick={triggerFileSelect}
              className="aspect-square bg-ios-lightGray rounded-xl flex flex-col items-center justify-center text-ios-textSecondary hover:bg-ios-separator transition-colors active:scale-95"
            >
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
                  onSendMessage(`[IMAGE]${url}`); 
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