// src/components/views/GrandPrixView.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronUp, ChevronDown, Minus } from 'lucide-react';

export interface SessionResult {
  driver_number: number;
  position: number;
  broadcast_name: string;
  team_name: string;
  team_colour?: string;
  grid?: number;
  points?: number;
}

export default function GrandPrixView({ results }: { results: SessionResult[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const safeResults = results || [];
  
  // Show Top 10 by default, just like your sketch
  const visibleResults = isExpanded ? safeResults : safeResults.slice(0, 10);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Race Results Card */}
      <motion.div layout className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md max-w-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Race Classification</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {isExpanded ? 'Full Classification' : 'Top 10 Preview'}
          </span>
        </div>

        <motion.div layout className="space-y-2">
          {visibleResults.map((driver) => {
            // Position Delta Calculation
            const gridPos = driver.grid || driver.position; // Fallback if grid data is missing
            const positionsChanged = gridPos - driver.position;
            
            return (
              <motion.div 
                layout
                key={driver.driver_number}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/60 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-lg w-10 text-center text-slate-500 font-black">
                    {driver.position ? `P${driver.position}` : 'DNF'}
                  </span>
                  <div 
                    className="w-1.5 h-8 rounded-full" 
                    style={{ backgroundColor: driver.team_colour ? `#${driver.team_colour}` : '#ffffff' }} 
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-200">{driver.broadcast_name}</p>
                    <p className="text-xs text-slate-500">{driver.team_name}</p>
                  </div>
                </div>
                
                {/* Points & Positions Gained/Lost */}
                <div className="flex items-center space-x-6 pr-2">
                  <div className="flex items-center justify-center w-12">
                    {positionsChanged > 0 ? (
                      <span className="flex items-center text-emerald-500 text-xs font-bold font-mono">
                        <ChevronUp className="w-4 h-4 mr-1" /> {positionsChanged}
                      </span>
                    ) : positionsChanged < 0 ? (
                      <span className="flex items-center text-red-500 text-xs font-bold font-mono">
                        <ChevronDown className="w-4 h-4 mr-1" /> {Math.abs(positionsChanged)}
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-600 text-xs font-bold font-mono">
                        <Minus className="w-4 h-4 mr-1" /> 0
                      </span>
                    )}
                  </div>
                  
                  <span className="font-mono text-sm font-medium text-slate-300 w-10 text-right">
                    +{driver.points || 0}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-6 py-2.5 text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg transition-all"
        >
          {isExpanded ? '▲ Collapse Results' : '▼ View Full Classification'}
        </button>
      </motion.div>

    </div>
  );
}