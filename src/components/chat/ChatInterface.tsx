"use client";

import { useChat } from "@ai-sdk/react";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, User, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import ReactMarkdown from "react-markdown";
import ReservationsSidebar, { Reservation } from "./ReservationsSidebar";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

type UserProfile = {
    name: string;
    email: string;
    avatarUrl: string;
    role: string;
};

interface ChatInterfaceProps {
    userId?: string;
}

export default function ChatInterface({ userId }: ChatInterfaceProps) {
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [reservations, setReservations] = useState<Reservation[]>([]);

    const { messages, sendMessage, status } = useChat({
        api: "/api/chat",
        id: "chat-interface"
    } as any);

    const loadUserProfile = async () => {
        try {
            // Récupérer l'utilisateur depuis notre système d'authentification (session_token)
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                setUserProfile({
                    name: "Utilisateur",
                    email: "user@goodbarber.com",
                    avatarUrl: "https://github.com/shadcn.png",
                    role: "Employé GoodBarber"
                });
                return;
            }
            
            const authData = await res.json();
            if (authData.user) {
                setUserProfile({
                    name: authData.user.fullName || authData.user.email.split('@')[0],
                    email: authData.user.email,
                    avatarUrl: "https://github.com/shadcn.png",
                    role: authData.user.society || "Employé GoodBarber"
                });
            }
        } catch (error) {
            console.error('Erreur chargement profil:', error);
            setUserProfile({
                name: "Utilisateur",
                email: "user@goodbarber.com",
                avatarUrl: "https://github.com/shadcn.png",
                role: "Employé GoodBarber"
            });
        }
    };

    const loadReservations = async () => {
        try {
            // Récupérer l'utilisateur depuis le session_token
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                setReservations([]);
                return;
            }
            
            const authData = await res.json();
            if (!authData.user?.id) {
                setReservations([]);
                return;
            }

            const today = new Date().toISOString();
            const { data: meetings, error } = await supabase
                .from('meetings')
                .select(`
                    id,
                    title,
                    start_time,
                    end_time,
                    rooms(name)
                `)
                .eq('user_id', authData.user.id)
                .gte('start_time', today)
                .order('start_time', { ascending: true })
                .limit(10);

            if (error) {
                console.error('Erreur chargement réservations:', error);
                return;
            }

            if (meetings) {
                const formatted = meetings.map((meeting: Record<string, unknown>) => {
                    // Convertir les dates UTC en heure locale Paris (UTC+1)
                    const startUTC = new Date(meeting.start_time as string);
                    const endUTC = new Date(meeting.end_time as string);
                    
                    return {
                        id: (meeting.id as string).toString(),
                        roomName: ((meeting.rooms as any)?.name || 'Salle inconnue') as string,
                        date: startUTC.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Europe/Paris'
                        }),
                        startTime: startUTC.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris'
                        }),
                        endTime: endUTC.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Europe/Paris'
                        }),
                        status: 'confirmé' as const
                    };
                });
                setReservations(formatted);
                console.log('✅ Réservations chargées:', formatted.length);
            }
        } catch (error) {
            console.error('Erreur fetch réservations:', error);
        }
    };

    useEffect(() => {
        loadUserProfile();
        loadReservations();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Rafraîchir les réservations après chaque message (pour détecter les nouvelles réservations)
    useEffect(() => {
        if (messages.length > 0) {
            // Attendre un peu pour laisser le temps au backend de traiter la réservation
            const timer = setTimeout(() => {
                loadReservations();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage({ text: input });
        setInput("");
    };

    const handleVoiceRecord = () => {
        if (isRecording) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "fr-FR";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setInput(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Erreur reconnaissance vocale :", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground md:w-[30%] mx-auto">
      
      {/* HEADER */}
      <div className="relative flex items-center justify-center p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        
        {/* GAUCHE : Menu Réservations */}
        <div className="absolute left-4 inset-y-0 flex items-center">
          <ReservationsSidebar reservations={reservations} />
        </div>

        {/* Titre centré */}
        <h1 className="text-lg font-semibold tracking-tight">RoomBarber</h1>

        {/* Bouton Profil */}
        <div className="absolute right-4 inset-y-0 flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 bg-muted p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={userProfile?.avatarUrl || "https://github.com/shadcn.png"}
                    alt={userProfile?.name || "Utilisateur"}
                    className="object-cover"
                  />
                  <AvatarFallback><User size={16} /></AvatarFallback>
                </Avatar>
              </Button>
            </PopoverTrigger>

            {userProfile && (
              <PopoverContent className="w-80 mr-4" align="end">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none text-muted-foreground">Mon Compte</h4>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                      <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                        <AvatarImage src={userProfile.avatarUrl} />
                        <AvatarFallback>GB</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm flex items-center gap-1">
                          {userProfile.name}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {userProfile.role}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {userProfile.email}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            )}
          </Popover>
        </div>
      </div>

      {/* ZONE DE MESSAGES */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex w-full ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex max-w-[85%] md:max-w-[70%] items-end gap-2 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={message.role === "assistant" ? "bg-primary text-primary-foreground" : ""}>
                    {message.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                  </AvatarFallback>
                </Avatar>

                {/* Bulle de message */}
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-full ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-muted-foreground rounded-bl-none"
                  }`}
                >
                  {message.parts?.map((part: any, idx: number) =>
                    part.type === "text" ? (
                      <div
                        key={idx}
                        className={`prose prose-sm max-w-none
                          [&_strong]:font-semibold
                          [&_em]:italic
                          [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                          [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-2
                          [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-2
                          [&_li]:mb-1
                          [&_a]:text-blue-600 [&_a]:underline
                          [&_p]:my-1
                          ${message.role === "user" 
                            ? "[&_a]:text-blue-300 [&_strong]:text-white [&_code]:bg-blue-500 [&_code]:text-white" 
                            : ""
                          }
                        `}
                      >
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {status === "streaming" && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* BARRE D'INPUT */}
      <div className="p-6 bg-background border-t sticky bottom-0 z-10">
        <div className="flex items-center gap-2">
          
          {/* Bouton Vocal */}
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            className="rounded-full shrink-0"
            onClick={handleVoiceRecord}
          >
            <Mic size={20} className={isRecording ? "animate-pulse" : ""} />
            <span className="sr-only">Reconnaissance vocale</span>
          </Button>

          {/* Champ Texte */}
          <Input
            className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="Écrivez votre message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status === "streaming"}
          />

          {/* Bouton Envoyer */}
          <Button 
            size="icon" 
            className="rounded-full shrink-0" 
            onClick={handleSend}
            disabled={!input.trim() || status === "streaming"}
          >
            {status === "streaming" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            <span className="sr-only">Envoyer</span>
          </Button>
        </div>
      </div>
    </div>
  );
}