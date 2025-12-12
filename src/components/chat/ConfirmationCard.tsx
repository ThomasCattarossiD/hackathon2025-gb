import React from "react";
import ReactMarkdown from "react-markdown";
import { 
  Wifi, Monitor, Video, Wind, Check, Calendar, 
  Clock, MapPin, Users 
} from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

interface ConfirmationCardProps {
  text: string;
  onConfirm: () => void;
  onReject: () => void;
  isAnswered: boolean;
}

// --- UTILS ---
const getEquipmentIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("wifi")) return <Wifi size={10} />;
  if (n.includes("vidéo") || n.includes("projecteur") || n.includes("écran") || n.includes("tv")) return <Monitor size={10} />;
  if (n.includes("webcam") || n.includes("visio")) return <Video size={10} />;
  if (n.includes("clim") || n.includes("air")) return <Wind size={10} />;
  return <Check size={10} />;
};

export const parseConfirmationText = (text: string) => {
  try {
    const cleanText = text.replace(/\*\*/g, '');

    const name = cleanText.match(/✅\s*(.*?)\s*🆔/)?.[1]?.trim() || "Salle";
    const location = cleanText.match(/📍\s*(.*?)\s*👥/)?.[1]?.trim();
    const capacity = cleanText.match(/👥\s*Capacite:\s*(.*?)\s*🛠️/)?.[1]?.trim();
    const equipmentsStr = cleanText.match(/🛠️\s*Equipements:\s*(.*?)\s*📅/)?.[1]?.trim();
    const date = cleanText.match(/📅\s*(.*?)\s*⏰/)?.[1]?.trim();
    const timeMatch = cleanText.match(/⏰\s*(.*?)(\n|$)/); 
    const time = timeMatch ? timeMatch[1].trim() : null;
    const equipments = equipmentsStr ? equipmentsStr.split(',').map(e => e.trim()) : [];

    if (!date || !time) return null;

    return { name, location, capacity, equipments, date, time };
  } catch (e) {
    return null;
  }
};

export const isProposalFormat = (text: string): boolean => {
    return text.includes("✅") && text.includes("🆔") && text.includes("⏰");
};

// --- COMPONENT ---

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({ 
  text, 
  onConfirm, 
  onReject, 
  isAnswered 
}) => {
  const data = parseConfirmationText(text);

  if (!data) return <ReactMarkdown>{text}</ReactMarkdown>;

  const shortDate = data.date.split(' ').slice(1, 2).join(' ') || data.date;
  const shortTime = data.time.split('(')[0].trim();

  return (
    <Card className="w-full max-w-[340px] !py-0 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in zoom-in-95 duration-200">
      
      {/* 1. Zone Contenu */}
      <div className="p-4 pb-0">
        <div className="flex justify-between items-start mb-2">
            <div>
                <h3 className="font-bold text-lg leading-tight text-foreground">
                    {data.name}
                </h3>
                {data.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {data.location}
                    </p>
                )}
            </div>
            {data.capacity && (
                <Badge variant="secondary" className="text-[10px] px-2 h-6 font-normal text-muted-foreground bg-muted/50">
                   <Users size={12} className="mr-1" /> {data.capacity.replace('personnes', '')}
                </Badge>
            )}
        </div>

        {/* Bandeau Date & Heure */}
        <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3 my-3 border border-primary/10">
            <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <span className="text-sm font-semibold">{shortDate}</span>
            </div>
            <div className="h-4 w-[1px] bg-border/50"></div>
            <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <span className="text-sm font-semibold">{shortTime}</span>
            </div>
        </div>

        {/* Scroll Équipements */}
        {data.equipments.length > 0 && (
           <div>
              <ScrollArea className="w-full whitespace-nowrap pb-2">
                <div className="flex w-max space-x-2">
                  {data.equipments.map((eq, i) => (
                    <div key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/30 text-[11px] font-medium text-muted-foreground">
                        {getEquipmentIcon(eq)}
                        {eq}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5" />
              </ScrollArea>
           </div>
        )}
      </div>

      {/* 2. Zone Actions Centrées et Larges */}
      {!isAnswered ? (
        <div className="pb-4 px-4 pt-1">
            <Separator className="mb-3 bg-border/40" />
            <div className="flex items-center gap-3 w-full">
                {/* Bouton Rejeter : Large (flex-1), fond rouge très léger */}
                <Button 
                    variant="outline" 
                    className="flex-1 h-11 text-sm font-medium border-red-200 text-red-600 bg-red-50/50 hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-all rounded-xl" 
                    onClick={onReject}
                >
                    Rejeter
                </Button>

                {/* Bouton Valider : Large (flex-1), vert solide */}
                <Button 
                    className="flex-1 h-11 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white border-0 shadow-md transition-all hover:scale-[1.02] rounded-xl" 
                    onClick={onConfirm}
                >
                    Valider
                </Button>
            </div>
        </div>
      ) : (
        <div className="border-t py-2 text-center bg-muted/20">
             <span className="text-[10px] text-muted-foreground italic flex items-center justify-center gap-1">
                <Check size={12} className="text-green-600" /> Réponse enregistrée
             </span>
        </div>
      )}
    </Card>
  );
};

export default ConfirmationCard;