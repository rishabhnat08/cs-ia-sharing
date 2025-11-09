import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'

const API_URL = 'http://127.0.0.1:8000'

const scoreBadgeClasses = {
  presence: 'score-badge--presence',
  skill: 'score-badge--skill',
  intent: 'score-badge--intent',
  psi: 'score-badge--psi'
}

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
}

const formatLevel = (value) => {
  if (!value) return 'Set level'
  const key = value.toLowerCase()
  return LEVEL_LABELS[key] ?? value
}

function ScoreBadge({ label, value, type }) {
  return (
    <div className={`score-badge ${scoreBadgeClasses[type] ?? ''}`}>
      {label}: <span className="font-semibold">{value ?? '—'}</span>
    </div>
  )
}

function VideoAnalysisCard({ analysis }) {
  const report = analysis.ai_report_json ? JSON.parse(analysis.ai_report_json) : null

  return (
    <div className="report-surface report-card space-y-6 rounded-card p-6 border-l-4 border-purple-500">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-block px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs font-semibold">VIDEO ANALYSIS</span>
          <span className="font-semibold text-text">Session {analysis.session_id}</span>
          {analysis.date && <span>· {new Date(analysis.date).toLocaleDateString()}</span>}
          <span>· {analysis.event_type.replace('_', ' ')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis.presence_score !== null && (
            <ScoreBadge label="Presence" value={analysis.presence_score} type="presence" />
          )}
          {analysis.skill_score !== null && (
            <ScoreBadge label="Skill" value={analysis.skill_score} type="skill" />
          )}
          {analysis.intent_score !== null && (
            <ScoreBadge label="Intent" value={analysis.intent_score} type="intent" />
          )}
          {analysis.psi_score !== null && (
            <ScoreBadge
              label="PSI"
              value={typeof analysis.psi_score === 'number' ? analysis.psi_score.toFixed(1) : analysis.psi_score}
              type="psi"
            />
          )}
        </div>
      </header>

      {!report ? (
        <div className="text-sm text-muted">
          <p>Video analysis is processing. This is a placeholder - full AI analysis coming soon.</p>
        </div>
      ) : (
        <section className="space-y-6 text-sm leading-relaxed text-muted">
          {/* AI Summary - Same format as coach assessment */}
          <div>
            <h4 className="mb-1 text-sm font-semibold text-text">Player evaluation</h4>
            <p>{report.player_evaluation || 'Analysis in progress'}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <List title="Player strengths" items={report.player_strengths || []} />
            <List title="Player weaknesses" items={report.player_weaknesses || []} />
          </div>

          {/* Technical Analysis */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-base font-semibold text-text mb-3">Technical Analysis</h3>

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-accent mb-2">Shot Accuracy & Selection</h4>
                <div className="grid gap-2 text-xs">
                  {report.technical_analysis?.smash_success_rate && (
                    <p>• Smash success rate: {report.technical_analysis.smash_success_rate}</p>
                  )}
                  {report.technical_analysis?.drop_shot_precision && (
                    <p>• Drop shot precision: {report.technical_analysis.drop_shot_precision}</p>
                  )}
                  {report.technical_analysis?.clear_depth_consistency && (
                    <p>• Clear depth & consistency: {report.technical_analysis.clear_depth_consistency}</p>
                  )}
                  {report.technical_analysis?.net_play_effectiveness && (
                    <p>• Net play effectiveness: {report.technical_analysis.net_play_effectiveness}</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-accent mb-2">Error Breakdown</h4>
                <div className="grid gap-2 text-xs">
                  {report.technical_analysis?.unforced_errors && (
                    <p>• Unforced errors: {report.technical_analysis.unforced_errors}</p>
                  )}
                  {report.technical_analysis?.forced_errors && (
                    <p>• Forced errors (under pressure): {report.technical_analysis.forced_errors}</p>
                  )}
                  {report.technical_analysis?.service_faults && (
                    <p>• Service faults: {report.technical_analysis.service_faults}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Movement & Footwork */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-base font-semibold text-text mb-3">Movement & Footwork</h3>
            <div className="grid gap-2 text-xs">
              {report.movement_footwork?.court_coverage && (
                <p>• <span className="font-semibold">Court Coverage:</span> {report.movement_footwork.court_coverage}</p>
              )}
              {report.movement_footwork?.recovery_speed && (
                <p>• <span className="font-semibold">Recovery Speed:</span> {report.movement_footwork.recovery_speed}</p>
              )}
              {report.movement_footwork?.balance_stance && (
                <p>• <span className="font-semibold">Balance & Stance:</span> {report.movement_footwork.balance_stance}</p>
              )}
              {report.movement_footwork?.fatigue_analysis && (
                <p>• <span className="font-semibold">Fatigue Analysis:</span> {report.movement_footwork.fatigue_analysis}</p>
              )}
            </div>
          </div>

          {/* Tactical Insights */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-base font-semibold text-text mb-3">Tactical Insights</h3>
            <div className="grid gap-2 text-xs">
              {report.tactical_insights?.rally_patterns && (
                <p>• <span className="font-semibold">Rally Patterns:</span> {report.tactical_insights.rally_patterns}</p>
              )}
              {report.tactical_insights?.shot_distribution && (
                <p>• <span className="font-semibold">Shot Distribution:</span> {report.tactical_insights.shot_distribution}</p>
              )}
              {report.tactical_insights?.predictability && (
                <p>• <span className="font-semibold">Predictability:</span> {report.tactical_insights.predictability}</p>
              )}
              {report.tactical_insights?.opponent_exploits && (
                <p>• <span className="font-semibold">Opponent Exploits:</span> {report.tactical_insights.opponent_exploits}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <List title="Actions on strengths" items={report.actions_strengths || []} />
            <List title="Actions on weaknesses" items={report.actions_weaknesses || []} />
          </div>

          <div>
            <h4 className="mb-1 text-sm font-semibold text-text">Course forward</h4>
            <p>{report.course_forward || 'Recommendations being generated'}</p>
          </div>

          <footer className="space-y-2">
            <h4 className="text-sm font-semibold text-text">Summary bullets</h4>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
              {(report.summary_bullets || []).map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          </footer>
        </section>
      )}
    </div>
  )
}

function ReportCard({ report }) {
  const payload = report.psi_report
  if (!payload) {
    return (
      <div className="report-surface space-y-3 rounded-card p-5 text-sm text-muted">
        <p>Structured report unavailable for this session. Try regenerating from the dashboard.</p>
      </div>
    )
  }

  const { scores, summary_bullets } = payload

  return (
    <div id={`report-${report.id}`} className="report-surface report-card space-y-6 rounded-card p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-text">Session {report.session_id}</span>
          {report.date && <span>· {new Date(report.date).toLocaleDateString()}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ScoreBadge label="Presence" value={scores?.presence} type="presence" />
          <ScoreBadge label="Skill" value={scores?.skill} type="skill" />
          <ScoreBadge label="Intent" value={scores?.intent} type="intent" />
          <ScoreBadge
            label="PSI"
            value={typeof scores?.psi === 'number' ? scores.psi.toFixed(1) : scores?.psi}
            type="psi"
          />
        </div>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-muted">
        <div>
          <h4 className="mb-1 text-sm font-semibold text-text">Player evaluation</h4>
          <p>{payload.player_evaluation}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Player strengths" items={payload.player_strengths} />
          <List title="Player weaknesses" items={payload.player_weaknesses} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <List title="Actions on strengths" items={payload.actions_strengths} />
          <List title="Actions on weaknesses" items={payload.actions_weaknesses} />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-semibold text-text">Course forward</h4>
          <p>{payload.course_forward}</p>
        </div>
      </section>

      <footer className="space-y-2">
        <h4 className="text-sm font-semibold text-text">Summary bullets</h4>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
          {(summary_bullets ?? []).map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
          ))}
        </ul>
      </footer>
    </div>
  )
}

function List({ title, items }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-text">{title}</h4>
      <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
        {(items && items.length ? items : ['No data provided']).map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StudentReports() {
  const location = useLocation()
  const [players, setPlayers] = useState([])
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('coach-assessment') // 'coach-assessment' or 'team-performance'
  const [teamPerformances, setTeamPerformances] = useState([])
  const [loadingTeamPerformances, setLoadingTeamPerformances] = useState(false)
  const [videoAnalyses, setVideoAnalyses] = useState([]) // Video analyses for selected player

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const coachUsername = localStorage.getItem('coach')
        if (!coachUsername) {
          setError('Not logged in')
          return
        }

        const response = await fetch(`${API_URL}/players?coach_username=${coachUsername}`)
        if (!response.ok) {
          throw new Error('Unable to load players')
        }
        const data = await response.json()
        setPlayers(data)
      } catch (err) {
        setError(err.message || 'Failed to fetch players')
      }
    }
    loadPlayers()
  }, [])

  useEffect(() => {
    // Check if there's a player ID from navigation state
    const statePlayerId = location.state?.selectedPlayerId
    if (statePlayerId) {
      setSelectedPlayerId(statePlayerId)
    } else if (players.length && selectedPlayerId === null) {
      setSelectedPlayerId(players[0].id)
    }
  }, [players, selectedPlayerId, location.state])

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  )

  useEffect(() => {
    const loadReports = async () => {
      if (!selectedPlayerId) {
        setReports([])
        setVideoAnalyses([])
        return
      }
      setLoading(true)
      setError('')
      try {
        // Load text-based evaluations
        const response = await fetch(`${API_URL}/player/${selectedPlayerId}/history`)
        if (!response.ok) {
          throw new Error('Unable to load reports')
        }
        const data = await response.json()
        setReports(data)

        // Load video analyses for this player
        const videoResponse = await fetch(`${API_URL}/player/${selectedPlayerId}/video-analyses`)
        if (videoResponse.ok) {
          const videoData = await videoResponse.json()
          setVideoAnalyses(videoData)
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch reports')
        setReports([])
        setVideoAnalyses([])
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [selectedPlayerId])

  // Scroll to specific evaluation if navigated from Dashboard
  useEffect(() => {
    const selectedEvaluationId = location.state?.selectedEvaluationId
    if (selectedEvaluationId && reports.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`report-${selectedEvaluationId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('highlight-flash')
          setTimeout(() => element.classList.remove('highlight-flash'), 2000)
        }
      }, 300)
    }
  }, [reports, location.state])

  // Load team performances
  useEffect(() => {
    const loadTeamPerformances = async () => {
      if (activeTab !== 'team-performance') return

      setLoadingTeamPerformances(true)
      setError('')
      try {
        const coachUsername = localStorage.getItem('coach')
        if (!coachUsername) {
          setError('Not logged in')
          return
        }

        const response = await fetch(`${API_URL}/team-performances?coach_username=${coachUsername}`)
        if (!response.ok) {
          throw new Error('Unable to load team performances')
        }
        const data = await response.json()
        setTeamPerformances(data)
      } catch (err) {
        setError(err.message || 'Failed to fetch team performances')
        setTeamPerformances([])
      } finally {
        setLoadingTeamPerformances(false)
      }
    }

    loadTeamPerformances()
  }, [activeTab])

  return (
    <AppShell showProtectedNav>
      <div className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">Student reports</h1>
          <p className="max-w-2xl text-sm text-muted">
            Review Gemini-generated PSI insights for each athlete. Select a student to view
            their structured reports with scores, strengths, weaknesses, and next steps.
          </p>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10 pt-4">
            <button
              onClick={() => setActiveTab('coach-assessment')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'coach-assessment'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              Coach Assessment
            </button>
            <button
              onClick={() => setActiveTab('team-performance')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'team-performance'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              Team Performance
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Coach Assessment Tab */}
        {activeTab === 'coach-assessment' && (
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Students</h2>
              <div className="flex max-h-[480px] flex-col gap-2 overflow-y-auto rounded-card border border-white/5 bg-surface/60 p-2">
                {players.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted">No students available yet.</p>
                )}
                {players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`student-card ${
                      selectedPlayerId === player.id ? 'student-card--active' : 'student-card--inactive'
                    }`}
                  >
                    <p className="student-card__name">{player.name}</p>
                    <p className="student-card__level">Level: {formatLevel(player.level)} · {player.gender}</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold">
                  {selectedPlayer ? selectedPlayer.name : 'Select a student'}
                </h2>
                {selectedPlayer && (
                  <p className="text-sm text-muted">
                    Viewing structured reports generated from submitted session notes.
                  </p>
                )}
              </div>

              {loading ? (
                <div className="report-surface rounded-card p-6 text-sm text-muted">
                  Loading reports...
                </div>
              ) : reports.length === 0 && videoAnalyses.length === 0 ? (
                <div className="report-surface rounded-card p-6 text-sm text-muted">
                  {selectedPlayer
                    ? 'No reports generated for this student yet. Submit a dashboard evaluation or video analysis to create one.'
                    : 'Select a student to view their reports.'}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Show video analyses */}
                  {videoAnalyses.map((analysis) => (
                    <VideoAnalysisCard key={`video-${analysis.id}`} analysis={analysis} />
                  ))}
                  {/* Show text-based reports */}
                  {reports.map((report) => (
                    <ReportCard key={`report-${report.id}`} report={report} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Team Performance Tab */}
        {activeTab === 'team-performance' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Doubles Team Analysis</h2>
              <p className="text-sm text-muted">
                Video analysis reports for doubles partnerships, including individual performance and team synergy.
              </p>
            </div>

            {loadingTeamPerformances ? (
              <div className="report-surface rounded-card p-6 text-sm text-muted">
                Loading team performances...
              </div>
            ) : teamPerformances.length === 0 ? (
              <div className="report-surface rounded-card p-6 text-sm text-muted">
                No team performance analyses yet. Upload a doubles video from the dashboard to create one.
              </div>
            ) : (
              <div className="space-y-6">
                {teamPerformances.map((analysis) => {
                  const player1 = players.find(p => p.id === analysis.player_id)
                  const player2 = players.find(p => p.id === analysis.partner_id)

                  return (
                    <div key={analysis.id} className="report-surface report-card space-y-6 rounded-card p-6">
                      <header className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-semibold text-text">
                            {player1?.name || 'Player 1'} & {player2?.name || 'Player 2'}
                          </span>
                          <span>· Session {analysis.session_id}</span>
                          {analysis.date && <span>· {new Date(analysis.date).toLocaleDateString()}</span>}
                          <span>· {analysis.event_type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {analysis.presence_score !== null && (
                            <ScoreBadge label="Presence" value={analysis.presence_score} type="presence" />
                          )}
                          {analysis.skill_score !== null && (
                            <ScoreBadge label="Skill" value={analysis.skill_score} type="skill" />
                          )}
                          {analysis.intent_score !== null && (
                            <ScoreBadge label="Intent" value={analysis.intent_score} type="intent" />
                          )}
                          {analysis.psi_score !== null && (
                            <ScoreBadge
                              label="PSI"
                              value={typeof analysis.psi_score === 'number' ? analysis.psi_score.toFixed(1) : analysis.psi_score}
                              type="psi"
                            />
                          )}
                          {analysis.synergy_score !== null && (
                            <div className="score-badge" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}>
                              Team Synergy: <span className="font-semibold">{analysis.synergy_score}/10</span>
                            </div>
                          )}
                        </div>
                      </header>

                      <section className="space-y-6 text-sm leading-relaxed text-muted">
                        {analysis.ai_report_json ? (() => {
                          const report = JSON.parse(analysis.ai_report_json)
                          return (
                            <>
                              {/* Team Performance Section */}
                              {report.team_performance && (
                                <div className="border-t border-white/10 pt-4">
                                  <h3 className="text-base font-semibold text-accent mb-3">Team Performance</h3>
                                  <div className="grid gap-2 text-xs">
                                    {report.team_performance.coordination_rotation && (
                                      <p>• <span className="font-semibold">Coordination & Rotation:</span> {report.team_performance.coordination_rotation}</p>
                                    )}
                                    {report.team_performance.court_coverage_split && (
                                      <p>• <span className="font-semibold">Court Coverage Split:</span> {report.team_performance.court_coverage_split}</p>
                                    )}
                                    {report.team_performance.communication_indicators && (
                                      <p>• <span className="font-semibold">Communication:</span> {report.team_performance.communication_indicators}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Player 1 Analysis */}
                              <div className="border-t border-white/10 pt-4">
                                <h3 className="text-base font-semibold text-text mb-3">{player1?.name || 'Player 1'} - Individual Analysis</h3>

                                <div className="space-y-3">
                                  <div>
                                    <h4 className="mb-1 text-sm font-semibold text-text">Player evaluation</h4>
                                    <p>{report.player_evaluation || 'Analysis in progress'}</p>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <List title="Strengths" items={report.player_strengths || []} />
                                    <List title="Weaknesses" items={report.player_weaknesses || []} />
                                  </div>

                                  {/* Technical Analysis */}
                                  {report.technical_analysis && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-accent mb-2">Technical Analysis</h4>
                                      <div className="grid gap-1 text-xs">
                                        {report.technical_analysis.smash_success_rate && (
                                          <p>• Smash: {report.technical_analysis.smash_success_rate}</p>
                                        )}
                                        {report.technical_analysis.drop_shot_precision && (
                                          <p>• Drop shot: {report.technical_analysis.drop_shot_precision}</p>
                                        )}
                                        {report.technical_analysis.net_play_effectiveness && (
                                          <p>• Net play: {report.technical_analysis.net_play_effectiveness}</p>
                                        )}
                                        {report.technical_analysis.unforced_errors && (
                                          <p>• Errors: {report.technical_analysis.unforced_errors}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Player 2 Analysis */}
                              {report.partner_evaluation && (
                                <div className="border-t border-white/10 pt-4">
                                  <h3 className="text-base font-semibold text-text mb-3">{player2?.name || 'Player 2'} - Individual Analysis</h3>

                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="mb-1 text-sm font-semibold text-text">Player evaluation</h4>
                                      <p>{report.partner_evaluation}</p>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <List title="Strengths" items={report.partner_strengths || []} />
                                      <List title="Weaknesses" items={report.partner_weaknesses || []} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        })() : (
                          <div>
                            <p className="text-muted">
                              Video analysis is being processed. Check back later for detailed insights.
                            </p>
                          </div>
                        )}
                      </section>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

export default StudentReports
