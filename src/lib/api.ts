// src/lib/api.ts

export interface SessionResult {
  driver_number: number;
  position: number;
  broadcast_name: string;
  team_name: string;
  team_colour: string;
  grid?: number;
  points?: number;
  lap_duration?: number;
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

interface LapRecord {
  lap_duration?: number;
  lap_number: number;
  driver_number: number;
  is_pit_out_lap?: boolean;
}

interface PitRecord {
  stop_duration?: number;
  lane_duration?: number;
  pit_duration?: number;
  driver_number: number;
}

interface DriverRecord {
  driver_number: number;
  broadcast_name: string;
  team_name?: string;
  team_colour?: string;
}

interface GridRecord {
  driver_number: number;
  position: number;
}

interface RawSessionResult {
  driver_number: number;
  position?: number;
  points?: number;
  grid?: number;
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

    const combinedData = safeResults.map((result: { driver_number: number; position: number; points?: number; grid?: number }) => {
      const driverInfo = safeDrivers.find((d: DriverRecord) => d.driver_number === result.driver_number);
      return {
        ...result,
        broadcast_name: driverInfo?.broadcast_name || 'Unknown',
        team_name: driverInfo?.team_name || 'Unknown',
        team_colour: driverInfo?.team_colour || 'ffffff'
      };
    });

