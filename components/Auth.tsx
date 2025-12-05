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
    <div className="flex flex-col items-center justify-center h-full bg-black px-6 animate-slide-up">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Amour Message</h1>
        <p className="text-ios-textSecondary text-center mb-8">Connect with your loved one.</p>

        {error && (
          <div className="bg-red-900/50 text-red-200 p-3 rounded-lg text-sm mb-4 border border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-ios-lightGray border border-ios-separator rounded-xl py-3 px-4 text-white focus:outline-none focus:border-ios-blue transition-colors"
              required={isSignUp}
            />
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-ios-lightGray border border-ios-separator rounded-xl py-3 px-4 text-white focus:outline-none focus:border-ios-blue transition-colors"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-ios-lightGray border border-ios-separator rounded-xl py-3 px-4 text-white focus:outline-none focus:border-ios-blue transition-colors"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ios-blue text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mt-4"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-ios-blue text-sm hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'New here? Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}