import { useChat } from "ai/react"
import { useEffect, useRef } from "react"
import { Send, Mic, MapPin, Sparkles, Loader2 } from "lucide-react" // Icônes
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

export default function ChatPage() {
  // Hook Vercel AI SDK : gère tout l'état du chat
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()
  
  // Référence pour scroller automatiquement vers le bas
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 max-w-md mx-auto shadow-2xl overflow-hidden sm:rounded-xl sm:my-8 sm:h-[800px] sm:border">
      
      {/* -------------------------------------------------- */}
      {/* 1. HEADER (Barre du haut style App Mobile)         */}
      {/* -------------------------------------------------- */}
      <header className="flex items-center p-4 border-b bg-white z-10 shadow-sm">
        <Avatar className="h-10 w-10 border-2 border-blue-100">
          <AvatarImage src="/bot-avatar.png" alt="Agent" />
          <AvatarFallback className="bg-blue-600 text-white">GB</AvatarFallback>
        </Avatar>
        <div className="ml-3 flex-1">
          <h1 className="font-semibold text-sm text-slate-900">GoodBarber Agent</h1>
          <div className="flex items-center text-xs text-green-600 font-medium">
            <span className="relative flex h-2 w-2 mr-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            En ligne - Bâtiment 2026
          </div>
        </div>
      </header>

      {/* -------------------------------------------------- */}
      {/* 2. ZONE DE DISCUSSION (Scrollable)                 */}
      {/* -------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        
        {/* État vide (Au début) */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-slate-500 opacity-80 mt-10">
            <div className="bg-blue-100 p-4 rounded-full">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-sm">
              Bonjour ! Je gère les salles de réunion.<br/>
              Posez-moi une question comme :
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <span className="bg-white border px-3 py-2 rounded-full shadow-sm">"Est-ce que l'Aquarium est libre ?"</span>
              <span className="bg-white border px-3 py-2 rounded-full shadow-sm">"Réserve une salle pour 4 à 14h"</span>
            </div>
          </div>
        )}

        {/* Liste des messages */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`
              relative max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm
              ${m.role === "user" 
                ? "bg-blue-600 text-white rounded-br-sm" 
                : "bg-white text-slate-800 border border-slate-100 rounded-bl-sm"}
            `}>
              
              {/* Le texte du message */}
              <div className="whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>

              {/* Affichage visuel si l'IA utilise un outil (Feedback UX) */}
              {m.toolInvocations?.map((tool) => (
                <div key={tool.toolCallId} className="mt-2 flex items-center gap-2 text-xs bg-slate-100 text-slate-600 p-2 rounded-lg border border-slate-200">
                  {tool.toolName === 'checkAvailability' && <MapPin className="h-3 w-3" />}
                  {tool.toolName === 'createBooking' && <Loader2 className="h-3 w-3 animate-spin" />}
                  
                  <span>
                    {tool.toolName === 'checkAvailability' && "Vérification des dispos..."}
                    {tool.toolName === 'createBooking' && "Tentative de réservation..."}
                    {tool.toolName === 'getMyBookings' && "Recherche de vos réunions..."}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Indicateur de chargement (quand l'IA écrit) */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
             </div>
          </div>
        )}

        {/* Ancre invisible pour le scroll */}
        <div ref={messagesEndRef} />
      </main>

      {/* -------------------------------------------------- */}
      {/* 3. INPUT AREA (Barre du bas)                       */}
      {/* -------------------------------------------------- */}
      <footer className="p-4 bg-white border-t">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          
          {/* Bouton Micro (Visuel pour le MVP) */}
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            className="rounded-full h-10 w-10 shrink-0"
            onClick={() => alert("Le vocal arrive dans la V2 !")}
          >
            <Mic className="h-5 w-5 text-slate-500" />
          </Button>

          {/* Champ Texte */}
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Écrivez votre demande..."
            className="rounded-full bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
          />

          {/* Bouton Envoyer */}
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </footer>
    </div>
  )
}