import { useState, useEffect, useCallback } from 'react'

// ESPN public endpoints (proxied via vercel.json to avoid CORS)
const ESPN_BASE = '/api/espn'

// ESPN team abbreviation normalizer — ESPN uses different abbrs for some teams
const ESPN_ABBR_MAP = {
  'LAR': 'LA',
  'WSH': 'WAS',
  'JAX': 'JAC',
}
function normalizeAbbr(abbr) {
  return ESPN_ABBR_MAP[abbr] || abbr
}

export function useScoreboard(week = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetch_scores = useCallback(async () => {
    try {
      setLoading(true)
      const params = week ? `?week=${week}&seasontype=2` : ''
      const res = await fetch(`${ESPN_BASE}/scoreboard${params}`)
      if (!res.ok) throw new Error(`ESPN API ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [week])

  useEffect(() => {
    fetch_scores()
    const interval = setInterval(fetch_scores, 60000)
    return () => clearInterval(interval)
  }, [fetch_scores])

  return { data, loading, error, lastUpdated, refresh: fetch_scores }
}

// Fetch full season schedule for a specific team from ESPN
export function useTeamSchedule(teamAbbr) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!teamAbbr || teamAbbr === 'All') {
      setGames([])
      return
    }

    setLoading(true)
    setError(null)

    // ESPN team schedule endpoint — season 2026, regular season (seasontype=2)
    const url = `${ESPN_BASE}/teams/${teamAbbr.toLowerCase()}/schedule?season=2026&seasontype=2`

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`ESPN ${r.status}`)
        return r.json()
      })
      .then(data => {
        const parsed = parseTeamSchedule(data, teamAbbr)
        setGames(parsed)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [teamAbbr])

  return { games, loading, error }
}

// Fetch the full league schedule for a specific week from ESPN
export function useWeekSchedule(week) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!week) return
    setLoading(true)
    setError(null)

    fetch(`${ESPN_BASE}/scoreboard?week=${week}&seasontype=2&limit=20`)
      .then(r => r.json())
      .then(data => {
        const parsed = (data.events || []).map(parseESPNGame).filter(Boolean)
        setGames(parsed)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [week])

  return { games, loading, error }
}

// Parse ESPN team schedule response into our game format
function parseTeamSchedule(data, teamAbbr) {
  const events = data.events || []
  return events.map(event => {
    const comp = event.competitions?.[0]
    if (!comp) return null

    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    if (!home || !away) return null

    const homeAbbr = normalizeAbbr(home.team?.abbreviation || '')
    const awayAbbr = normalizeAbbr(away.team?.abbreviation || '')

    const statusState = event.status?.type?.state
    const isFinal = statusState === 'post'
    const isLive  = statusState === 'in'

    // Parse date
    const d = new Date(event.date)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dayStr  = d.toLocaleDateString('en-US', { weekday: 'short' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    // Week number
    const week = event.week?.number || null

    // Bye week detection
    const isBye = event.type?.abbreviation === 'BYE'

    return {
      espnId:    event.id,
      week,
      date:      dateStr,
      day:       dayStr,
      time:      timeStr,
      home:      homeAbbr,
      away:      awayAbbr,
      homeName:  home.team?.displayName || '',
      awayName:  away.team?.displayName || '',
      homeScore: isFinal || isLive ? parseInt(home.score) || 0 : null,
      awayScore: isFinal || isLive ? parseInt(away.score) || 0 : null,
      status:    isFinal ? 'final' : isLive ? 'live' : 'upcoming',
      network:   comp.broadcasts?.[0]?.names?.[0] || '',
      venue:     comp.venue?.fullName || '',
      isBye,
      isNeutralSite: comp.neutralSite || false,
      note:      comp.notes?.[0]?.headline || '',
    }
  }).filter(Boolean)
}

export function useBoxScore(gameId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    fetch(`${ESPN_BASE}/summary?event=${gameId}`)
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [gameId])

  return { data, loading, error }
}

export function useStandings() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${ESPN_BASE}/standings`)
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return { data, loading, error }
}

// Parse ESPN scoreboard event into our internal game format
export function parseESPNGame(event) {
  const comp = event.competitions?.[0]
  if (!comp) return null

  const home = comp.competitors?.find(c => c.homeAway === 'home')
  const away = comp.competitors?.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const homeAbbr = normalizeAbbr(home.team?.abbreviation || '')
  const awayAbbr = normalizeAbbr(away.team?.abbreviation || '')

  const status = event.status?.type
  const isLive    = status?.state === 'in'
  const isFinal   = status?.state === 'post'

  const linescores = (team) =>
    team.linescores?.map(ls => parseInt(ls.value) || 0) || []

  const homeLines = linescores(home)
  const awayLines = linescores(away)

  const periods = {}
  const maxQ = Math.max(homeLines.length, awayLines.length)
  for (let i = 0; i < maxQ; i++) {
    const label = i < 4 ? i + 1 : 'OT'
    periods[label] = {
      [homeAbbr]: homeLines[i] ?? 0,
      [awayAbbr]: awayLines[i] ?? 0,
    }
  }

  const d = new Date(event.date)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dayStr  = d.toLocaleDateString('en-US', { weekday: 'short' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return {
    id:        event.id,
    espnId:    event.id,
    week:      event.week?.number,
    date:      dateStr,
    day:       dayStr,
    time:      timeStr,
    name:      event.name,
    shortName: event.shortName,
    home:      homeAbbr,
    away:      awayAbbr,
    homeName:  home.team?.displayName,
    awayName:  away.team?.displayName,
    homeLogo:  home.team?.logo,
    awayLogo:  away.team?.logo,
    homeScore: isFinal || isLive ? parseInt(home.score) || 0 : null,
    awayScore: isFinal || isLive ? parseInt(away.score) || 0 : null,
    periods,
    status:    isFinal ? 'final' : isLive ? 'live' : 'upcoming',
    statusDetail: status?.detail || '',
    displayClock: event.status?.displayClock,
    period:    event.status?.period,
    network:   comp.broadcasts?.[0]?.names?.[0] || '',
    venue:     comp.venue?.fullName || '',
    venueCity: comp.venue?.address?.city || '',
    odds:      comp.odds?.[0]?.details || '',
    isNeutralSite: comp.neutralSite || false,
    note:      comp.notes?.[0]?.headline || '',
  }
}

// Parse ESPN box score summary into player stats
export function parseBoxScore(summary) {
  if (!summary) return null

  const teams = {}

  summary.boxscore?.teams?.forEach(t => {
    const abbr = normalizeAbbr(t.team?.abbreviation || '')
    if (!abbr) return
    const stats = {}
    t.statistics?.forEach(s => { stats[s.name] = s.displayValue })
    teams[abbr] = { stats }
  })

  summary.boxscore?.players?.forEach(teamData => {
    const abbr = normalizeAbbr(teamData.team?.abbreviation || '')
    if (!abbr || !teams[abbr]) return
    teams[abbr].players = {}

    teamData.statistics?.forEach(statGroup => {
      const cat = statGroup.name
      teams[abbr].players[cat] = statGroup.athletes?.map(a => {
        const vals = {}
        statGroup.labels?.forEach((label, i) => {
          vals[label] = a.stats?.[i] || '0'
        })
        return {
          name: a.athlete?.displayName || a.athlete?.shortName || '',
          id:   a.athlete?.id,
          ...vals,
        }
      }) || []
    })
  })

  const scoringPlays = summary.scoringPlays?.map(play => ({
    quarter: play.period?.number,
    time:    play.clock?.displayValue,
    team:    normalizeAbbr(play.team?.abbreviation || ''),
    score:   play.homeScore !== undefined
      ? `${play.awayScore} – ${play.homeScore}`
      : '',
    text:    play.text || play.type?.text || '',
    type:    play.type?.abbreviation || '',
  })) || []

  return { teams, scoringPlays }
}

export function useScoreboard(week = null) {  
const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetch_scores = useCallback(async () => {
    try {
      setLoading(true)
      const params = week ? `?week=${week}&seasontype=2` : ''
      const res = await fetch(`${ESPN_BASE}/scoreboard${params}`)
      if (!res.ok) throw new Error(`ESPN API ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [week])

  useEffect(() => {
    fetch_scores()
    // Auto-refresh every 60s during live games
    const interval = setInterval(fetch_scores, 60000)
    return () => clearInterval(interval)
  }, [fetch_scores])

  return { data, loading, error, lastUpdated, refresh: fetch_scores }
  }

export function useBoxScore(gameId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    fetch(`${ESPN_BASE}/summary?event=${gameId}`)
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [gameId])

  return { data, loading, error }
}

export function useStandings() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${ESPN_BASE}/standings`)
      .then(r => r.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return { data, loading, error }
}

// Parse ESPN scoreboard event into our internal game format
export function parseESPNGame(event) {
  const comp = event.competitions?.[0]
  if (!comp) return null

  const home = comp.competitors?.find(c => c.homeAway === 'home')
  const away = comp.competitors?.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const status = event.status?.type
  const isLive    = status?.state === 'in'
  const isFinal   = status?.state === 'post'
  const isPre     = status?.state === 'pre'

  const linescores = (team) =>
    team.linescores?.map(ls => parseInt(ls.value) || 0) || []

  const homeLines = linescores(home)
  const awayLines = linescores(away)

  // Build periods object {1:{HOME:7,AWAY:3}, ...}
  const periods = {}
  const maxQ = Math.max(homeLines.length, awayLines.length)
  for (let i = 0; i < maxQ; i++) {
    const label = i < 4 ? i + 1 : 'OT'
    periods[label] = {
      [home.team.abbreviation]: homeLines[i] ?? 0,
      [away.team.abbreviation]: awayLines[i] ?? 0,
    }
  }

  return {
    id:        event.id,
    espnId:    event.id,
    date:      event.date,
    name:      event.name,
    shortName: event.shortName,
    home:      home.team.abbreviation,
    away:      away.team.abbreviation,
    homeName:  home.team.displayName,
    awayName:  away.team.displayName,
    homeLogo:  home.team.logo,
    awayLogo:  away.team.logo,
    homeScore: isFinal || isLive ? parseInt(home.score) || 0 : null,
    awayScore: isFinal || isLive ? parseInt(away.score) || 0 : null,
    periods,
    status: isFinal ? 'final' : isLive ? 'live' : 'upcoming',
    statusDetail: status?.detail || '',
    displayClock: event.status?.displayClock,
    period: event.status?.period,
    network: comp.broadcasts?.[0]?.names?.[0] || '',
    venue: comp.venue?.fullName || '',
    venueCity: comp.venue?.address?.city || '',
    odds: comp.odds?.[0]?.details || '',
    isNeutralSite: comp.neutralSite || false,
    headline: event.competitions?.[0]?.notes?.[0]?.headline || '',
  }
}

// Parse ESPN box score summary into player stats
export function parseBoxScore(summary) {
  if (!summary) return null

  const teams = {}

  // Team stats
  summary.boxscore?.teams?.forEach(t => {
    const abbr = t.team?.abbreviation
    if (!abbr) return
    const stats = {}
    t.statistics?.forEach(s => { stats[s.name] = s.displayValue })
    teams[abbr] = { stats }
  })

  // Player stats
  summary.boxscore?.players?.forEach(teamData => {
    const abbr = teamData.team?.abbreviation
    if (!abbr || !teams[abbr]) return
    teams[abbr].players = {}

    teamData.statistics?.forEach(statGroup => {
      const cat = statGroup.name // 'passing', 'rushing', 'receiving', 'defensive'
      teams[abbr].players[cat] = statGroup.athletes?.map(a => {
        const vals = {}
        statGroup.labels?.forEach((label, i) => {
          vals[label] = a.stats?.[i] || '0'
        })
        return {
          name: a.athlete?.displayName || a.athlete?.shortName || '',
          id:   a.athlete?.id,
          ...vals,
        }
      }) || []
    })
  })

  // Scoring plays
  const scoringPlays = summary.scoringPlays?.map(play => ({
    quarter: play.period?.number,
    time:    play.clock?.displayValue,
    team:    play.team?.abbreviation,
    score:   play.homeScore !== undefined
      ? `${play.awayScore} – ${play.homeScore}`
      : '',
    text:    play.text || play.type?.text || '',
    type:    play.type?.abbreviation || '',
  })) || []

  return { teams, scoringPlays }
}
