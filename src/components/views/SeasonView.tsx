// src/components/views/SeasonView.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flag } from 'lucide-react';

interface DriverStanding {
  driver_number: number;
  position: number;
  points: number;
  broadcast_name: string;
  team_name: string;
  team_colour: string;
}

interface ConstructorStanding {
  team_name: string;
  position: number;
  points: number;
  team_colour: string;
}

interface SeasonViewProps {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export default function SeasonView({ drivers, constructors }: SeasonViewProps) {
  const [isDriversExpanded, setIsDriversExpanded] = useState(false);
  
  const safeDrivers = drivers || [];
  const safeConstructors = constructors || [];
  
  // Show top 10 by default, or all if expanded
  const visibleDrivers = isDriversExpanded ? safeDrivers : safeDrivers.slice(0, 10);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN: DRIVERS CHAMPIONSHIP */}
        <motion.div layout className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-3">
              <Trophy className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100">
                Driver Standings
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {isDriversExpanded ? 'All Drivers' : 'Top 10'}
            </span>
          </div>

          <motion.div layout className="space-y-3">
            {visibleDrivers.map((driver) => (
              <motion.div 
                layout
                key={driver.driver_number} 
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 transition-colors backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-xl font-black text-slate-500 w-6 text-center">
                    {driver.position}
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
                <div className="text-right">
                  <span className="text-lg font-black text-red-400">
                    {driver.points} <span className="text-xs text-slate-500 font-normal">pts</span>
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
          {safeDrivers.length > 10 && (
            <button 
              onClick={() => setIsDriversExpanded(!isDriversExpanded)}
              className="w-full mt-6 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-all"
            >
              {isDriversExpanded ? '▲ Collapse to Top 10' : '▼ View All Drivers'}
            </button>
          )}
        </motion.div>

        {/* RIGHT COLUMN: CONSTRUCTORS CHAMPIONSHIP */}
        <motion.div layout className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-3">
              <Flag className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold uppercase tracking-wider text-slate-100">
                Constructor Standings
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {safeConstructors.map((team, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/60 transition-colors backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
              >
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-xl font-black text-slate-500 w-6 text-center">
                    {team.position}
                  </span>
                  <div 
                    className="w-1.5 h-8 rounded-full" 
                    style={{ backgroundColor: `#${team.team_colour}` }} 
                  />
                  <div>
                    <p className="font-bold text-slate-200">{team.team_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-red-400">
                    {team.points} <span className="text-xs text-slate-500 font-normal">pts</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}