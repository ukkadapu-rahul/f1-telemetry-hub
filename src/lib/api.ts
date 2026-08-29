// src/lib/api.ts

export interface SessionResult {
  driver_number: number;
  position: number;
  broadcast_name: string;
  team_name: string;
  team_colour: string;
  grid?: number;
  points?: number;
}

export interface DriverStanding {
  driver_number: number;
  position: number;
  points: number;
  broadcast_name: string;
  team_name: string;
  team_colour: string;
}

export interface ConstructorStanding {
  team_name: string;
  position: number;
  points: number;
  team_colour: string;
}

export interface SeasonStandingsData {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface PendingStatus {
  status: string;
}

// --- 1. DYNAMIC WEEKEND FETCHER --- //
export async function getLatestMeetingSessions() {
  try {
    const latestRes = await fetch('https://api.openf1.org/v1/sessions?session_key=latest');
    const latestData = await latestRes.json();
    
    if (!Array.isArray(latestData) || latestData.length === 0) return [];
    
    const activeMeetingKey = latestData[0].meeting_key;

    const res = await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${activeMeetingKey}`);
    const sessions = await res.json();
    
    return Array.isArray(sessions) ? sessions : [];
  } catch (err) {
    console.error("Failed to fetch latest meeting", err);
    return [];
  }
}

// --- 2. DATA MERGE HELPER --- //
async function fetchSessionData(sessionKey: number) {
  try {
    const resultsRes = await fetch(`https://api.openf1.org/v1/session_result?session_key=${sessionKey}`);
    const results = await resultsRes.json();
    const safeResults = Array.isArray(results) ? results : [];

    if (safeResults.length === 0) return { status: 'pending' };

    const driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
    const drivers = await driversRes.json();
    let safeDrivers = Array.isArray(drivers) ? drivers : [];

    // Fallback: If sprint/session drivers fail to load, fetch latest drivers
    if (safeDrivers.length === 0) {
      try {
        const fallbackDriversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=latest`);
        const fallbackDrivers = await fallbackDriversRes.json();
        safeDrivers = Array.isArray(fallbackDrivers) ? fallbackDrivers : [];
      } catch (err) {
        console.warn("Fallback driver fetch failed", err);
      }
    }

    const combinedData = safeResults.map((result: { driver_number: number; position: number; points: number; grid: number }) => {
      const driverInfo = safeDrivers.find((d: { driver_number: number; broadcast_name: string; team_name: string; team_colour: string }) => d.driver_number === result.driver_number);
      return {
        ...result,
        broadcast_name: driverInfo?.broadcast_name || 'Unknown',
        team_name: driverInfo?.team_name || 'Unknown',
        team_colour: driverInfo?.team_colour || 'ffffff'
      };
    });

    combinedData.sort((a: { position: number }, b: { position: number }) => {
      const posA = a.position || 999;
      const posB = b.position || 999;
      return posA - posB;
    });

    return combinedData;
  } catch (err) {
    console.error("Session data fetch failed", err);
    return { status: 'pending' };
  }
}

// Helper to find the latest valid race session for standings
async function getLatestRaceSessionKey() {
  try {
    const url = `https://api.openf1.org/v1/sessions?session_name=Race&session_name=Sprint`;
    const res = await fetch(url);
    const sessions = await res.json();
    
    if (!Array.isArray(sessions) || sessions.length === 0) return 'latest';

    sessions.sort((a: { date_end: string }, b: { date_end: string }) => 
      new Date(b.date_end).getTime() - new Date(a.date_end).getTime()
    );
    
    return sessions[0].session_key;
  } catch {
    return 'latest';
  }
}

// --- 3. VIEW FETCHERS --- //
export async function getQualifyingResults() {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    const qualiSession = sessions.find((s: { session_name: string }) => s.session_name === 'Qualifying');
    
    if (!raceSession) return { status: 'pending' };

    // 1. Fetch Official Starting Grid
    const gridRes = await fetch(`https://api.openf1.org/v1/starting_grid?session_key=${raceSession.session_key}`);
    const gridData = await gridRes.json();
    let safeGrid = Array.isArray(gridData) ? gridData : [];
    
    // Fallback if missing
    if (safeGrid.length === 0 && qualiSession) {
        const qualiRes = await fetch(`https://api.openf1.org/v1/session_result?session_key=${qualiSession.session_key}`);
        const qualiData = await qualiRes.json();
        safeGrid = Array.isArray(qualiData) ? qualiData : [];
    }

    // 2. ALWAYS fetch laps from Qualifying to guarantee we have times
    const bestLaps = new Map();
    if (qualiSession) {
        const lapsRes = await fetch(`https://api.openf1.org/v1/laps?session_key=${qualiSession.session_key}`);
        const lapsData = await lapsRes.json();
        
        if (Array.isArray(lapsData)) {
            lapsData.forEach((lap: { driver_number: number; lap_duration: number }) => {
                if (lap.lap_duration) {
                   const currentBest = bestLaps.get(lap.driver_number) || 9999;
                   if (lap.lap_duration < currentBest) {
                       bestLaps.set(lap.driver_number, lap.lap_duration);
                   }
                }
            });
        }
    }

    // 3. Fetch Drivers
    let driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${raceSession.session_key}`);
    let safeDrivers = await driversRes.json();
    if (!Array.isArray(safeDrivers) || safeDrivers.length === 0) {
      driversRes = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${raceSession.meeting_key}`);
      safeDrivers = await driversRes.json();
      safeDrivers = Array.isArray(safeDrivers) ? safeDrivers : [];
    }

    // 4. Merge Grid, Laps, and Drivers
    const combinedData = safeGrid.map((result: { driver_number: number; position: number; lap_duration?: number }) => {
      const driverInfo = safeDrivers.find((d: { driver_number: number; broadcast_name: string; team_name: string; team_colour: string }) => 
        Number(d.driver_number) === Number(result.driver_number)
      );
      
      // Use our manually calculated lap if the grid API failed to provide it
      const finalLapDuration = result.lap_duration || bestLaps.get(result.driver_number);

      return {
        driver_number: result.driver_number,
        position: result.position || 999, 
        lap_duration: finalLapDuration, 
        broadcast_name: driverInfo?.broadcast_name || 'Unknown',
        team_name: driverInfo?.team_name || 'Unknown',
        team_colour: driverInfo?.team_colour || 'ffffff'
      };
    });

    combinedData.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    return combinedData;
    
  } catch (err) {
    console.error("Starting grid fetch failed", err);
    return { status: 'pending' };
  }
}

