// src/components/views/GrandPrixView.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronUp, ChevronDown, Minus, Flag, Timer, Wrench } from 'lucide-react';
import { SessionResult } from '@/lib/api';

interface RaceEvents {
  yellowFlags: number;
  redFlags: number;
  safetyCars: number;
  vsc: number;
}

interface FastestStat {
  duration: number;
  lap_number?: number;
  driver: string;
  colour: string;
}

interface GrandPrixViewProps {
  results: SessionResult[];
  events?: RaceEvents | null;
  fastestLap?: FastestStat | null;
  fastestPit?: FastestStat | null;
}

function formatLapTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

export default function GrandPrixView({ results, events, fastestLap, fastestPit }: GrandPrixViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const safeResults = results || [];
  const totalDrivers = safeResults.length || 20;
  
  const visibleResults = isExpanded ? safeResults : safeResults.slice(0, 10);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT: Race Results */}
        <motion.div layout className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md lg:col-span-2">
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
              const gridPos = driver.grid || driver.position; 
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
                      {driver.position === 999 ? 'DNF' : `P${driver.position}`}
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
                  
                  <div className="flex items-center space-x-6 pr-2">
                    <div className="flex items-center justify-center w-12">
                      {positionsChanged > 0 && driver.position !== 999 ? (
                        <span className="flex items-center text-emerald-500 text-xs font-bold font-mono">
                          <ChevronUp className="w-4 h-4 mr-1" /> {positionsChanged}
                        </span>
                      ) : positionsChanged < 0 && driver.position !== 999 ? (
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
            {isExpanded ? '▲ Collapse Results' : `▼ View Full Classification (${totalDrivers} Cars)`}
          </button>
        </motion.div>

        {/* RIGHT: Stacked Telemetry Cards */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Fastest Lap Card */}
          {fastestLap && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
                <Timer className="w-4 h-4 text-fuchsia-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Fastest Lap</h3>
              </div>
              <div className="flex justify-between items-end">
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: `#${fastestLap.colour}` }} />
                  <div>
                    <span className="text-2xl font-mono font-black text-slate-100">{formatLapTime(fastestLap.duration)}</span>
                    <p className="text-sm font-bold text-slate-400">{fastestLap.driver}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-mono mb-1">Lap {fastestLap.lap_number}</span>
              </div>
            </div>
          )}

          {/* Fastest Pit Stop Card */}
          {fastestPit && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
                <Wrench className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Fastest Pit Stop</h3>
              </div>
              <div className="flex justify-between items-end">
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: `#${fastestPit.colour}` }} />
                  <div>
                    <span className="text-2xl font-mono font-black text-slate-100">{fastestPit.duration.toFixed(2)}<span className="text-base text-slate-500 font-normal">s</span></span>
                    <p className="text-sm font-bold text-slate-400">{fastestPit.driver}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Race Events Card */}
          {events && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
                <Flag className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Race Events</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Safety Cars</span>
                  <span className="text-2xl font-mono font-black text-slate-200">{events.safetyCars}</span>
                </div>
                
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">VSC</span>
                  <span className="text-2xl font-mono font-black text-slate-200">{events.vsc}</span>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-col items-center justify-center">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400 animate-pulse"></div>
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Yellows</span>
                  </div>
                  <span className="text-2xl font-mono font-black text-slate-200">{events.yellowFlags}</span>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-col items-center justify-center">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-600 animate-pulse"></div>
                    <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Reds</span>
                  </div>
                  <span className="text-2xl font-mono font-black text-slate-200">{events.redFlags}</span>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}