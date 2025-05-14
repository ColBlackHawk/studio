
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Player } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from "@/components/ui/button";
import { Check, X } from 'lucide-react';

interface PlayerSearchInputProps {
  allPlayers: Player[];
  selectedPlayers: Player[];
  onSelectPlayer: (player: Player) => void;
  onDeselectPlayer: (playerId: string) => void;
  maxSelection?: number;
  placeholder?: string;
  label?: string;
}

export default function PlayerSearchInput({
  allPlayers,
  selectedPlayers,
  onSelectPlayer,
  onDeselectPlayer,
  maxSelection = 1,
  placeholder = "Search for player by nickname...",
  label = "Select Player(s)"
}: PlayerSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      const results = allPlayers.filter(player =>
        player.nickname.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedPlayers.find(p => p.id === player.id) // Exclude already selected players
      );
      setFilteredPlayers(results);
      setShowDropdown(true);
    } else {
      setFilteredPlayers([]);
      setShowDropdown(false);
    }
  }, [searchTerm, allPlayers, selectedPlayers]);

  const handleSelect = (player: Player) => {
    if (selectedPlayers.length < maxSelection) {
      onSelectPlayer(player);
      setSearchTerm('');
      setShowDropdown(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setSearchTerm(e.target.value);
  }

  const handleInputFocus = () => {
    if(searchTerm) setShowDropdown(true);
  }
  
  // Use useCallback for the blur handler to prevent re-creation on every render
  const handleInputBlur = useCallback(() => {
    // Delay hiding the dropdown to allow click events on dropdown items
    setTimeout(() => setShowDropdown(false), 150);
  }, []);


  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label} ({selectedPlayers.length}/{maxSelection})</label>
      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md bg-muted/50">
          {selectedPlayers.map(player => (
            <div key={player.id} className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
              {player.nickname}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 text-primary-foreground hover:bg-primary/80 rounded-full"
                onClick={() => onDeselectPlayer(player.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {selectedPlayers.length < maxSelection && (
        <div className="relative">
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="w-full"
          />
          {showDropdown && filteredPlayers.length > 0 && (
            <ScrollArea className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60">
              <div className="p-1">
                {filteredPlayers.map(player => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                    // Use onMouseDown to trigger before onBlur hides the dropdown
                    onMouseDown={() => handleSelect(player)}
                  >
                    <span>{player.nickname} ({player.ranking ?? 'N/A'})</span>
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
           {showDropdown && searchTerm && filteredPlayers.length === 0 && (
             <div className="absolute z-10 w-full p-2 mt-1 text-sm text-center bg-card border rounded-md shadow-lg text-muted-foreground">
                No players found matching "{searchTerm}".
             </div>
           )}
        </div>
      )}
    </div>
  );
}
