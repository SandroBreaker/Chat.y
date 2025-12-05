import React, { useEffect, useState } from 'react';
import { Profile } from '../types';
import { PhoneOff, MicOff, Speaker, Keypad, Video, Mic, Plus } from './Icons';

interface CallOverlayProps {
  contact: Profile;
  onEndCall: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ contact, onEndCall }) => {
  const [status, setStatus] = useState('calling...');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Simula tempo para atender
    const connectTimer = setTimeout(() => {
      setStatus('00:00');
    }, 2500);

    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (status !== 'calling...' && status !== 'connecting...') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#121212]/95 backdrop-blur-md flex flex-col items-center pt-safe pb-safe animate-fade-in text-white">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-8 gap-8 mt-10">
        
        {/* Header Info */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
             <span className="text-ios-textSecondary text-lg flex items-center gap-2">
                iPhone <span className="text-xs px-1 border border-ios-textSecondary rounded">App</span>
             </span>
             <h2 className="text-4xl font-normal text-center leading-tight">{contact.username}</h2>
             <span className="text-xl text-white/60 font-light mt-1">
               {status === '00:00' || duration > 0 ? formatDuration(duration) : status}
             </span>
          </div>

          <div className="mt-8">
             <img 
               src={contact.avatar_url} 
               alt={contact.username} 
               className="w-32 h-32 rounded-full object-cover shadow-2xl border-2 border-white/10"
             />
          </div>
        </div>

        {/* Controls Grid */}
        <div className="w-full grid grid-cols-3 gap-x-4 gap-y-6 mt-auto mb-10">
           {/* Row 1 */}
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <MicOff />
              </button>
              <span className="text-xs font-medium">mute</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <Keypad />
              </button>
              <span className="text-xs font-medium">keypad</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <Speaker />
              </button>
              <span className="text-xs font-medium">speaker</span>
           </div>

           {/* Row 2 */}
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <Plus />
              </button>
              <span className="text-xs font-medium">add call</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <Video />
              </button>
              <span className="text-xs font-medium">FaceTime</span>
           </div>
           <div className="flex flex-col items-center gap-2">
              <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center active:bg-white/30 transition-colors">
                 <div className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[10px]">?</div>
              </button>
              <span className="text-xs font-medium">contacts</span>
           </div>
        </div>

        {/* End Call Button */}
        <div className="mb-12">
          <button 
            onClick={onEndCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg active:scale-95 transition-all"
          >
             <PhoneOff />
          </button>
        </div>

      </div>
    </div>
  );
};

export default CallOverlay;