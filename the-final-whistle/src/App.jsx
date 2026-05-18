import { useState, useEffect } from 'react'
import { useScoreboard, useBoxScore, parseESPNGame } from './hooks/useESPN'
import { SCHEDULE_2026, WEEK_META, ALL_TEAMS, getTeamSchedule } from './data/schedule2026'
import { ti, networkColor, fmt } from './utils/teams'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const CURRENT_WEEK = 1  // Update each week — or auto-detect from ESPN data
const ROUND_ORDER  = ['Super Bowl','Conf Champs','Divisional','Wild Card']
const ALL_WEEKS    = [...Array(18)].map((_,i) => i + 1)

// ── TOP-LEVEL NAV VIEWS ───────────────────────────────────────────────────────
const VIEWS = ['Scores', 'Schedule', 'Standings', 'Leaders', 'Fantasy']

export default function App() {
  const [activeView,    setActiveView]    = useState('Scores')
  const [activeWeek,    setActiveWeek]    = useState(CURRENT_WEEK)
  const [openCardId,    setOpenCardId]    = useState(null)
  const [teamFilter,    setTeamFilter]    = useState('All')
  const [weekFilter,    setWeekFilter]    = useState('All')
  const [fantMode,      setFantMode]      = useState('std') // 'std' | 'ppr'
  const [leadersTab,    setLeadersTab]    = useState('offense')

  // Live ESPN scoreboard for current week
  const { data: espnData, loading, error, lastUpdated, refresh } = useScoreboard(activeWeek)

  // Parse ESPN games
  const liveGames = espnData?.events?.map(parseESPNGame).filter(Boolean) || []

  // Merge live scores into schedule
  const mergedGames = SCHEDULE_2026.filter(g => g.week === activeWeek).map(g => {
    const live = liveGames.find(lg =>
      lg.home === g.home && lg.away === g.away
    )
    if (live) return { ...g, ...live }
    return g
  })

  // Detect if any game is live (for auto-refresh indicator)
  const hasLiveGame = liveGames.some(g => g.status === 'live')

  return (
    <div className="app">
      {/* ── MASTHEAD ── */}
      <Masthead lastUpdated={lastUpdated} hasLiveGame={hasLiveGame} onRefresh={refresh} />

      {/* ── TOP NAV ── */}
      <nav className="top-nav">
        {VIEWS.map(v => (
          <button
            key={v}
            className={`tnav-btn ${activeView === v ? 'on' : ''} ${v === 'Fantasy' ? 'tnav-fantasy' : ''}`}
            onClick={() => setActiveView(v)}
          >{v}</button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <main>
        {activeView === 'Scores'    && (
          <ScoresView
            week={activeWeek}
            games={mergedGames}
            loading={loading}
            error={error}
            openCardId={openCardId}
            setOpenCardId={setOpenCardId}
            activeWeek={activeWeek}
            setActiveWeek={setActiveWeek}
          />
        )}
        {activeView === 'Schedule'  && (
          <ScheduleView
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
            weekFilter={weekFilter}
            setWeekFilter={setWeekFilter}
            onJumpToScore={(week, gameKey) => {
              setActiveWeek(week)
              setActiveView('Scores')
              setOpenCardId(gameKey)
            }}
          />
        )}
        {activeView === 'Standings' && <StandingsView />}
        {activeView === 'Leaders'   && (
          <LeadersView tab={leadersTab} setTab={setLeadersTab} />
        )}
        {activeView === 'Fantasy'   && (
          <FantasyView mode={fantMode} setMode={setFantMode} />
        )}
      </main>

      <Footer />
    </div>
  )
}

// ── MASTHEAD ──────────────────────────────────────────────────────────────────
function Masthead({ lastUpdated, hasLiveGame, onRefresh }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const vol = `Vol. ${now.getFullYear()} · No. ${Math.ceil((now - new Date(now.getFullYear(),0,1))/(7*86400000))}`

  return (
    <header className="masthead">
      <div className="edition-line">
        <span>{vol}</span>
        <span>{dateStr}</span>
      </div>
      <div className="logo">The Final Whistle</div>
      <div className="tagline">NFL · Scores · Box Scores · Fantasy · Schedule</div>
      <div className="support-bar">
        <span className="support-text">Independent &amp; ad-free. If it's useful,</span>
        <span className="support-div">—</span>
        <a className="support-link" href="https://buymeacoffee.com/YOUR_BMAC_USERNAME" target="_blank" rel="noopener">
          buy me a coffee ☕
        </a>
        {lastUpdated && (
          <span className="live-badge" onClick={onRefresh} title="Click to refresh">
            {hasLiveGame && <span className="live-dot" />}
            {hasLiveGame ? 'LIVE' : `Updated ${lastUpdated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`}
          </span>
        )}
      </div>
    </header>
  )
}

// ── WEEK SELECTOR ─────────────────────────────────────────────────────────────
function WeekSelector({ active, onChange }) {
  return (
    <div className="week-selector">
      <div className="week-label-row">
        <span className="ws-label">Week</span>
        <div className="ws-pills">
          {ALL_WEEKS.map(w => (
            <button
              key={w}
              className={`ws-btn ${active === w ? 'on' : ''}`}
              onClick={() => onChange(w)}
            >{w}</button>
          ))}
        </div>
      </div>
      {WEEK_META[active] && (
        <div className="week-meta-bar">
          <span className="wm-label">{WEEK_META[active].label}</span>
          <span className="wm-dates">{WEEK_META[active].dates}</span>
          {WEEK_META[active].note && <span className="wm-note">{WEEK_META[active].note}</span>}
        </div>
      )}
    </div>
  )
}

// ── SCORES VIEW ───────────────────────────────────────────────────────────────
function ScoresView({ week, games, loading, error, openCardId, setOpenCardId, activeWeek, setActiveWeek }) {
  return (
    <div>
      <WeekSelector active={activeWeek} onChange={setActiveWeek} />
      <div className="section-bar">
        <h2>Week {week} Scores</h2>
        <div className="sb-rule" />
        <span className="sb-ct">
          {loading ? 'Loading…' : `${games.length} game${games.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      {error && <div className="error-bar">⚠ Could not reach ESPN — showing scheduled games. <button onClick={() => window.location.reload()}>Retry</button></div>}
      <div className="games-grid">
        {games.map((g, i) => (
          <GameCard
            key={`${g.home}-${g.away}-${g.date}`}
            game={g}
            isOpen={openCardId === `${g.home}-${g.away}`}
            onToggle={() => setOpenCardId(
              openCardId === `${g.home}-${g.away}` ? null : `${g.home}-${g.away}`
            )}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}

// ── GAME CARD ─────────────────────────────────────────────────────────────────
function GameCard({ game: g, isOpen, onToggle, index }) {
  const { data: boxData, loading: boxLoading } = useBoxScore(isOpen ? g.espnId : null)

  const isFinal    = g.status === 'final'
  const isLive     = g.status === 'live'
  const isUpcoming = g.status === 'upcoming'
  const isFeat     = g.note?.includes('Rematch') || g.note?.includes('Opener') || g.note?.includes('Super Bowl')

  const homeWin = isFinal && g.homeScore > g.awayScore
  const awayWin = isFinal && g.awayScore > g.homeScore

  const statusLabel = isLive
    ? `Q${g.period} · ${g.displayClock}`
    : isFinal ? 'Final'
    : g.time

  const netColor = networkColor(g.network)

  return (
    <div
      className={`game-card ${isOpen ? 'open' : ''} ${isFeat ? 'featured' : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* HEADER — always visible, click to toggle */}
      <div className="card-head" onClick={onToggle}>
        {g.note && <div className="card-note">{g.note}</div>}
        {g.intl  && <div className="card-intl">🌍 {g.intlCity}</div>}
        <div className="card-status-row">
          <span className={`card-status ${isLive ? 'live' : isFinal ? 'final' : 'upcoming'}`}>
            {isLive && <span className="status-dot" />}
            {statusLabel}
          </span>
          {g.network && (
            <span className="network-badge" style={{ background: netColor.bg, color: netColor.text }}>
              {g.network.replace('/SNF','').replace('/MNF','').replace('/TNF','')}
            </span>
          )}
        </div>

        <div className="matchup">
          <TeamRow abbr={g.away} score={g.awayScore} isWin={awayWin} isLose={homeWin} isHome={false} />
          <div className="match-divider" />
          <TeamRow abbr={g.home} score={g.homeScore} isWin={homeWin} isLose={awayWin} isHome={true} />
        </div>

        {/* Linescore */}
        {(isFinal || isLive) && g.periods && Object.keys(g.periods).length > 0 && (
          <Linescore game={g} />
        )}

        <div className="card-toggle-hint">
          <span className="tog-arr">{isOpen ? '▲' : '▼'}</span>
          {isFinal ? 'Box Score & Stats' : 'Game Info'}
        </div>
      </div>

      {/* DRAWER */}
      {isOpen && (
        <div className="drawer">
          {isFinal && (
            <BoxScoreDrawer espnData={boxData} loading={boxLoading} game={g} />
          )}
          {isUpcoming && <GameInfoDrawer game={g} />}
          {isLive && <LiveDrawer game={g} espnData={boxData} loading={boxLoading} />}
        </div>
      )}
    </div>
  )
}

function TeamRow({ abbr, score, isWin, isLose, isHome }) {
  const info = ti(abbr)
  return (
    <div className={`team-row ${isWin ? 'winner' : ''} ${isLose ? 'loser' : ''}`}>
      <div className="team-left">
        <span className="team-abv">{abbr}</span>
        <span className="team-city">{info.city} · {isHome ? 'Home' : 'Away'}</span>
      </div>
      <span className="team-score">{score != null ? score : '—'}</span>
    </div>
  )
}

function Linescore({ game: g }) {
  const qs = Object.keys(g.periods || {})
  if (!qs.length) return null
  const teams = [g.away, g.home]
  return (
    <div className="linescore-wrap">
      <table className="ls-table">
        <thead>
          <tr>
            <th className="lt-team"></th>
            {qs.map(q => <th key={q}>{q}</th>)}
            <th className="lt-total">F</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(tm => {
            const isW = tm === (g.homeScore > g.awayScore ? g.home : g.away)
            return (
              <tr key={tm} className={isW ? 'lwin' : ''}>
                <td className="lt-team">{tm}</td>
                {qs.map(q => <td key={q}>{g.periods[q]?.[tm] ?? 0}</td>)}
                <td className="lt-total">{g.score?.[tm] ?? (tm === g.home ? g.homeScore : g.awayScore)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── BOX SCORE DRAWER ──────────────────────────────────────────────────────────
function BoxScoreDrawer({ espnData, loading, game }) {
  const [drawerTab, setDrawerTab] = useState('scoring')

  if (loading) return <div className="drawer-loading">Loading box score…</div>
  if (!espnData) return <div className="drawer-loading">Box score not available</div>

  const tabs = ['Scoring', 'Team Stats', 'Passing', 'Rushing', 'Receiving', 'Defense']

  return (
    <div className="box-drawer">
      <div className="drawer-tabs">
        {tabs.map(t => (
          <button
            key={t}
            className={`dtab ${drawerTab === t.toLowerCase().replace(' ', '_') ? 'on' : ''}`}
            onClick={() => setDrawerTab(t.toLowerCase().replace(' ', '_'))}
          >{t}</button>
        ))}
      </div>
      <div className="drawer-panel">
        {drawerTab === 'scoring'     && <ScoringPlays espnData={espnData} />}
        {drawerTab === 'team_stats'  && <TeamStats espnData={espnData} game={game} />}
        {drawerTab === 'passing'     && <PlayerStats espnData={espnData} cat="passing" />}
        {drawerTab === 'rushing'     && <PlayerStats espnData={espnData} cat="rushing" />}
        {drawerTab === 'receiving'   && <PlayerStats espnData={espnData} cat="receiving" />}
        {drawerTab === 'defense'     && <PlayerStats espnData={espnData} cat="defensive" />}
      </div>
    </div>
  )
}

function ScoringPlays({ espnData }) {
  const plays = espnData?.scoringPlays || []
  if (!plays.length) return <div className="no-data">No scoring plays available</div>
  return (
    <div className="scoring-plays">
      {plays.map((p, i) => (
        <div key={i} className="play-row">
          <span className="play-q">Q{p.period?.number}</span>
          <span className="play-clock">{p.clock?.displayValue}</span>
          <span className="play-team">{p.team?.abbreviation}</span>
          <span className="play-text">{p.text}</span>
          <span className="play-score">{p.awayScore}–{p.homeScore}</span>
        </div>
      ))}
    </div>
  )
}

function TeamStats({ espnData, game: g }) {
  const teams = espnData?.boxscore?.teams || []
  if (!teams.length) return <div className="no-data">Team stats not available</div>

  const getStats = (tm) => {
    const teamData = teams.find(t => t.team?.abbreviation === tm ||
      t.team?.abbreviation?.replace('LAR','LA').replace('WSH','WAS').replace('JAX','JAC') === tm)
    const stats = {}
    teamData?.statistics?.forEach(s => { stats[s.name] = s.displayValue })
    return stats
  }

  const awayStats = getStats(g.away)
  const homeStats = getStats(g.home)

  const rows = [
    ['Total Yards',       'totalYards',       true ],
    ['Passing Yards',     'netPassingYards',   true ],
    ['Rushing Yards',     'rushingYards',      true ],
    ['First Downs',       'firstDowns',        true ],
    ['Turnovers',         'turnovers',         false],
    ['Sacks',             'sacks',             true ],
    ['Penalty Yards',     'penaltyYards',      false],
    ['Time of Poss.',     'possessionTime',    null ],
  ]

  return (
    <div className="team-stats">
      <div className="ts-header">
        <span className="ts-team">{g.away}</span>
        <span className="ts-mid"></span>
        <span className="ts-team">{g.home}</span>
      </div>
      {rows.map(([label, key, moreIsBetter]) => {
        const av = awayStats[key] || '—'
        const hv = homeStats[key] || '—'
        return (
          <div key={key} className="ts-row">
            <span className="ts-val">{av}</span>
            <span className="ts-label">{label}</span>
            <span className="ts-val right">{hv}</span>
          </div>
        )
      })}
    </div>
  )
}

function PlayerStats({ espnData, cat }) {
  const teams = espnData?.boxscore?.players || []

  const allPlayers = []
  teams.forEach(teamData => {
    const tm = teamData.team?.abbreviation || ''
    const statGroup = teamData.statistics?.find(s => s.name === cat)
    if (!statGroup) return
    statGroup.athletes?.forEach(a => {
      const vals = {}
      statGroup.labels?.forEach((lbl, i) => { vals[lbl] = a.stats?.[i] || '0' })
      allPlayers.push({ name: a.athlete?.displayName || '—', team: tm, ...vals })
    })
  })

  if (!allPlayers.length) return <div className="no-data">No {cat} stats available</div>

  // Determine columns based on category
  const colMap = {
    passing:   ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'QBR'],
    rushing:   ['CAR',   'YDS', 'AVG', 'TD', 'LNG'],
    receiving: ['REC',   'YDS', 'AVG', 'TD', 'LNG', 'TGT'],
    defensive: ['TOT',   'SOLO','SACKS','TFL','PD',  'INT'],
  }
  const cols = colMap[cat] || Object.keys(allPlayers[0]).filter(k => k !== 'name' && k !== 'team')

  return (
    <table className="player-table">
      <thead>
        <tr>
          <th className="pt-name">Player</th>
          <th className="pt-team">TM</th>
          {cols.map(c => <th key={c}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {allPlayers.map((p, i) => (
          <tr key={i}>
            <td className="pt-name">{p.name}</td>
            <td className="pt-team">{p.team}</td>
            {cols.map(c => <td key={c}>{p[c] || '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LiveDrawer({ game: g, espnData, loading }) {
  return (
    <div className="live-drawer">
      <div className="live-header">
        <span className="live-dot large" />
        <span>Live · Q{g.period} {g.displayClock}</span>
      </div>
      {loading ? <div className="drawer-loading">Loading live data…</div>
               : <ScoringPlays espnData={espnData} />}
    </div>
  )
}

function GameInfoDrawer({ game: g }) {
  return (
    <div className="game-info-drawer">
      <div className="gi-row"><span>Date</span><span>{g.date} · {g.day}</span></div>
      <div className="gi-row"><span>Kickoff</span><span>{g.time} ET</span></div>
      <div className="gi-row"><span>Network</span><span>{g.network}</span></div>
      {g.venue && <div className="gi-row"><span>Venue</span><span>{g.venue}</span></div>}
      {g.intl  && <div className="gi-row"><span>Location</span><span>🌍 {g.intlCity}</span></div>}
      {g.odds  && <div className="gi-row"><span>Line</span><span>{g.odds}</span></div>}
      {g.note  && <div className="gi-note">{g.note}</div>}
    </div>
  )
}

// ── SCHEDULE VIEW ─────────────────────────────────────────────────────────────
function ScheduleView({ teamFilter, setTeamFilter, weekFilter, setWeekFilter }) {
  const weeksForTeam = teamFilter === 'All'
    ? ALL_WEEKS
    : ALL_WEEKS.filter(w =>
        SCHEDULE_2026.some(g => g.week === w && (g.home === teamFilter || g.away === teamFilter))
      )

  const filtered = SCHEDULE_2026.filter(g => {
    const teamOk = teamFilter === 'All' || g.home === teamFilter || g.away === teamFilter
    const weekOk = weekFilter === 'All' || g.week === weekFilter
    return teamOk && weekOk
  })

  // Group by week
  const byWeek = {}
  filtered.forEach(g => {
    const w = g.week
    if (!byWeek[w]) byWeek[w] = []
    byWeek[w].push(g)
  })
  const sortedWeeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b)

  // Team record if filtered
  let record = null
  if (teamFilter !== 'All') {
    const played = filtered.filter(g => g.status === 'final')
    const wins   = played.filter(g =>
      (g.home === teamFilter && g.homeScore > g.awayScore) ||
      (g.away === teamFilter && g.awayScore > g.homeScore)
    ).length
    record = { w: wins, l: played.length - wins, gp: played.length }
  }

  return (
    <div>
      <div className="section-bar">
        <h2>2026 Schedule</h2>
        <div className="sb-rule" />
        <span className="sb-ct">Sep 9 – Jan 10 · 18 Weeks</span>
      </div>

      {/* Filters */}
      <div className="sch-filters">
        <div className="filter-group">
          <span className="filter-label">Team</span>
          <div className="filter-pills">
            {['All', ...ALL_TEAMS].map(t => (
              <button
                key={t}
                className={`fpill ${teamFilter === t ? 'on' : ''}`}
                onClick={() => { setTeamFilter(t); setWeekFilter('All') }}
              >{t}</button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Week</span>
          <div className="filter-pills">
            <button className={`fpill ${weekFilter === 'All' ? 'on' : ''}`} onClick={() => setWeekFilter('All')}>All</button>
            {weeksForTeam.map(w => (
              <button
                key={w}
                className={`fpill ${weekFilter === w ? 'on' : ''}`}
                onClick={() => setWeekFilter(w)}
              >Wk {w}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Team summary */}
      {record && (
        <div className="team-summary-bar">
          <span className="ts-name">{teamFilter} · {ti(teamFilter).city} {ti(teamFilter).nick}</span>
          <span className="ts-rec">{record.w}–{record.l}</span>
          <button className="ts-clear" onClick={() => setTeamFilter('All')}>All teams ×</button>
        </div>
      )}

      {/* Games by week */}
      {sortedWeeks.map(w => {
        const meta = WEEK_META[w] || { label: `Week ${w}`, dates: '' }
        const wGames = byWeek[w]
        return (
          <div key={w} className="sch-week-block">
            <div className="sch-week-header">
              <span className="swh-title">{meta.label}{meta.note ? ` · ${meta.note}` : ''}</span>
              <span className="swh-dates">{meta.dates}</span>
            </div>
            <div className="sch-games-list">
              {wGames.map((g, i) => <ScheduleGame key={i} game={g} onTeamClick={setTeamFilter} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScheduleGame({ game: g, onTeamClick }) {
  const isFinal    = g.status === 'final'
  const isLive     = g.status === 'live'
  const homeWin    = isFinal && g.homeScore > g.awayScore
  const awayWin    = isFinal && g.awayScore > g.homeScore
  const netColor   = networkColor(g.network)

  return (
    <div className={`sch-game ${isFinal ? 'sg-final' : isLive ? 'sg-live' : ''}`}>
      <div className="sg-meta">
        <span className="sg-day">{g.day}</span>
        <span className={`sg-status ${isFinal ? 'final' : isLive ? 'live' : ''}`}>
          {isFinal ? 'Final' : isLive ? `Q${g.period} ${g.displayClock}` : g.date}
        </span>
        {g.intl && <span className="sg-intl">🌍</span>}
        {g.network && (
          <span className="sg-net" style={{ background: netColor.bg, color: netColor.text }}>
            {g.network.split('/')[0]}
          </span>
        )}
      </div>
      <div className="sg-teams">
        <div className={`sg-team ${awayWin ? 'win' : homeWin ? 'lose' : ''}`}
             onClick={() => onTeamClick(g.away)}>
          <span className="sg-abv">{g.away}</span>
          <span className="sg-city">{ti(g.away).city}</span>
          <span className="sg-ha">Away</span>
        </div>
        <div className="sg-vs">at</div>
        <div className={`sg-team ${homeWin ? 'win' : awayWin ? 'lose' : ''}`}
             onClick={() => onTeamClick(g.home)}>
          <span className="sg-abv">{g.home}</span>
          <span className="sg-city">{ti(g.home).city}</span>
          <span className="sg-ha">Home</span>
        </div>
      </div>
      {isFinal || isLive ? (
        <div className="sg-scores">
          <span className={awayWin ? 'sg-score-win' : ''}>{g.awayScore}</span>
          <span className="sg-dash">–</span>
          <span className={homeWin ? 'sg-score-win' : ''}>{g.homeScore}</span>
        </div>
      ) : (
        <div className="sg-time">{g.time}</div>
      )}
      {g.note && <div className="sg-note">{g.note}</div>}
    </div>
  )
}

// ── STANDINGS ─────────────────────────────────────────────────────────────────
// Placeholder — will be replaced with ESPN live standings data
function StandingsView() {
  const { data, loading } = (() => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    useEffect(() => {
      fetch('/api/espn/standings')
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    }, [])
    return { data, loading }
  })()

  const DIVISIONS = [
    ['AFC East', ['BUF','MIA','NE','NYJ']],
    ['AFC North',['BAL','CIN','CLE','PIT']],
    ['AFC South',['HOU','IND','JAC','TEN']],
    ['AFC West', ['DEN','KC','LAC','LV']],
    ['NFC East', ['DAL','NYG','PHI','WAS']],
    ['NFC North',['CHI','DET','GB','MIN']],
    ['NFC South',['ATL','CAR','NO','TB']],
    ['NFC West', ['ARI','LA','SEA','SF']],
  ]

  return (
    <div>
      <div className="section-bar">
        <h2>2026 Standings</h2>
        <div className="sb-rule" />
        <span className="sb-ct">{loading ? 'Loading…' : 'Regular Season'}</span>
      </div>
      <div className="standings-grid">
        {DIVISIONS.map(([divName, teams]) => (
          <div key={divName} className="div-block">
            <div className="div-name">{divName}</div>
            <table className="std-table">
              <thead>
                <tr>
                  <th className="std-team"></th>
                  <th>W</th><th>L</th><th>T</th><th>PCT</th><th>PF</th><th>PA</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((tm, i) => {
                  // Try to find from ESPN data, fallback to 0-0
                  const espnTeam = data?.children
                    ?.flatMap(c => c.standings?.entries || [])
                    ?.find(e => e.team?.abbreviation === tm ||
                      e.team?.abbreviation?.replace('LAR','LA').replace('WSH','WAS').replace('JAX','JAC') === tm)
                  const stats = espnTeam?.stats || []
                  const getStat = (n) => stats.find(s => s.name === n)?.value ?? 0
                  const w   = getStat('wins')
                  const l   = getStat('losses')
                  const t   = getStat('ties')
                  const pct = (w + l + t) > 0 ? fmt(w/(w+l+t), 3).replace('0.', '.') : '.000'
                  const pf  = getStat('pointsFor')
                  const pa  = getStat('pointsAgainst')
                  return (
                    <tr key={tm} className={i === 0 ? 'div-leader' : ''}>
                      <td className="std-team">
                        <span className="std-abv">{tm}</span>
                        <span className="std-nick">{ti(tm).nick}</span>
                      </td>
                      <td className="std-w">{w}</td>
                      <td>{l}</td>
                      <td>{t}</td>
                      <td>{pct}</td>
                      <td>{pf}</td>
                      <td>{pa}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="div-key">
              <span className="dk-div">■ Division leader</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── LEADERS ───────────────────────────────────────────────────────────────────
function LeadersView({ tab, setTab }) {
  return (
    <div>
      <div className="section-bar">
        <h2>2026 NFL Leaders</h2>
        <div className="sb-rule" />
        <span className="sb-ct">Season Stats</span>
      </div>
      <div className="leaders-tabs">
        {['Offense', 'Defense'].map(t => (
          <button
            key={t}
            className={`ltab ${tab === t.toLowerCase() ? 'on' : ''}`}
            onClick={() => setTab(t.toLowerCase())}
          >{t}</button>
        ))}
      </div>
      <div className="leaders-coming-soon">
        <div className="cs-icon">📊</div>
        <div className="cs-title">Season Stats Available Week 1</div>
        <div className="cs-text">
          Individual player leaderboards will populate automatically as the 2026 season kicks off September 9.
          Stats pull live from ESPN after each game.
        </div>
        <div className="cs-date">Kickoff: Sep 9, 2026 · SEA vs NE · 8:20 PM ET</div>
      </div>
    </div>
  )
}

// ── FANTASY VIEW ──────────────────────────────────────────────────────────────
function FantasyView({ mode, setMode }) {
  return (
    <div>
      <div className="section-bar">
        <h2>Fantasy Scoring</h2>
        <div className="sb-rule" />
        <span className="sb-ct">6pt TD · Standard / PPR</span>
      </div>
      <div className="fant-mode-bar">
        <span className="fmb-label">Scoring Mode</span>
        <div className="fmb-btns">
          <button className={`fmb-btn ${mode === 'std' ? 'on' : ''}`} onClick={() => setMode('std')}>Standard</button>
          <button className={`fmb-btn ${mode === 'ppr' ? 'on' : ''}`} onClick={() => setMode('ppr')}>PPR</button>
        </div>
        <span className="fmb-key">
          Pass 1pt/25yds · 6pt TD · −2 INT · Rush/Rec 1pt/10yds{mode === 'ppr' ? ' · +1pt REC' : ''} · No kickers
        </span>
      </div>
      <div className="leaders-coming-soon">
        <div className="cs-icon">⚡</div>
        <div className="cs-title">Fantasy Leaders Ready Week 1</div>
        <div className="cs-text">
          Fantasy point totals, per-player breakdowns, and Standard vs PPR toggle will populate
          after games are played. Box score tabs include fantasy projections per player.
        </div>
        <div className="cs-date">Season opens Sep 9 · SEA vs NE</div>
      </div>
    </div>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <span>The Final Whistle · NFL 2026</span>
      <span className="footer-bmac">
        Enjoying this? <a href="https://buymeacoffee.com/YOUR_BMAC_USERNAME" target="_blank" rel="noopener">Buy me a coffee</a>
      </span>
      <span>6pt TD · Standard / PPR</span>
    </footer>
  )
}
