"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, Volume2, VolumeX, User, StopCircle, ArrowDown } from "lucide-react"; // Assure-toi d'avoir lucide-react
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Card } from "../ui/card";
import ReservationsSidebar, { Reservation } from "./ReservationsSidebar";
import { Separator } from "../ui/separator";


// Extension de l'interface Window pour la reconnaissance vocale
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// Type simple pour un message
type Message = {
    id: string;
    role: "user" | "bot";
    content: string;
    salleProp: string | null;
    timestamp: Date;
    actionStatus?: "accepted" | "rejected"; 
};

type RoomDetails = {
    id: string;
    name: string;
    capacity: number;
    features: string[];
    imageUrl?: string;
};

export default function ChatInterface() {
    const [input, setInput] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);

    const recognitionRef = useRef<any>(null); 

  // Exemple de données initiales
    const [messages, setMessages] = useState<Message[]>([
        {
        id: "1",
        role: "bot",
        content: "Bonjour ! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui ?",
        salleProp: null,
        timestamp: new Date(),
        },
    ]);

    const userProfile = {
        name: "John Doe",
        email: "john.doe@gb.com",
        avatarUrl: "https://github.com/shadcn.png",
        role: "Développeur junior"
    };

    const reservations: Reservation[] = [
        // Sera remplacé par un appel à la BD pour connaitre les réservations de l'user à partir de la date courante
        {
            id: "1",
            roomName: "Salle Turing",
            date: "12 Dec. 2025",
            startTime: "10:00",
            endTime: "11:30",
            status: "confirmé"
        },
        {
            id: "2",
            roomName: "Salle Lovelace",
            date: "14 Dec. 2025",
            startTime: "14:00",
            endTime: "15:00",
            status: "en attente"
        }
    ];

    const ROOM_DATABASE: Record<string, RoomDetails> = {
        "room-123": {
            id: "room-123",
            name: "Salle Alan Turing",
            capacity: 6,
            features: ["wifi", "projector", "whiteboard"],
        },
        "room-456": {
            id: "room-456",
            name: "Salle Ada Lovelace",
            capacity: 12,
            features: ["wifi", "screen", "ac"],
        }
    };

    // Fonction pour scroller automatiquement vers le bas à chaque nouveau message
    useEffect(() => {
        if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
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

        // 1. Ajouter le message de l'utilisateur
        const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        salleProp: null,
        timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");

        // 2. Simuler une réponse du bot (à remplacer par ton appel API)
        setTimeout(() => {
          const botMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: "bot",
              content: "Ceci est une réponse simulée. J'attends votre logique backend !",
              salleProp: "room-123",
              timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMsg]);

          speakText(botMsg.content); 
        }, 100);
    };

    const handleVoiceRecord = () => {
        // Si on enregistre déjà, on arrête tout
        if (isRecording) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
            return;
        }

        // Vérification de la compatibilité du navigateur
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
            return;
        }
        
        setIsSoundEnabled(true); 

        // Création de l'instance
        const recognition = new SpeechRecognition();
        recognition.lang = "fr-FR"; // Langue française
        recognition.continuous = true; // Arrête après une phrase (mettre true pour dictée continue)
        recognition.interimResults = false; // Permet de voir le texte s'écrire pendant qu'on parle

        // Événement quand le résultat change
        recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            // Mise à jour de l'input avec le texte dicté
            setInput(transcript);
        };

        // Gestion des erreurs
        recognition.onerror = (event: any) => {
            console.error("Erreur reconnaissance vocale :", event.error);
            setIsRecording(false);
        };

        // Quand l'enregistrement s'arrête (automatiquement ou manuellement)
        recognition.onend = () => {
            setIsRecording(false);
        };

        // Démarrage
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
    // 1. CONTAINER PRINCIPAL
    // h-full : Prend 100% de la hauteur définie dans page.tsx
    // flex-col : Organise les éléments verticalement
    <div className="flex flex-col h-full w-full md:w-[30%] bg-background text-foreground shadow-2xl relative">
      
      {/* 2. HEADER (Fixe) */}
      {/* shrink-0 empêche le header de s'écraser si manque de place */}
      <div className="shrink-0 flex items-center justify-center p-4 border-b bg-card/50 backdrop-blur-sm z-10 relative">
        
        {/* Menu Gauche */}
        <div className="absolute left-4 inset-y-0 flex items-center">
            <ReservationsSidebar reservations={reservations} />
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-semibold tracking-tight">RoomBarber</h1>

        {/* Profil Droite */}
        <div className="absolute right-4 inset-y-0 flex items-center">
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-muted p-0">
                    <Avatar className="h-12 w-12">
                    <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} className="object-cover" />
                    <AvatarFallback><User size={24} /></AvatarFallback>
                    </Avatar>
                </Button>
                </PopoverTrigger>
                
                <PopoverContent className="w-80 mr-4" align="end">
                  {/* ... Ton contenu Popover (copie-colle ton code existant ici) ... */}
                  <div className="grid gap-4">
                        <div className="space-y-2"><h4 className="font-medium leading-none text-muted-foreground">Mon Compte</h4></div>
                        <div className="grid gap-2">
                            <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                <AvatarImage src={userProfile.avatarUrl} />
                                <AvatarFallback>TA</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                <span className="font-semibold text-sm flex items-center gap-1">{userProfile.name}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">{userProfile.role}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">{userProfile.email}</span>
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
            </Popover>
        </div>
      </div>

      {/* 3. ZONE DE MESSAGES (Scrollable) */}
      <div 
        className="flex-1 w-full p-4 overflow-y-auto scroll-smooth" 
        onScroll={handleScroll}
      >
        <div className="space-y-4 pb-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[85%] md:max-w-[70%] items-end gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={message.role === "bot" ? "bg-gradient-to-br from-[#fe6c75] to-pink-500 text-white shadow-lg" : ""}>

                      {message.role === "bot" ? <Bot size={16} /> : <User size={16} />}
                  </AvatarFallback>
                </Avatar>

                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${message.role === "user" ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted text-muted-foreground rounded-bl-none"}`}>
                  {message.content}
                  
                  {/* Boutons Actions */}
                  {message.salleProp && !message.actionStatus && (
                    <>
                      <Separator className="my-2 bg-muted-foreground/30" />
                      <div className="mt-2 flex items-center gap-3 justify-end">
                        <Button variant="outline" className="h-10 px-5 text-sm font-medium border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-background/50" onClick={() => handleReject(message.id)}>Rejeter</Button>
                        <Button className="h-10 px-5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white border-0 shadow-md" onClick={() => handleConfirm(message.id)}>Valider</Button>
                      </div>
                    </>
                  )}

                  {message.actionStatus === "accepted" && <div className=" mt-2 flex items-center gap-2 text-green-700 font-medium text-xs bg-green-100/50 px-3 py-1.5 rounded-md border border-green-200"><span>Salle acceptée</span></div>}
                  {message.actionStatus === "rejected" && <div className="mt-2 flex items-center gap-2 text-red-700 font-medium text-xs bg-red-100/50 px-3 py-1.5 rounded-md border border-red-200"><span>Salle refusée</span></div>}
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