export async function getRaceResults() {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    
    if (!raceSession) return { status: 'pending' };

    // 1. Fetch Official Race Results
    const resultsRes = await fetch(`https://api.openf1.org/v1/session_result?session_key=${raceSession.session_key}`);
    const results = await resultsRes.json();
    const safeResults = Array.isArray(results) ? results : [];

    if (safeResults.length === 0) return { status: 'pending' };

    // 2. Fetch Starting Grid (To calculate Positions Gained/Lost)
    const gridRes = await fetch(`https://api.openf1.org/v1/starting_grid?session_key=${raceSession.session_key}`);
    const gridData = await gridRes.json();
    const safeGrid = Array.isArray(gridData) ? gridData : [];

    // 3. Fetch Drivers (Bulletproof fallback using meeting_key)
    let driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${raceSession.session_key}`);
    let safeDrivers = await driversRes.json();
    
    if (!Array.isArray(safeDrivers) || safeDrivers.length === 0) {
      driversRes = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${raceSession.meeting_key}`);
      safeDrivers = await driversRes.json();
      safeDrivers = Array.isArray(safeDrivers) ? safeDrivers : [];
    }

// 4. Merge Data
    const combinedData = safeResults.map((result: { driver_number: number; position: number; points: number }) => {
      const driverInfo = safeDrivers.find((d: { driver_number: number; broadcast_name: string; team_name: string; team_colour: string }) => 
        Number(d.driver_number) === Number(result.driver_number)
      );
      
      //Force strict Number() comparison to prevent string/number mismatches
      const startingSlot = safeGrid.find((g: { driver_number: number; position: number }) => 
        Number(g.driver_number) === Number(result.driver_number)
      );

      // Add a quick debug log so we can see it in the VS Code terminal
      if (!startingSlot) {
         console.warn(`Missing grid data for Driver ${result.driver_number}`);
      }

      // Safely handle DNF positions so math doesn't break
      const finishPos = result.position || 999; 

      return {
        ...result,
        position: finishPos, // Map null DNF to 999
        grid: startingSlot ? startingSlot.position : finishPos, 
        broadcast_name: driverInfo?.broadcast_name || 'Unknown',
        team_name: driverInfo?.team_name || 'Unknown',
        team_colour: driverInfo?.team_colour || 'ffffff'
      };
    });

    // THE FIX: Safely handle null/DNF positions by assigning them 999 during the sort
    combinedData.sort((a: { position: number }, b: { position: number }) => {
      const posA = a.position || 999;
      const posB = b.position || 999;
      return posA - posB;
    });

    return combinedData;

  } catch (err) {
    console.error("Race data fetch failed", err);
    return { status: 'pending' };
  }
}

