import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  
  // Login Mode State
  const [identity, setIdentity] = useState(''); // Stores Email OR Username for login
  
  // Sign Up Mode States
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  
  // Shared
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // --- CADASTRO ---
        // 1. Criar usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username } // Salva metadata caso precise
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          // 2. Criar perfil na tabela pública
          const { error: profileError } = await supabase.from('profilesMSP').insert([
            {
              id: authData.user.id,
              email: email,
              username: username || email.split('@')[0],
              avatar_url: `https://ui-avatars.com/api/?name=${username || email}&background=0A84FF&color=fff`
            }
          ]);
          
          if (profileError) {
             console.error('Error creating profile:', profileError);
             // Se der erro no perfil, mas criou o user, não bloqueamos o fluxo crítico, 
             // mas idealmente deveria tratar/reverter.
          }
        }
      } else {
        // --- LOGIN ---
        let emailToLogin = identity.trim();

        // Se NÃO parece um email (não tem @), assumimos que é username
        if (!emailToLogin.includes('@')) {
           const { data: profile, error: profileError } = await supabase
             .from('profilesMSP')
             .select('email')
             .eq('username', identity)
             .single();

           if (profileError || !profile) {
             throw new Error("Usuário não encontrado.");
           }
           
           emailToLogin = profile.email;
        }

        // Autentica com o email (fornecido ou descoberto)
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: emailToLogin,
          password,
        });

        if (authError) throw authError;
      }
      
      onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message === "Invalid login credentials" ? "Credenciais inválidas." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black px-8 animate-slide-up">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-bold text-white tracking-tight">Amour</h1>
           <p className="text-ios-textSecondary text-[17px]">
             {isSignUp ? "Crie sua conta para começar." : "Conecte-se com quem você ama."}
           </p>
        </div>

        {error && (
          <div className="bg-red-900/40 text-red-200 p-4 rounded-xl text-sm border border-red-800/50 backdrop-blur-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          
          {isSignUp ? (
            /* --- CAMPOS DE CADASTRO --- */
            <>
              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Usuário</label>
                 <input
                   type="text"
                   placeholder="Seu nome de usuário"
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                   className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
                   required
                 />
              </div>

              <div className="flex flex-col gap-1.5">
                 <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Email</label>
                 <input
                   type="email"
                   placeholder="seu@email.com"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
                   required
                 />
              </div>
            </>
          ) : (
            /* --- CAMPO DE LOGIN (Híbrido) --- */
            <div className="flex flex-col gap-1.5">
               <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Login</label>
               <input
                 type="text"
                 placeholder="Email ou Nome de Usuário"
                 value={identity}
                 onChange={(e) => setIdentity(e.target.value)}
                 className="w-full bg-ios-lightGray/50 border border-ios-separator rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-ios-blue transition-all focus:bg-ios-lightGray"
                 required
                 autoCapitalize="none"
               />
            </div>
          )}
          
          <div className="flex flex-col gap-1.5">
             <label className="text-xs font-bold text-ios-textSecondary uppercase tracking-wider ml-1">Senha</label>
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
            {loading ? 'Processando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setPassword('');
              // Reset specific fields
              if (isSignUp) setIdentity(''); 
              else { setEmail(''); setUsername(''); }
            }}
            className="text-ios-blue text-[15px] font-medium hover:underline transition-all"
          >
            {isSignUp ? 'Já tem uma conta? Entrar' : 'Novo aqui? Criar Conta'}
          </button>
        </div>
      </div>
    </div>
  );
}