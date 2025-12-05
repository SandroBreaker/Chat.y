import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // Cadastro
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;

        if (authData.user) {
          // Criar perfil na tabela profilesMSP
          const { error: profileError } = await supabase.from('profilesMSP').insert([
            {
              id: authData.user.id,
              email: email,
              username: username || email.split('@')[0],
              avatar_url: `https://ui-avatars.com/api/?name=${username || email}&background=0A84FF&color=fff`
            }
          ]);
          if (profileError) console.error('Error creating profile:', profileError);
        }
      } else {
        // Login
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black px-8 animate-slide-up">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-bold text-white tracking-tight">Amour</h1>
           <p className="text-ios-textSecondary text-[17px]">Connect with your loved one.</p>
        </div>

        {error && (
          <div className="bg-red-900/40 text-red-200 p-4 rounded-xl text-sm border border-red-800/50 backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Username</label>
               <input
                 type="text"
                 placeholder="Enter your name"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
                 required={isSignUp}
               />
            </div>
          )}
          
          <div className="flex flex-col gap-1.5">
             <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Email</label>
             <input
               type="email"
               placeholder="hello@example.com"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
               required
             />
          </div>
          
          <div className="flex flex-col gap-1.5">
             <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Password</label>
             <input
               type="password"
               placeholder="••••••••"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
               required
             />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ios-blue text-white font-bold py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-ios-blue/20"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-ios-blue text-[15px] font-medium hover:underline transition-all"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'New here? Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}