    combinedData.sort((a: { position?: number }, b: { position?: number }) => {
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
export async function getPracticeResults(): Promise<SessionResult[] | PendingStatus> {
  try {
    const sessions = await getLatestMeetingSessions();
    const practiceSessions = sessions.filter((s: { session_name: string }) => 
      s.session_name.toLowerCase().includes('practice')
    );
    
    if (practiceSessions.length === 0) return { status: 'pending' };
    
    // Pick the most recent practice session (e.g. FP3 or FP2)
    const latestPractice = practiceSessions[practiceSessions.length - 1];
    return fetchSessionData(latestPractice.session_key) as Promise<SessionResult[] | PendingStatus>;
  } catch (err) {
    console.error("Practice results fetch failed", err);
    return { status: 'pending' };
  }
}

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
    const bestLaps = new Map<number, number>();
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
    const combinedData: SessionResult[] = safeGrid.map((result: { driver_number: number; position: number; lap_duration?: number }) => {
      const driverInfo = safeDrivers.find((d: DriverRecord) => 
        Number(d.driver_number) === Number(result.driver_number)
      );
      
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

    combinedData.sort((a, b) => a.position - b.position);
    return combinedData;
    
  } catch (err) {
    console.error("Starting grid fetch failed", err);
    return { status: 'pending' };
  }
}

export async function getRaceResults(): Promise<SessionResult[] | PendingStatus> {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    if (!raceSession) return { status: 'pending' };

    const [resultsRes, driversRes, gridRes] = await Promise.all([
      fetch(`https://api.openf1.org/v1/session_result?session_key=${raceSession.session_key}`),
      fetch(`https://api.openf1.org/v1/drivers?session_key=${raceSession.session_key}`),
      fetch(`https://api.openf1.org/v1/starting_grid?session_key=${raceSession.session_key}`)
    ]);

    const resultsData: RawSessionResult[] = await resultsRes.json();
    const driversData: DriverRecord[] = await driversRes.json();
    const gridData: GridRecord[] = await gridRes.json();

    if (!Array.isArray(resultsData) || resultsData.length === 0) return { status: 'pending' };

    const formattedResults: SessionResult[] = resultsData.map((result: RawSessionResult) => {
      const driverInfo = Array.isArray(driversData) 
        ? driversData.find((d: DriverRecord) => Number(d.driver_number) === Number(result.driver_number))
        : null;
        
      const gridInfo = Array.isArray(gridData)
        ? gridData.find((g: GridRecord) => Number(g.driver_number) === Number(result.driver_number))
        : null;

      return {
        driver_number: result.driver_number,
        position: result.position || 999,
        grid: gridInfo?.position || result.position, 
        broadcast_name: driverInfo?.broadcast_name || `Car #${result.driver_number}`,
        team_name: driverInfo?.team_name || 'Unknown Team',
        team_colour: driverInfo?.team_colour || 'ffffff',
        points: result.points || 0 
      };
    });

    formattedResults.sort((a: SessionResult, b: SessionResult) => a.position - b.position);
    return formattedResults;
  } catch (err) {
    console.error("Race results fetch failed", err);
    return { status: 'pending' };
  }
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
        let driverInfo = safeDrivers.find((d: DriverRecord) => 
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
    
    driversData.sort((a, b) => a.position - b.position);

    const constructorsData = safeTeamStandings.map((team: { team_name: string; position_current: number; points_current: number }) => {
      const teamDriver = safeDrivers.find((d: DriverRecord) => d.team_name === team.team_name);

      return {
        team_name: team.team_name,
        position: team.position_current,
        points: team.points_current,
        team_colour: teamDriver?.team_colour || 'ffffff'
      };
    });
    constructorsData.sort((a, b) => a.position - b.position);

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
    let fastestDriverNumber: number | null = null;

    safeLaps.forEach((lap: { st_speed?: number; driver_number: number }) => {
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

    const gridRes = await fetch(`https://api.openf1.org/v1/starting_grid?session_key=${sprintSession.session_key}`);
    const gridData = await gridRes.json();
    let safeGrid = Array.isArray(gridData) ? gridData : [];
    
    if (safeGrid.length === 0 && sprintQualiSession) {
        const qualiRes = await fetch(`https://api.openf1.org/v1/session_result?session_key=${sprintQualiSession.session_key}`);
        const qualiData = await qualiRes.json();
        safeGrid = Array.isArray(qualiData) ? qualiData : [];
    }

    const bestLaps = new Map<number, number>();
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

    let driversRes = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sprintSession.session_key}`);
    let safeDrivers = await driversRes.json();
    if (!Array.isArray(safeDrivers) || safeDrivers.length === 0) {
      driversRes = await fetch(`https://api.openf1.org/v1/drivers?meeting_key=${sprintSession.meeting_key}`);
      safeDrivers = await driversRes.json();
      safeDrivers = Array.isArray(safeDrivers) ? safeDrivers : [];
    }

    const combinedData: SessionResult[] = safeGrid.map((result: { driver_number: number; position: number; lap_duration?: number }) => {
      const driverInfo = safeDrivers.find((d: DriverRecord) => 
        Number(d.driver_number) === Number(result.driver_number)
      );
      
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

    combinedData.sort((a, b) => a.position - b.position);
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

export async function getRaceEvents() {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    if (!raceSession) return null;

    const res = await fetch(`https://api.openf1.org/v1/race_control?session_key=${raceSession.session_key}`);
    const data = await res.json();
    
    if (!Array.isArray(data)) return null;

    let yellowFlags = 0;
    let redFlags = 0;
    let safetyCars = 0;
    let vsc = 0;

    let lastYellowTime = 0; 
    const incidentWindow = 120000;

    data.forEach((event: { flag?: string; message?: string; date?: string; category?: string; scope?: string }) => {
      const flag = event.flag?.toUpperCase() || '';
      const msg = event.message?.toUpperCase() || '';
      const category = event.category || '';
      const scope = event.scope || '';
      const eventTime = event.date ? new Date(event.date).getTime() : 0;

      if (category === 'SafetyCar') {
        if (msg.includes('DEPLOYED')) {
           if (msg.includes('VIRTUAL') || msg.includes('VSC')) {
               vsc++;
           } else {
               safetyCars++;
           }
        }
      }

      if (category === 'Flag') {
        if (flag === 'RED') redFlags++;
        
        if (flag === 'YELLOW' || flag === 'DOUBLE YELLOW') {
          if (scope !== 'Driver') {
             const timeSinceLast = eventTime - lastYellowTime;
             lastYellowTime = eventTime; 
             
             if (timeSinceLast > incidentWindow) {
                yellowFlags++;
             }
          }
        }
      }
    });

    return { yellowFlags, redFlags, safetyCars, vsc };
  } catch (err) {
    console.error("Race events fetch failed", err);
    return null;
  }
}

export async function getFastestLap() {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    if (!raceSession) return null;

    const [lapsRes, driversRes] = await Promise.all([
      fetch(`https://api.openf1.org/v1/laps?session_key=${raceSession.session_key}`),
      fetch(`https://api.openf1.org/v1/drivers?session_key=${raceSession.session_key}`)
    ]);

    const lapsData: LapRecord[] = await lapsRes.json();
    const driversData: DriverRecord[] = await driversRes.json();

    if (!Array.isArray(lapsData) || lapsData.length === 0) return null;

    const validLaps = lapsData.filter((lap: LapRecord) => lap.lap_duration && !lap.is_pit_out_lap);
    if (validLaps.length === 0) return null;

    let fastestLap = validLaps[0];
    validLaps.forEach((lap: LapRecord) => {
      if (lap.lap_duration && fastestLap.lap_duration && lap.lap_duration < fastestLap.lap_duration) {
        fastestLap = lap;
      }
    });

    const driverInfo = Array.isArray(driversData) 
      ? driversData.find((d: DriverRecord) => Number(d.driver_number) === Number(fastestLap.driver_number))
      : null;

    return {
      duration: fastestLap.lap_duration || 0,
      lap_number: fastestLap.lap_number,
      driver: driverInfo?.broadcast_name || `Car #${fastestLap.driver_number}`,
      colour: driverInfo?.team_colour || 'ffffff'
    };
  } catch (err) {
    console.error("Fastest lap fetch failed", err);
    return null;
  }
}

export async function getFastestPitStop() {
  try {
    const sessions = await getLatestMeetingSessions();
    const raceSession = sessions.find((s: { session_name: string }) => s.session_name === 'Race');
    if (!raceSession) return null;

    const [pitRes, driversRes] = await Promise.all([
      fetch(`https://api.openf1.org/v1/pit?session_key=${raceSession.session_key}`),
      fetch(`https://api.openf1.org/v1/drivers?session_key=${raceSession.session_key}`)
    ]);

    const pitData: PitRecord[] = await pitRes.json();
    const driversData: DriverRecord[] = await driversRes.json();

    if (!Array.isArray(pitData) || pitData.length === 0) return null;

    const stationaryStops = pitData.filter((pit: PitRecord) => 
      pit.stop_duration && pit.stop_duration > 1.5 && pit.stop_duration < 8.0
    );

    let fastestPit: PitRecord;
    let minTime: number;

    if (stationaryStops.length > 0) {
      fastestPit = stationaryStops[0];
      minTime = fastestPit.stop_duration!;
      stationaryStops.forEach((pit: PitRecord) => {
        if (pit.stop_duration && pit.stop_duration < minTime) {
          minTime = pit.stop_duration;
          fastestPit = pit;
        }
      });
    } else {
      const lanePits = pitData.filter((pit: PitRecord) => pit.lane_duration || pit.pit_duration);
      if (lanePits.length === 0) return null;

      fastestPit = lanePits[0];
      minTime = fastestPit.lane_duration || fastestPit.pit_duration || 999;
      lanePits.forEach((pit: PitRecord) => {
        const time = pit.lane_duration || pit.pit_duration;
        if (time && time < minTime) {
          minTime = time;
          fastestPit = pit;
        }
      });
    }

    const driverInfo = Array.isArray(driversData)
      ? driversData.find((d: DriverRecord) => Number(d.driver_number) === Number(fastestPit.driver_number))
      : null;

    return {
      duration: minTime,
      driver: driverInfo?.broadcast_name || `Car #${fastestPit.driver_number}`,
      colour: driverInfo?.team_colour || 'ffffff'
    };
  } catch (err) {
    console.error("Fastest pit fetch failed", err);
    return null;
  }
}