// src/components/views/PracticeView.tsx
'use client';

import { Timer } from 'lucide-react';
import { SessionResult } from '../../lib/api';

export default function PracticeView({ results }: { results: SessionResult[] }) {
  const safeResults = results || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-2xl">
        
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4 mb-6">
          <Timer className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100">
            Latest Free Practice Results
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeResults.map((driver) => (
            <div 
              key={driver.driver_number} 
              className="flex items-center space-x-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 transition-colors backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
            >
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
          ))}
        </div>

      </div>
    </div>
  );
}