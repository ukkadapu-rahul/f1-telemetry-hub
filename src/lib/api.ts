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
  const sessions = await getLatestMeetingSessions();
  const qualiSession = sessions.find((s: { session_name: string }) => s.session_name === 'Qualifying');
  
  if (!qualiSession) return { status: 'pending' };
  return fetchSessionData(qualiSession.session_key);
}

export async function getRaceResults() {
  const sessions = await getLatestMeetingSessions();
  const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
  
  if (!raceSession) return { status: 'pending' };
  return fetchSessionData(raceSession.session_key);
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

export async function getSprintQualifyingResults(): Promise<SessionResult[] | PendingStatus> {
  const sessions = await getLatestMeetingSessions();
  const sprintQuali = sessions.find((s: { session_name: string }) => 
    s.session_name.toLowerCase().includes('sprint') && s.session_name.toLowerCase().includes('qual')
  ) || sessions.find((s: { session_name: string }) => 
    s.session_name.toLowerCase().includes('shootout')
  );

  if (!sprintQuali) return { status: 'pending' };
  return fetchSessionData(sprintQuali.session_key) as Promise<SessionResult[] | PendingStatus>;
}

export async function getSprintResults(): Promise<SessionResult[] | PendingStatus> {
  const sessions = await getLatestMeetingSessions();
  const sprintRace = sessions.find((s: { session_name: string }) => 
    s.session_name === 'Sprint'
  );

  if (!sprintRace) return { status: 'pending' };
  return fetchSessionData(sprintRace.session_key) as Promise<SessionResult[] | PendingStatus>;
}