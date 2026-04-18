import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Cloud, Pencil } from "lucide-react";
import { usePresence } from "@/hooks/usePresence";
import { CollaboratorAvatars } from "./CollaboratorAvatars";

interface CanvasHeaderProps {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  boardId?: string;
  isSaving: boolean;
}

export function CanvasHeader({
  boardName,
  onBoardNameChange,
  boardId,
  isSaving,
}: CanvasHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(boardName);
  const { isConnected } = usePresence(boardId || null);

  const handleSave = () => {
    onBoardNameChange(tempName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTempName(boardName);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Board Name - Inline Edit */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="h-8 w-64 bg-white/10 border-white/20 text-white"
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 bg-sm-magenta hover:bg-sm-magenta/90"
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => {
            setTempName(boardName);
            setIsEditing(true);
          }}
          className="flex items-center gap-2 text-white font-semibold hover:text-white/80 transition-colors group"
        >
          {boardName}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
      )}

      {/* Save Status */}
      <div className="flex items-center gap-1.5 text-white/50 text-sm">
        {isSaving ? (
          <>
            <Cloud className="w-4 h-4 animate-pulse" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-sm-mint" />
            <span>Saved</span>
          </>
        )}
      </div>

      {/* Connection indicator */}
      {boardId && (
        isConnected ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400 font-medium">Connecting...</span>
          </div>
        )
      )}

      {/* Collaborators & Share */}
      {boardId && (
        <CollaboratorAvatars
          boardId={boardId}
          maxVisible={3}
        />
      )}
    </div>
  );
}
