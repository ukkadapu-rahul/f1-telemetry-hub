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
}

interface SpeedData {
  speed: number | string;
  driver: string;
}

// Make topSpeed optional with the '?'
export default function QualifyingView({ results, topSpeed }: { results: QualiResult[], topSpeed?: SpeedData }) {
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const safeResults = results || [];
  
  const visibleGrid = isGridExpanded ? safeResults : safeResults.slice(0, 5);
  
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Dynamically switch between 3 columns (Normal Quali) and 2 columns (Sprint Quali) */}
      <div className={`grid grid-cols-1 ${topSpeed ? 'lg:grid-cols-3' : 'lg:grid-cols-2 max-w-5xl mx-auto'} gap-6 items-start`}>
        
        {/* LEFT COLUMN: Expandable Starting Grid */}
        <motion.div layout className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Starting Grid</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {isGridExpanded ? '20 / 20 Drivers' : 'Top 5 Preview'}
            </span>
          </div>

          <motion.div layout className="space-y-2">
            {visibleGrid.map((driver) => (
              <motion.div 
                layout
                key={driver.driver_number}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/60 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs w-5 text-slate-500 font-bold">
                    P{driver.position}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{driver.broadcast_name}</p>
                    <p className="text-xs text-slate-500">{driver.team_name}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <button 
            onClick={() => setIsGridExpanded(!isGridExpanded)}
            className="w-full mt-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg transition-all"
          >
            {isGridExpanded ? '▲ Collapse to Top 5' : '▼ View Full Grid (20 Cars)'}
          </button>
        </motion.div>

        {/* MIDDLE COLUMN: Classification */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Session Classification</h3>
          </div>
          <div className="space-y-2">
            {safeResults.slice(0, 8).map((row) => (
              <div key={row.driver_number} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-slate-500">{row.position}.</span>
                  <span className="font-medium text-slate-300">{row.broadcast_name}</span>
                </div>
                <span className="font-mono text-slate-500">{row.team_name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Misc Stats (Only renders if topSpeed is passed) */}
        {topSpeed && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md">
              <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-3">
                <Gauge className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Top Speed Trap</h3>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <div>
                  <p className="text-2xl font-bold font-mono text-slate-100">{topSpeed.speed} <span className="text-xs text-slate-500">km/h</span></p>
                  <p className="text-xs text-slate-400 mt-1">{topSpeed.driver}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}