export async function getPracticeResults(): Promise<SessionResult[] | PendingStatus> {
  const sessions = await getLatestMeetingSessions();
  
  const practiceSession = [...sessions].reverse().find((s: { session_name: string }) => 
    s.session_name.includes('Practice')
  );
  
  if (!practiceSession) return { status: 'pending' };
  
  return fetchSessionData(practiceSession.session_key) as Promise<SessionResult[] | PendingStatus>;
}

export async function getSeasonStandings(): Promise<SeasonStandingsData | PendingStatus> {
  try {
    const raceSessionKey = await getLatestRaceSessionKey();

    const driverStandingsRes = await fetch(`https://api.openf1.org/v1/championship_drivers?session_key=${raceSessionKey}`);
    const driverStandings = await driverStandingsRes.json();
    const safeDriverStandings = Array.isArray(driverStandings) ? driverStandings : [];

    const teamStandingsRes = await fetch(`https://api.openf1.org/v1/championship_teams?session_key=${raceSessionKey}`);
    const teamStandings = await teamStandingsRes.json();
    const safeTeamStandings = Array.isArray(teamStandings) ? teamStandings : [];

    if (safeDriverStandings.length === 0) return { status: 'pending' };

    const targetSessionKey = safeDriverStandings[0].session_key;

    const driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${targetSessionKey}`);
    const drivers = await driversRes.json();
    const safeDrivers = Array.isArray(drivers) ? drivers : [];

    const driversData = await Promise.all(
      safeDriverStandings.map(async (standing: { driver_number: number; position_current: number; points_current: number }) => {
        let driverInfo = safeDrivers.find((d: { driver_number: number; broadcast_name: string; team_name: string; team_colour: string }) => 
          Number(d.driver_number) === Number(standing.driver_number)
        );

        if (!driverInfo) {
          try {
            const fallbackRes = await fetch(`https://api.openf1.org/v1/drivers?driver_number=${standing.driver_number}`);
            const contentType = fallbackRes.headers.get("content-type");
            if (fallbackRes.ok && contentType && contentType.includes("application/json")) {
              const fallbackData = await fallbackRes.json();
              if (Array.isArray(fallbackData) && fallbackData.length > 0) {
                driverInfo = fallbackData[fallbackData.length - 1]; 
              }
            }
          } catch (err) {
            console.error(`Failed to fetch fallback driver info for ${standing.driver_number}`, err);
          }
        }
        
        return {
          driver_number: standing.driver_number,
          position: standing.position_current,
          points: standing.points_current,
          broadcast_name: driverInfo?.broadcast_name || 'Unknown',
          team_name: driverInfo?.team_name || 'Unknown',
          team_colour: driverInfo?.team_colour || 'ffffff'
        };
      })
    );
    
    driversData.sort((a: { position: number }, b: { position: number }) => a.position - b.position);

    const constructorsData = safeTeamStandings.map((team: { team_name: string; position_current: number; points_current: number }) => {
      const teamDriver = safeDrivers.find((d: { team_name: string; team_colour: string }) => d.team_name === team.team_name);

      return {
        team_name: team.team_name,
        position: team.position_current,
        points: team.points_current,
        team_colour: teamDriver?.team_colour || 'ffffff'
      };
    });
    constructorsData.sort((a: { position: number }, b: { position: number }) => a.position - b.position);

    return {
      drivers: driversData,
      constructors: constructorsData
    };

  } catch (err) {
    console.error("Standings fetch failed", err);
    return { status: 'pending' };
  }
}

// --- 4. TOP NAV FETCHERS --- //
export async function getLatestSession() {
  const res = await fetch(`https://api.openf1.org/v1/sessions?session_key=latest`);
  const sessions = await res.json();
  return Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : null;
}

