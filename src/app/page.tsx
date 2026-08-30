// src/app/page.tsx
export const dynamic = 'force-dynamic';

import { 
  getLatestSession, 
  getQualifyingResults, 
  getRaceResults, 
  getTopSpeedTrap, 
  getSeasonStandings,
  getPracticeResults,
  getSprintResults,
  getSprintQualifyingResults,
  getMeetingFormat,
  getRaceEvents,
  getFastestLap, // <-- Fixed import
  getFastestPitStop, // <-- Fixed import
  SessionResult,
  SeasonStandingsData,
  PendingStatus
} from "../lib/api"; 
import TopNav from "../components/layout/TopNav";
import QualifyingView from "../components/views/QualifyingView";
import GrandPrixView from "../components/views/GrandPrixView";
import SeasonView from "../components/views/SeasonView";
import PracticeView from "../components/views/PracticeView"

function PendingState({ message }: { message: string }) {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-16 bg-slate-900/60 border border-slate-800 rounded-xl backdrop-blur-md shadow-2xl mt-6">
      <div className="w-10 h-10 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin mb-6"></div>
      <h3 className="text-xl font-bold uppercase tracking-wider text-slate-200 mb-2">{message}</h3>
      <p className="text-sm text-slate-500">Awaiting official session telemetry...</p>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const currentTab = params.tab || 'quali';
  
  // 1. Fetch ONLY what the TopNav needs globally
  const { hasSprint } = await getMeetingFormat();
  const latestSession = await getLatestSession();
  
  // 2. Initialize strict types for our lazy-loaded data
  let practiceResults: SessionResult[] | PendingStatus = { status: 'pending' };
  let sprintQualiResults: SessionResult[] | PendingStatus = { status: 'pending' };
  let sprintResults: SessionResult[] | PendingStatus = { status: 'pending' };
  let qualiResults: SessionResult[] | PendingStatus = { status: 'pending' };
  let raceResults: SessionResult[] | PendingStatus = { status: 'pending' };
  let seasonStandings: SeasonStandingsData | PendingStatus = { status: 'pending' };
  let topSpeedData = { speed: '--' as number | string, driver: 'N/A' };
  let raceEventsData = null;
  let fastestLapData = null; 
  let fastestPitData = null; 

  // 3. LAZY FETCHING: Only hit the API for the exact tab the user clicked!
  if (currentTab === 'practice') {
    practiceResults = await getPracticeResults();
  } else if (currentTab === 'sprint') {
    // Fetch BOTH for the single Sprint tab
    sprintQualiResults = hasSprint ? await getSprintQualifyingResults() : { status: 'pending' };
    sprintResults = hasSprint ? await getSprintResults() : { status: 'pending' };
  } else if (currentTab === 'quali') {
    qualiResults = await getQualifyingResults();
    topSpeedData = await getTopSpeedTrap();
  } else if (currentTab === 'race') {
    raceResults = await getRaceResults();
    raceEventsData = await getRaceEvents();
    fastestLapData = await getFastestLap(); 
    fastestPitData = await getFastestPitStop(); 
  } else if (currentTab === 'season') {
    seasonStandings = await getSeasonStandings();
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8 space-y-6">
      <TopNav 
        sessionData={latestSession} 
        currentTab={currentTab} 
        hasSprint={hasSprint} 
      />

      {currentTab === 'practice' && (
        !Array.isArray(practiceResults) 
          ? <PendingState message="Practice Results Not Yet Available" />
          : <PracticeView results={practiceResults} />
      )}

      {currentTab === 'sprint' && (
        <div className="space-y-12">
          {/* Top Half: Sprint Quali */}
          <div>
            <h2 className="text-2xl font-black text-slate-100 mb-6 px-4 uppercase tracking-wider">Sprint Qualifying</h2>
            {!Array.isArray(sprintQualiResults) 
              ? <PendingState message="Sprint Qualifying Results Not Yet Available" />
              : <QualifyingView results={sprintQualiResults} />
            }
          </div>

          <hr className="border-slate-800" />

          {/* Bottom Half: Sprint Race */}
          <div>
            <h2 className="text-2xl font-black text-slate-100 mb-6 px-4 uppercase tracking-wider">Sprint Race</h2>
            {!Array.isArray(sprintResults) 
              ? <PendingState message="Sprint Race Results Not Yet Available" />
              : <GrandPrixView results={sprintResults} />
            }
          </div>
        </div>
      )}
      
      {currentTab === 'quali' && (
        !Array.isArray(qualiResults) 
          ? <PendingState message="Qualifying Results Not Yet Available" />
          : <QualifyingView results={qualiResults} topSpeed={topSpeedData} />
      )}
      
      {currentTab === 'race' && (
        !Array.isArray(raceResults)
          ? <PendingState message="Race Results Not Yet Available" />
          : <GrandPrixView 
              results={raceResults} 
              events={raceEventsData} 
              fastestLap={fastestLapData} 
              fastestPit={fastestPitData} 
            /> // <-- Cleaned up duplicate props
      )}
      
      {currentTab === 'season' && (
        'status' in seasonStandings
          ? <PendingState message="Season Standings Not Yet Available" />
          : <SeasonView 
              drivers={seasonStandings.drivers} 
              constructors={seasonStandings.constructors} 
            />
      )}
    </main>
  );
}