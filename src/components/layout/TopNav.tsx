// src/components/layout/TopNav.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SessionInfo {
  circuit_short_name?: string;
  session_name?: string;
}

interface TopNavProps {
  sessionData: SessionInfo | null;
  currentTab: string;
  hasSprint?: boolean;
}

export default function TopNav({ sessionData, currentTab, hasSprint = false }: TopNavProps) {
  const [localTime, setLocalTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLocalTime(
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          timeZoneName: 'short'
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const getLinkClasses = (tabName: string) => `
    px-3 py-1.5 text-xs md:text-sm font-semibold rounded transition-colors whitespace-nowrap ${
      currentTab === tabName
        ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(225,6,0,0.4)]'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }
  `;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 flex flex-col md:flex-row items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl backdrop-blur-md mb-6 gap-4">
      
      <div className="flex items-center space-x-6 w-full md:w-auto justify-center md:justify-start">
        <div className="text-slate-300 border-r border-slate-700 pr-6 text-center md:text-left">
          <p className="text-xs uppercase tracking-widest text-slate-500">Circuit</p>
          <h2 className="font-bold text-lg">{sessionData?.circuit_short_name || 'TBA'}</h2>
        </div>
        <div className="text-center md:text-left">
          <p className="text-xs uppercase tracking-widest text-slate-500">Local Time</p>
          <h2 className="font-mono text-lg text-red-500">{localTime || '--:--'}</h2>
        </div>
      </div>

      <div className="flex flex-col items-center md:items-end w-full md:w-auto">
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-widest mb-3">
          {sessionData?.session_name || 'Debrief'}
        </h1>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href="/?tab=practice" className={getLinkClasses('practice')}>
            Practice
          </Link>
          
          {hasSprint && (
            <>
              <Link href="/?tab=sprint_quali" className={getLinkClasses('sprint_quali')}>
                Sprint Quali
              </Link>
              <Link href="/?tab=sprint" className={getLinkClasses('sprint')}>
                Sprint
              </Link>
            </>
          )}

          <Link href="/?tab=quali" className={getLinkClasses('quali')}>
            Quali
          </Link>
          <Link href="/?tab=race" className={getLinkClasses('race')}>
            Race
          </Link>
          <Link href="/?tab=season" className={getLinkClasses('season')}>
            Season
          </Link>
        </div>
      </div>

    </div>
  );
}