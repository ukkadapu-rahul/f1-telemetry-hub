// src/components/views/QualifyingView.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Trophy } from 'lucide-react';

interface QualiResult {
  driver_number: number;
  position: number;
  broadcast_name: string;
  team_name: string;
  team_colour?: string;
  lap_duration?: number;
}

interface SpeedData {
  speed: number | string;
  driver: string;
}

function formatTime(seconds?: number) {
  if (!seconds) return 'NO TIME';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

export default function QualifyingView({ results, topSpeed }: { results: QualiResult[], topSpeed?: SpeedData }) {
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const safeResults = results || [];
  const totalDrivers = safeResults.length || 22;
  
  // Top 10 preview by default
  const visibleGrid = isGridExpanded ? safeResults : safeResults.slice(0, 10);
  
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Expanded Starting Grid */}
        <motion.div layout className={`bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md ${topSpeed ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Official Starting Grid</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {isGridExpanded ? `${totalDrivers} / ${totalDrivers} Drivers` : 'Top 10 Preview'}
            </span>
          </div>

          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleGrid.map((driver) => (
              <motion.div 
                layout
                key={driver.driver_number}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/60 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-lg w-6 text-center text-slate-500 font-black">
                    P{driver.position}
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
                
                <div className="text-right pr-2">
                  <span className="font-mono text-sm font-medium text-slate-300 tracking-wider">
                    {formatTime(driver.lap_duration)}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <button 
            onClick={() => setIsGridExpanded(!isGridExpanded)}
            className="w-full mt-6 py-2.5 text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg transition-all"
          >
            {isGridExpanded ? '▲ Collapse Grid' : `▼ View Full Grid (${totalDrivers} Cars)`}
          </button>
        </motion.div>

        {/* Top Speed Card (Only for sessions where topSpeed is passed) */}
        {topSpeed && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-3">
                <Gauge className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Top Speed Trap</h3>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <div>
                  <p className="text-3xl font-black font-mono text-slate-100">{topSpeed.speed} <span className="text-sm text-slate-500 font-normal">km/h</span></p>
                  <p className="text-sm font-medium text-slate-400 mt-1">{topSpeed.driver}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}