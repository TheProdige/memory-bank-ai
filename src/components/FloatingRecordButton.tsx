import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import AudioRecorder from "./AudioRecorder";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { toast } from "sonner";

interface FloatingRecordButtonProps {
  onMemoryCreated?: (memory: any) => void;
}

export const FloatingRecordButton = ({ onMemoryCreated }: FloatingRecordButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { canCreateMemory, dailyUsed, dailyLimit } = useUsageLimits();

  const handleOpenRecorder = () => {
    if (!canCreateMemory) {
      toast.error(`Limite quotidienne atteinte (${dailyUsed}/${dailyLimit}). Revenez demain ou passez Pro !`);
      return;
    }
    setIsOpen(true);
  };

  const handleMemoryCreated = (memory: any) => {
    setIsOpen(false);
    onMemoryCreated?.(memory);
  };

  if (isOpen) {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
            Fermer
          </Button>
          <AudioRecorder onMemoryCreated={handleMemoryCreated} />
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleOpenRecorder}
      className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-gold-glow z-40 transition-all duration-300 hover:scale-110 ${
        canCreateMemory 
          ? 'bg-accent hover:bg-accent/90 text-accent-foreground' 
          : 'bg-muted text-muted-foreground cursor-not-allowed'
      }`}
      disabled={!canCreateMemory}
    >
      <Mic className="w-6 h-6" />
    </Button>
  );
};