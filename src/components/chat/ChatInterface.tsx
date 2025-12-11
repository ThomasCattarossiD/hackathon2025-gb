"use client";

import { useChat } from "@ai-sdk/react";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, Volume2, VolumeX, User, StopCircle, ArrowDown } from "lucide-react"; // Assure-toi d'avoir lucide-react
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import ReactMarkdown from "react-markdown";
import ReservationsSidebar, { Reservation } from "./ReservationsSidebar";
import { Separator } from "../ui/separator";


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
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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
        
        // Debug logging pour voir la structure des messages
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            console.log('📩 Dernier message:', {
                role: lastMessage.role,
                id: lastMessage.id,
                partsLength: lastMessage.parts?.length
            });
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

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);
        };

        loadVoices();
        
        // Chrome charge les voix de manière asynchrone, on s'abonne à l'événement
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

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
        
        setIsSoundEnabled(true); 

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

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Si on est remonté de plus de 100px par rapport au bas, on affiche le bouton
        const isBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isBottom);
    };

    const scrollToBottom = () => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      // Optionnel : on cache le bouton tout de suite après le clic
      setShowScrollButton(false);
    };

    const speakText = (text: string) => {
        if (!isSoundEnabled) return; 

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // --- LOGIQUE VOIX NATURELLE ---
        // 1. On filtre les voix françaises
        const frenchVoices = voices.filter(voice => voice.lang.includes('fr'));

        // 2. On cherche en priorité une voix "Google" ou "Natural" (Edge)
        let preferredVoice = frenchVoices.find(voice => 
            voice.name.includes("Google") || 
            voice.name.includes("Natural") || 
            voice.name.includes("Premium")
        );

        // 3. Fallback : si pas de voix "premium", on prend la première voix FR dispo
        if (!preferredVoice && frenchVoices.length > 0) {
            preferredVoice = frenchVoices[0];
        }

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        // ------------------------------

        utterance.lang = "fr-FR"; 
        utterance.rate = 1; // Une vitesse de 1.1 est souvent plus naturelle et moins "traînante"
        utterance.pitch = 1; 

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    };  

    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsSoundEnabled(false);
    };

    const handleReject = (messageId: string) => {
        setMessages((prevMessages) =>
            prevMessages.map((msg) =>
                msg.id === messageId ? { ...msg, actionStatus: "rejected" } : msg
            )
        );
        alert("Salle refusé");

    };

    const handleConfirm = (messageId: string) => {
        setMessages((prevMessages) =>
            prevMessages.map((msg) =>
                msg.id === messageId ? { ...msg, actionStatus: "accepted" } : msg
            )
        );
        alert("Salle réservée");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground md:w-[30%] mx-auto">
      
      {/* 2. HEADER (Fixe) */}
      {/* shrink-0 empêche le header de s'écraser si manque de place */}
      <div className="shrink-0 flex items-center justify-center p-4 border-b bg-card/50 backdrop-blur-sm z-10 relative">
        
        {/* Menu Gauche */}
        <div className="absolute left-4 inset-y-0 flex items-center">
          <ReservationsSidebar reservations={reservations} />
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-semibold tracking-tight">RoomBarber</h1>

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

      {/* 3. ZONE DE MESSAGES (Scrollable) */}
      <div 
        className="flex-1 w-full p-4 overflow-y-auto scroll-smooth" 
        onScroll={handleScroll}
      >
        <div className="space-y-4 pb-4">
          {messages
            .filter((message) => {
              // Toujours afficher les messages utilisateur
              if (message.role === "user") return true;
              
              // Pour les messages assistant : vérifier qu'il y a du contenu
              if (!message.parts || message.parts.length === 0) return false;
              
              // Afficher si :
              // 1) Il y a du texte normal
              const hasText = message.parts.some(
                (part: any) => part.type === "text" && part.text?.trim().length > 0
              );
              
              // 2) OU il y a un résultat de tool avec du texte
              const hasToolOutput = message.parts.some(
                (part: any) => part.type?.startsWith("tool-") && part.output?.text?.trim().length > 0
              );
              
              return hasText || hasToolOutput;
            })
            .map((message) => (
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
                  {/* Afficher le texte ET les résultats des tools */}
                  {message.parts && message.parts.length > 0 && (
                    <div
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
                      {message.parts
                        .map((part: any, idx: number) => {
                          // Afficher les parties texte normales
                          if (part.type === "text") {
                            return <ReactMarkdown key={idx}>{part.text}</ReactMarkdown>;
                          }
                          
                          // Afficher les résultats des tool calls (checkAvailability, createBooking, etc.)
                          if (part.type?.startsWith("tool-") && part.output?.text) {
                            return <ReactMarkdown key={idx}>{part.output.text}</ReactMarkdown>;
                          }
                          
                          return null;
                        })
                        .filter(Boolean)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Div pour scroll auto */}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* 4. FOOTER (Fixe) */}
      {/* shrink-0 : Empêche le footer de disparaître */}
      <div className="shrink-0 py-2 px-4 bg-background border-t z-10 relative">
        
        {isSpeaking && (
            <div className="absolute -top-14 left-0 right-0 flex justify-center z-20 pointer-events-none">
                <Button variant="secondary" size="sm" className="shadow-lg bg-background/90 backdrop-blur border border-primary/20 text-primary animate-in fade-in slide-in-from-bottom-2 pointer-events-auto gap-2 rounded-full pr-4 pl-3" onClick={stopSpeaking}>
                     <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span></span>
                    <span className="text-sm font-semibold">L'IA parle... (Couper)</span>
                    <StopCircle size={16} />
                </Button>
            </div>
        )}

        {showScrollButton && (
            <div className="absolute -top-14 right-4 z-20">
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full h-10 w-10 shadow-md bg-background/80 backdrop-blur border border-border animate-in zoom-in-50" 
                    onClick={scrollToBottom}
                >
                    <ArrowDown size={20} className="text-muted-foreground" />
                    <span className="sr-only">Voir les nouveaux messages</span>
                </Button>
            </div>
        )}

        <div className="flex items-center gap-3 py-4">
            <Button variant={isRecording ? "destructive" : "outline"} size="icon" className="rounded-full shrink-0 h-12 w-12" onClick={handleVoiceRecord}>
            <Mic className={`!h-7 !w-7 ${isRecording ? "animate-pulse" : ""}`} />
            <span className="sr-only">Reconnaissance vocale</span>
            </Button>

            <Input className="flex-1 rounded-full bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary h-12 px-5 text-base" placeholder="Écrivez votre message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}/>

            <Button size="icon" className="rounded-full shrink-0 h-12 w-12 disabled:bg-gray-400" onClick={handleSend} disabled={!input.trim()} variant={"custom"}>
            <Send className="!h-7 !w-7" />
            <span className="sr-only">Envoyer</span>
            </Button>
        </div>
      </div>
    </div>
  );
}