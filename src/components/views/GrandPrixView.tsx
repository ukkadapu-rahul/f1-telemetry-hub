// src/components/views/GrandPrixView.tsx
'use client';

import { Flag } from 'lucide-react';
import { SessionResult } from '../../lib/api';

export default function GrandPrixView({ results }: { results: SessionResult[] }) {
  const safeResults = results || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-2xl">
        
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4 mb-6">
          <Flag className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100">
            Race Classification
          </h2>
        </div>

        <div className="space-y-3">
          {safeResults.map((driver) => {
            const gridPos = driver.grid ?? 0;
            const finishPos = driver.position ?? 0;
            const positionsGained = gridPos ? gridPos - finishPos : 0;

            return (
              <div 
                key={driver.driver_number} 
                className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 transition-colors backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-xl font-black text-slate-500 w-6 text-center">
                    {driver.position || '-'}
                  </span>
                  <div 
                    className="w-1.5 h-8 rounded-full" 
                    style={{ backgroundColor: `#${driver.team_colour}` }} 
                  />
                  <div>
                    <p className="font-bold text-slate-200">{driver.broadcast_name}</p>
                    <p className="text-xs text-slate-400">{driver.team_name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-right">
                  {gridPos > 0 && (
                    <div className="text-xs font-mono">
                      <span className="text-slate-500">Grid: {gridPos}</span>
                      <span className={`ml-2 font-bold ${
                        positionsGained > 0 ? 'text-green-400' : positionsGained < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {positionsGained > 0 ? `+${positionsGained}` : positionsGained === 0 ? '=' : positionsGained}
                      </span>
                    </div>
                  )}
                  {driver.points !== undefined && (
                    <span className="text-lg font-black text-red-400">
                      {driver.points} <span className="text-xs text-slate-500 font-normal">pts</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}