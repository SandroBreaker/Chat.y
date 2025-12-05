import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, Camera, Bell } from '../Icons';
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

  const handleSendNudge = () => {
    onSendMessage('[NUDGE]');
    setIsMediaSheetOpen(false);
  };

  // --- Image Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `img_${Date.now()}.${fileExt}`;
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
      onSendMessage(`[IMAGE]${data.publicUrl}`);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Error uploading image: ${error.message}`);
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
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : 'audio/webm';
        
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const fileExt = mimeType.split('/')[1]; 
        const fileName = `audio_${Date.now()}.${fileExt}`;
        
        setUploading(true);
        try {
          const { error: uploadError } = await supabase.storage
            .from('files_chat.y')
            .upload(fileName, audioBlob);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('files_chat.y').getPublicUrl(fileName);
          onSendMessage(`[AUDIO]${data.publicUrl}`);
        } catch (error: any) {
          console.error('Error uploading audio:', error);
          alert(`Error sending audio: ${error.message}`);
        } finally {
          setUploading(false);
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

      {/* Input Bar - Reduced vertical padding slightly to tighten the look */}
      <div className="relative z-50 bg-ios-gray/90 backdrop-blur-xl border-t border-ios-separator pb-safe transition-all duration-300 ease-ios">
        <div className="flex items-center gap-3 px-3 py-2">
          <button 
            className={`p-2 rounded-full bg-ios-lightGray text-ios-textSecondary transition-all duration-300 ease-ios active:scale-95 ${isMediaSheetOpen ? 'rotate-45 bg-ios-blue text-white' : ''}`}
            onClick={() => setIsMediaSheetOpen(!isMediaSheetOpen)}
            disabled={isRecording}
          >
            <Plus />
          </button>

          <div className="flex-1 relative">
             {isRecording ? (
               <div className="w-full bg-red-500/10 border border-red-500/30 rounded-full py-2 px-4 flex items-center justify-between text-red-500 animate-pulse-slow">
                 <span className="text-[15px] font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Recording...
                 </span>
                 <button onClick={stopRecording} className="text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full">STOP</button>
               </div>
             ) : uploading ? (
                <div className="w-full bg-ios-lightGray border border-ios-separator rounded-full py-2 px-5 text-ios-textSecondary text-center text-sm italic animate-pulse">
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
                  className="w-full bg-black border border-ios-separator rounded-full py-2 px-4 text-white placeholder-ios-textSecondary focus:outline-none focus:border-ios-blue transition-colors duration-300 text-[17px]"
                />
             )}
          </div>

          {text.trim() ? (
             <button 
             onClick={handleSend}
             className="p-2 rounded-full bg-ios-blue text-white animate-scale-press shadow-lg transition-transform"
           >
             <Send />
           </button>
          ) : (
            <button 
              className={`p-2 transition-all duration-200 ${isRecording ? 'text-red-500 scale-110' : 'text-ios-textSecondary hover:text-white'}`}
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
          absolute bottom-0 left-0 right-0 bg-ios-gray z-40 transition-transform duration-500 ease-ios-spring border-t border-ios-separator rounded-t-2xl shadow-2xl
          ${isMediaSheetOpen ? 'translate-y-0' : 'translate-y-full invisible'}
        `}
        style={{ height: '320px', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-5 h-full overflow-y-auto no-scrollbar pt-4">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-white font-semibold text-xl">Apps & Media</h3>
            <button className="text-ios-blue text-[17px] active:opacity-50" onClick={triggerFileSelect}>All Photos</button>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <button 
              onClick={triggerFileSelect}
              className="aspect-square bg-ios-lightGray rounded-xl flex flex-col items-center justify-center text-ios-textSecondary hover:bg-ios-separator transition-all duration-200 active:scale-95 col-span-1"
            >
              <Camera />
              <span className="text-[10px] mt-2 font-medium">Camera</span>
            </button>
            
            <button 
              onClick={handleSendNudge}
              className="aspect-square bg-ios-lightGray/50 border border-yellow-500/30 rounded-xl flex flex-col items-center justify-center text-yellow-500 hover:bg-yellow-900/20 transition-all duration-200 active:scale-95 col-span-1"
            >
              <Bell />
              <span className="text-[10px] mt-2 font-medium text-center leading-tight">Chamar<br/>Atenção</span>
            </button>

            {SUGGESTED_PHOTOS.slice(0, 2).map((url, idx) => (
              <img 
                key={idx} 
                src={url} 
                alt="Recent" 
                className="aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition-all duration-200 active:scale-95 col-span-1"
                onClick={() => {
                  onSendMessage(`[IMAGE]${url}`); 
                  setIsMediaSheetOpen(false);
                }}
              />
            ))}
          </div>

          <div className="space-y-2">
             <div className="text-ios-textSecondary text-xs uppercase font-bold tracking-wider mb-3">Suggested Photos</div>
             <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                {SUGGESTED_PHOTOS.map((url, i) => (
                  <img 
                    key={i}
                    src={url} 
                    className="flex-shrink-0 w-20 h-20 rounded-xl object-cover active:scale-95 transition-transform duration-200"
                    onClick={() => {
                        onSendMessage(`[IMAGE]${url}`); 
                        setIsMediaSheetOpen(false);
                      }}
                  />
                ))}
             </div>
          </div>
        </div>
      </div>
      
      {isMediaSheetOpen && (
        <div 
          className="absolute inset-0 z-30 bg-black/20 backdrop-blur-[1px] transition-opacity duration-300" 
          style={{ bottom: '320px', top: '-1000px' }} 
          onClick={() => setIsMediaSheetOpen(false)}
        />
      )}
    </>
  );
};

export default InputArea;