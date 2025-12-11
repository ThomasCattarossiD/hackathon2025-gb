"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, User } from "lucide-react"; // Assure-toi d'avoir lucide-react
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Card } from "../ui/card";
import ReservationsSidebar, { Reservation } from "./ReservationsSidebar";

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
    // h-[100dvh] est crucial sur mobile pour gérer la barre d'adresse du navigateur
    <div className="flex flex-col h-[100dvh] bg-background text-foreground md:w-[30%] mx-auto">
      
      {/* HEADER */}
      <div className="relative flex items-center justify-center p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        
        {/* GAUCHE : Menu Réservations */}
        <div className="absolute left-4 inset-y-0 flex items-center">
        <ReservationsSidebar reservations={reservations} />
        </div>

        {/* Titre centré */}
        <h1 className="text-lg font-semibold tracking-tight">RoomBarber</h1>

        {/* Bouton Profil (Positionné en absolu à droite) */}
        <div className="absolute right-4 inset-y-0 flex items-center">
        <Popover>
            <PopoverTrigger asChild>
            {/* p-0 pour enlever padding interne qui décale l'avatar */}
            <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 bg-muted p-0">
                <Avatar className="h-8 w-8">
                <AvatarImage
                    src={userProfile.avatarUrl}
                    alt={userProfile.name}
                    className="object-cover" /* utile si image non carrée */
                />
                <AvatarFallback><User size={16} /></AvatarFallback>
                </Avatar>
            </Button>
            </PopoverTrigger>

            <PopoverContent className="w-80 mr-4" align="end">
          <div className="grid gap-4">
            {/* En-tête du Popover */}
            <div className="space-y-2">
              <h4 className="font-medium leading-none text-muted-foreground">Mon Compte</h4>
            </div>
            
            <div className="grid gap-2">
              {/* Carte infos utilisateur */}
              <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarImage src={userProfile.avatarUrl} />
                  <AvatarFallback>TA</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    {userProfile.name}
                    {/* <BadgeCheck size={14} className="text-blue-500" /> */}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {userProfile.role}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {/* <Mail size={10} /> */}
                    {userProfile.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
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
                  <AvatarFallback className={message.role === "bot" ? "bg-primary text-primary-foreground" : ""}>
                    {message.role === "bot" ? <Bot size={16} /> : <User size={16} />}
                  </AvatarFallback>
                </Avatar>

                {/* Bulle de message */}
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none" // Style User
                      : "bg-muted text-muted-foreground rounded-bl-none" // Style Bot
                  }`}
                >
                  {message.content}
                  {message.salleProp && !message.actionStatus && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-background/50"
                        onClick={() =>  handleReject(message.id)} // Assure-toi que cette fonction existe
                      >
                        Rejeter
                      </Button>

                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-0 shadow-none"
                        onClick={() => handleConfirm(message.id)} // Assure-toi que cette fonction existe
                      >
                        Valider
                      </Button>
                    </div>
                  )}

                  {message.actionStatus === "accepted" && (
                        <div className=" mt-2 flex items-center gap-2 text-green-700 font-medium text-xs bg-green-100/50 px-3 py-1.5 rounded-md border border-green-200">
                          <span>Salle acceptée</span>
                        </div>
                      )}

                      {/* Cas 3 : Salle Refusée */}
                      {message.actionStatus === "rejected" && (
                        <div className="mt-2 flex items-center gap-2 text-red-700 font-medium text-xs bg-red-100/50 px-3 py-1.5 rounded-md border border-red-200">
                          <span>Salle refusée</span>
                        </div>
                      )}
                </div>
              </div>
            </div>
          ))}
          {/* Div invisible pour le scroll automatique */}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* BARRE D'INPUT (FOOTER) */}
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
          />

          {/* Bouton Envoyer */}
          <Button 
            size="icon" 
            className="rounded-full shrink-0" 
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send size={18} />
            <span className="sr-only">Envoyer</span>
          </Button>
        </div>
      </div>
    </div>
  );
}