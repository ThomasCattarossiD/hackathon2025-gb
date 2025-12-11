"use client";

import React from "react";
import { 
  Menu, Calendar, Clock, MapPin, CalendarX, Trash2 
} from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

// On exporte le type pour pouvoir l'utiliser dans le parent
export type Reservation = {
  id: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "confirmé" | "en attente";
};

interface ReservationsSidebarProps {
  reservations: Reservation[];
}

const handleDelete = (id: string) => {
    alert(`Simulation : La réservation ${id} a bien été supprimée.`);
};

export default function ReservationsSidebar({ reservations }: ReservationsSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {/* Le bouton Menu est géré ici directement */}
        <Button variant="ghost" size="icon" className="-ml-2">
          <Menu size={24} />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Mes Réservations</SheetTitle>
          <SheetDescription>
            Gérez vos créneaux de salles à venir.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 flex flex-col gap-4">
          {reservations.length === 0 ? (
            // CAS : AUCUNE RÉSERVATION
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 opacity-60">
              <CalendarX size={48} />
              <p className="text-sm font-medium">Aucune réservation en cours.</p>
              <p className="text-xs">Demandez au chatbot d'en créer une !</p>
            </div>
          ) : (
            // CAS : LISTE DES RÉSERVATIONS
            <ScrollArea className="h-[calc(100vh-150px)] pl-2 pr-2">
              <div className="space-y-4">
                {reservations.map((res) => (
                  <div key={res.id} className="border rounded-lg p-4 bg-card shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <MapPin size={14} className="text-primary" />
                        {res.roomName}
                      </h3>

                      {/* Bouton Supprimer */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => handleDelete(res.id)}>
                        <Trash2 size={16} />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </div>
                    <Separator/>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>{res.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>{res.startTime} - {res.endTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}