export async function getTopSpeedTrap() {
  try {
    const sessions = await getLatestMeetingSessions();
    const qualiSession = sessions.find((s: { session_name: string }) => s.session_name === 'Qualifying');
    
    if (!qualiSession) return { speed: '--', driver: 'N/A' };

    const lapsRes = await fetch(`https://api.openf1.org/v1/laps?session_key=${qualiSession.session_key}`);
    const laps = await lapsRes.json();
    const safeLaps = Array.isArray(laps) ? laps : [];

    let maxSpeed = 0;
    let fastestDriverNumber = null;

    safeLaps.forEach((lap: { st_speed: number; driver_number: number }) => {
      if (lap.st_speed && lap.st_speed > maxSpeed) {
        maxSpeed = lap.st_speed;
        fastestDriverNumber = lap.driver_number;
      }
    });

    let driverName = 'Unknown';
    if (fastestDriverNumber) {
      const driverRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${qualiSession.session_key}&driver_number=${fastestDriverNumber}`);
      const driverData = await driverRes.json();
      if (Array.isArray(driverData) && driverData.length > 0) {
        driverName = driverData[0].broadcast_name;
      }
    }

    return { speed: maxSpeed, driver: driverName };
  } catch (err) {
    console.error("Failed to fetch telemetry", err);
    return { speed: '--', driver: 'N/A' };
  }
}

export async function getMeetingFormat(): Promise<{ hasSprint: boolean }> {
  const sessions = await getLatestMeetingSessions();
  const hasSprint = sessions.some((s: { session_name: string }) => 
    s.session_name.toLowerCase().includes('sprint')
  );
  return { hasSprint };
}

export async function getSprintQualifyingResults() {
  try {
    const sessions = await getLatestMeetingSessions();
    const sprintSession = sessions.find((s: { session_name: string }) => s.session_name === 'Sprint');
    const sprintQualiSession = sessions.find((s: { session_name: string }) => 
      s.session_name === 'Sprint Qualifying' || s.session_name === 'Sprint Shootout'
    );
    
    if (!sprintSession) return { status: 'pending' };

    // 1. Fetch Official Sprint Grid
    const gridRes = await fetch(`https://api.openf1.org/v1/starting_grid?session_key=${sprintSession.session_key}`);
    const gridData = await gridRes.json();
    let safeGrid = Array.isArray(gridData) ? gridData : [];
    
    // Fallback if missing
    if (safeGrid.length === 0 && sprintQualiSession) {
        const qualiRes = await fetch(`https://api.openf1.org/v1/session_result?session_key=${sprintQualiSession.session_key}`);
        const qualiData = await qualiRes.json();
        safeGrid = Array.isArray(qualiData) ? qualiData : [];
    }

    // 2. ALWAYS fetch laps from Sprint Quali to guarantee we have times
    const bestLaps = new Map();
    if (sprintQualiSession) {
        const lapsRes = await fetch(`https://api.openf1.org/v1/laps?session_key=${sprintQualiSession.session_key}`);
        const lapsData = await lapsRes.json();
        
        if (Array.isArray(lapsData)) {
            lapsData.forEach((lap: { driver_number: number; lap_duration: number }) => {
                if (lap.lap_duration) {
                   const currentBest = bestLaps.get(lap.driver_number) || 9999;
                   if (lap.lap_duration < currentBest) {
                       bestLaps.set(lap.driver_number, lap.lap_duration);
                   }
                }
            });
        }
    }

    // 3. Fetch Drivers
    let driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sprintSession.session_key}`);
    let safeDrivers = await driversRes.json();
    if (!Array.isArray(safeDrivers) || safeDrivers.length === 0) {
      driversRes = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${sprintSession.meeting_key}`);
      safeDrivers = await driversRes.json();
      safeDrivers = Array.isArray(safeDrivers) ? safeDrivers : [];
    }

    // 4. Merge Grid, Laps, and Drivers
    const combinedData = safeGrid.map((result: { driver_number: number; position: number; lap_duration?: number }) => {
      const driverInfo = safeDrivers.find((d: { driver_number: number; broadcast_name: string; team_name: string; team_colour: string }) => 
        Number(d.driver_number) === Number(result.driver_number)
      );
      
      // Use our manually calculated lap if the grid API failed to provide it
      const finalLapDuration = result.lap_duration || bestLaps.get(result.driver_number);

      return {
        driver_number: result.driver_number,
        position: result.position || 999, 
        lap_duration: finalLapDuration, 
        broadcast_name: driverInfo?.broadcast_name || 'Unknown',
        team_name: driverInfo?.team_name || 'Unknown',
        team_colour: driverInfo?.team_colour || 'ffffff'
      };
    });

    combinedData.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    return combinedData;
    
  } catch (err) {
    console.error("Sprint Starting grid fetch failed", err);
    return { status: 'pending' };
  }
}

export async function getSprintResults(): Promise<SessionResult[] | PendingStatus> {
  const sessions = await getLatestMeetingSessions();
  const sprintRace = sessions.find((s: { session_name: string }) => 
    s.session_name === 'Sprint'
  );

  if (!sprintRace) return { status: 'pending' };
  return fetchSessionData(sprintRace.session_key) as Promise<SessionResult[] | PendingStatus>;
}