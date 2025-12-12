"use client";

import { useChat } from "@ai-sdk/react";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, Volume2, VolumeX, User, StopCircle, ArrowDown, Check, X,
  MapPin, Calendar, Clock, Monitor, Wifi, Wind, Video, Users 
 } from "lucide-react"; // Assure-toi d'avoir lucide-react
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import ReactMarkdown from "react-markdown";
import ReservationsSidebar, { Reservation } from "./ReservationsSidebar";
import { Separator } from "../ui/separator";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import ReservationCard, { isProposalFormat, parseConfirmationText } from "./ConfirmationCard"; 

  

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

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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
    const [answeredConfirmations, setAnsweredConfirmations] = useState<Set<string>>(new Set());

    const { messages, setMessages, sendMessage, status } = useChat({
        api: "/api/chat",
        id: "chat-interface"
    } as any);

    const loadUserProfile = async () => {
        try {
            // Récupérer l'utilisateur depuis notre système d'authentification (session_token)
            const res = await fetch('/api/auth/me', {
                credentials: 'include',
            });
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
                    role: authData.user.society || "Employé GoodBarbe r"
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
            const res = await fetch('/api/auth/me', {
                credentials: 'include',
            });
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

    useEffect(() => {
      if (!messages.length) return;

      const last = messages[messages.length - 1];

      // On ne lit QUE les messages de l'assistant
      if (last.role !== "assistant") return;

      if (last.id === "welcome-message") return; 

      // Récupérer le texte final consolidé
      const fullText = last.parts
          ?.map((p: any) => {
              if (p.type === "text") return p.text;
              if (p.type?.startsWith("tool-") && p.output?.text) return p.output.text;
              return "";
          })
          .join("\n")
          .trim();

      if (fullText && isSoundEnabled) {
          // --- MODIFICATION ICI ---
          // On transforme le texte avant de le lire
          const cleanText = processTextForTTS(fullText);
          speakText(cleanText);
      }
    }, [messages, voices, isSoundEnabled]); // Ajout de isSoundEnabled dans les dépendances

    useEffect(() => {
        if (!isSoundEnabled) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [isSoundEnabled]);

    useEffect(() => {
        // On vérifie si la liste est vide pour ne pas écraser une conversation en cours
        if (messages.length === 0) {
            setMessages([
                {
                    id: "welcome-message", // ID fixe pour pouvoir l'identifier
                    role: "assistant",
                    content: "Message d'accueil", // Fallback
                    createdAt: new Date(),
                    // Important : on structure 'parts' comme le reste de ton app l'attend
                    parts: [
                        { 
                            type: "text", 
                            text: "👋 **Bonjour ! Je suis RoomBarber.**\n\nJe suis là pour vous aider à trouver et réserver une salle de réunion." 
                        }
                    ]
                } as any
            ]);
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

    const handleReject = (messageId: string, roomName?: string) => {
        // Mark this confirmation as answered
        setAnsweredConfirmations(prev => new Set(prev).add(messageId));
        // Send a rejection message to the AI
        sendMessage({ text: `Non, je ne veux pas de la salle ${roomName || 'proposée'}. Proposez-moi une autre salle.` });
    };

    const handleConfirm = (messageId: string, roomName?: string) => {
        // Mark this confirmation as answered
        setAnsweredConfirmations(prev => new Set(prev).add(messageId));
        // Send a confirmation message to the AI
        sendMessage({ text: `Oui, je confirme la réservation de la salle ${roomName || 'proposée'}.` });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

    // Fonction pour transformer le texte brut de l'IA en texte naturel pour la voix
  const processTextForTTS = (text: string): string => {
      // 1. Détection : Est-ce une proposition de salle formatée ?
      if (text.includes("✅") && text.includes("⏰") && text.includes("📅")) {
          try {
              // Extraction des données via Regex
              const name = text.match(/✅\s*(.*?)\s*🆔/)?.[1]?.trim() || "une salle";
              const dateStr = text.match(/📅\s*(\d{2}\/\d{2}\/\d{4})/)?.[1]; // ex: 13/12/2025
              const timeMatch = text.match(/⏰\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
              
              let spokenDate = "ce jour";
              
              // Conversion de la date (13/12/2025 -> "13 décembre")
              if (dateStr) {
                  const [day, month, year] = dateStr.split('/').map(Number);
                  const dateObj = new Date(year, month - 1, day);
                  spokenDate = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
              }

              // Construction de la phrase naturelle
              if (timeMatch) {
                  const start = timeMatch[1].replace(':', ' heure ');
                  const end = timeMatch[2].replace(':', ' heure ');
                  return `J'ai trouvé la salle ${name.replace(/^\*+/, "").replace(/\*+$/, "")}. Elle est disponible le ${spokenDate}, de ${start} à ${end}. Souhaitez-vous la réserver ?`;
              }
          } catch (e) {
              console.error("Erreur parsing TTS", e);
          }
      }

      // 2. Si ce n'est pas une proposition, nettoyage standard
      return text
          // Enlève le Markdown gras/italique (**mot**, *mot*)
          .replace(/(\*\*|__)(.*?)\1/g, '$2')
          .replace(/(\*|_)(.*?)\1/g, '$2')
          // Enlève les liens [texte](url) -> texte
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          // Enlève les émojis courants utilisés par le bot
          .replace(/[✅🆔📍👥🛠️📅⏰👋🛑❌👉]/g, '')
          // Nettoie les espaces multiples créés par la suppression
          .trim()
          .replace(/\s+/g, ' ');
  };

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground md:w-[30%] mx-auto">
      
      {/* 2. HEADER (Fixe) */}
      <div className="shrink-0 flex items-center justify-center p-4 border-b bg-card/50 backdrop-blur-sm z-10 relative">
        
        {/* Menu Gauche */}
        <div className="absolute left-4 inset-y-0 flex items-center">
          <ReservationsSidebar 
            reservations={reservations} 
            onReservationDeleted={loadReservations}
          />
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
                className="rounded-full h-12 w-12 bg-muted p-0">
                <Avatar className="h-12 w-12">
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
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {isSoundEnabled ? <Volume2 size={18} className="text-primary"/> : <VolumeX size={18} className="text-muted-foreground"/>}
                          <span className="text-sm font-medium">Réponses vocales</span>
                        </div>
                        <input type="checkbox" className="toggle-checkbox h-5 w-5 accent-primary cursor-pointer" checked={isSoundEnabled} onChange={(e) => setIsSoundEnabled(e.target.checked)}/>
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
              
              const hasText = message.parts.some(
                (part: any) => part.type === "text" && part.text?.trim().length > 0
              );
              
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
                  <AvatarFallback className={message.role === "assistant" ? "bg-gradient-to-br from-[#fe6c75] to-pink-500 text-white shadow-lg" : ""}>
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
                  {/* Affichage du contenu du message */}
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
                          const uniqueKey = `${message.id}-${idx}`;

                          // --- CAS 1: TEXTE SIMPLE OU PROPOSITION ---
                          if (part.type === "text") {
                            const textContent = part.text;
                            
                            // Vérification : est-ce une proposition formatée (avec ✅, 🆔, etc.) ?
                            if (isProposalFormat(textContent)) {
                                const data = parseConfirmationText(textContent);
                                const roomName = data?.name; // Pour le message de confirmation

                                return (
                                    <ReservationCard 
                                      key={uniqueKey}
                                      text={textContent}
                                      isAnswered={answeredConfirmations.has(uniqueKey)}
                                      onConfirm={() => handleConfirm(uniqueKey, roomName)}
                                      onReject={() => handleReject(uniqueKey, roomName)}
                                    />
                                );
                            }

                            // Sinon, texte Markdown classique
                            return <ReactMarkdown key={idx}>{textContent}</ReactMarkdown>;
                          }
                          
                          // --- CAS 2: RETOUR D'OUTIL (TOOL RESULT) ---
                          if (part.type?.startsWith("tool-") && part.output?.text) {
                            const textContent = part.output.text;
                            
                            // Certains outils peuvent renvoyer un flag 'requiresConfirmation'
                            // OU on vérifie le format du texte retourné
                            const hasConfirmation = part.output?.requiresConfirmation === true;
                            
                            if (hasConfirmation || isProposalFormat(textContent)) {
                              const confirmationData = part.output?.confirmationData;
                              // On essaie de récupérer le nom via les data de l'outil, sinon via le parsing du texte
                              const roomName = confirmationData?.roomName || parseConfirmationText(textContent)?.name;

                              return (
                                <ReservationCard 
                                  key={uniqueKey}
                                  text={textContent}
                                  isAnswered={answeredConfirmations.has(uniqueKey)}
                                  onConfirm={() => handleConfirm(uniqueKey, roomName)}
                                  onReject={() => handleReject(uniqueKey, roomName)}
                                />
                              );
                            }

                            // Retour d'outil standard -> Texte simple (souvent technique ou de debug)
                            return (
                                <div key={idx} className="mt-2">
                                    <ReactMarkdown>{textContent}</ReactMarkdown>
                                </div>
                            );
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