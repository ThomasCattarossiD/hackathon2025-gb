"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true); // Basculer entre Login et Sign Up
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // États du formulaire
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // --- ICI : C'est là que vous mettrez la vraie connexion Supabase plus tard ---
    
    // Simulation d'attente (pour l'effet UI)
    setTimeout(() => {
      setIsLoading(false);
      // Redirection vers le chat (la page d'accueil)
      router.push("/"); 
    }, 1500);
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-gray-50 dark:bg-black p-4">
      
      {/* Carte principale */}
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
        
        {/* En-tête avec Logo */}
        <div className="pt-8 pb-6 px-8 text-center bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10">
          <div className="w-12 h-12 bg-black rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-blue-600/20 mb-4">
            <span className="text-white font-bold text-lg">R</span>
            <span className="text-[#fe6c75] font-bold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            RoomBarber
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLogin ? "Heureux de vous revoir 👋" : "Créez votre espace de travail 🚀"}
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleAuth} className="px-8 pb-8 space-y-5">
          
          {/* Champ Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 ml-1 uppercase tracking-wider">Email</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#fe6c75] transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@goodbarber.com"
                className="w-full bg-gray-70 dark:bg-zinc-800 dark:text-white border border-gray-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-[#fe6c75] transition-all text-sm font-medium"
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 ml-1 uppercase tracking-wider">Mot de passe</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#fe6c75] transition-colors" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}        
                className="w-full bg-gray-70 dark:bg-zinc-800 dark:text-white border border-gray-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-10 outline-none focus:border-[#fe6c75] transition-all text-sm font-medium"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Bouton d'action principal */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#fe6c75] active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isLogin ? "Se connecter" : "S'inscrire"}
                {/* <ArrowRight size={20} /> */}
              </>
            )}
          </button>

          {/* Séparateur */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100 dark:border-zinc-800"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-400">OU</span>
            <div className="flex-grow border-t border-gray-100 dark:border-zinc-800"></div>
          </div>

          {/* Toggle Login / Inscription */}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            {isLogin ? "Pas encore de compte ?" : "Déjà membre ?"}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-1 font-bold text-black hover:underline focus:outline-none"
            >
              {isLogin ? "Créer un compte" : "Se connecter"}
            </button>
          </p>

        </form>
      </div>
      
      {/* Footer discret */}
      <div className="absolute bottom-6 text-center w-full">
        <p className="text-[10px] text-gray-400">
            Hackathon 2025 • RoomBarber Project
        </p>
      </div>
    </div>
  );
}