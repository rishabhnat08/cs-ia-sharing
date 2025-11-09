import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import AppShell from '../components/AppShell'

const API_URL = 'http://127.0.0.1:8000'
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced']

const inputBaseClasses =
  'w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
const shortTextareaClasses = `${inputBaseClasses} h-24 resize-none overflow-y-auto`
const longTextareaClasses = `${inputBaseClasses} h-36 resize-none overflow-y-auto`

function Dashboard() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentLevel, setNewStudentLevel] = useState('')
  const [newStudentGender, setNewStudentGender] = useState('')
  const [isAddingStudent, setIsAddingStudent] = useState(false)
  const [addStudentFeedback, setAddStudentFeedback] = useState({ type: '', message: '' })
  const [reportForm, setReportForm] = useState({
    studentName: '',
    session_id: '',
    date: '',
    front_court: '',
    back_court: '',
    attack: '',
    defense: '',
    strokeplay: '',
    footwork: '',
    presence: '',
    intent: '',
    improvements: '',
    strengths: '',
    comments: ''
  })
  const [checkResult, setCheckResult] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [historyName, setHistoryName] = useState('')
  const [history, setHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [profilePicture, setProfilePicture] = useState('')
  const [lastSubmittedReport, setLastSubmittedReport] = useState(null)

  // Video Analysis State
  const [videoForm, setVideoForm] = useState({
    sessionId: '',
    gameFormat: '',
    eventType: '',
    eventTypeDescription: '',
    playerId: '',
    playerAppearance: '',
    partnerId: '',
    partnerAppearance: '',
    videoFile: null
  })
  const [videoMessage, setVideoMessage] = useState('')
  const [isSubmittingVideo, setIsSubmittingVideo] = useState(false)

  const loadPlayers = useCallback(async () => {
    const coachUsername = localStorage.getItem('coach')
    if (!coachUsername) return

    const res = await fetch(`${API_URL}/players?coach_username=${coachUsername}`)
    const data = await res.json()
    setPlayers(data)
  }, [])

  const loadCoachProfile = useCallback(async () => {
    const coachUsername = localStorage.getItem('coach')
    if (!coachUsername) return

    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}`)
      if (res.ok) {
        const data = await res.json()
        setProfilePicture(data.profile_picture || '')
      }
    } catch (error) {
      console.error('Failed to load coach profile:', error)
    }
  }, [])

  useEffect(() => {
    loadPlayers()
    loadCoachProfile()
  }, [loadPlayers, loadCoachProfile])

  const handleAddStudent = async (e) => {
    e.preventDefault()
    const name = newStudentName.trim()
    if (!name) {
      setAddStudentFeedback({ type: 'error', message: 'Enter a student name.' })
      return
    }
    if (!newStudentLevel) {
      setAddStudentFeedback({ type: 'error', message: 'Select a student level.' })
      return
    }
    if (!newStudentGender) {
      setAddStudentFeedback({ type: 'error', message: 'Select a student gender.' })
      return
    }
    setIsAddingStudent(true)
    setAddStudentFeedback({ type: '', message: '' })
    try {
      const res = await fetch(`${API_URL}/create-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age: null, level: newStudentLevel, gender: newStudentGender, coach_username: coachUsername })
      })
      const data = await res.json()
      if (!res.ok) {
        setAddStudentFeedback({ type: 'error', message: data.detail || 'Unable to add student.' })
      } else {
        setAddStudentFeedback({ type: 'success', message: 'Student added successfully.' })
        setNewStudentName('')
        setNewStudentLevel('')
        setNewStudentGender('')
        await loadPlayers()
      }
    } catch (error) {
      setAddStudentFeedback({ type: 'error', message: error.message || 'Unable to add student.' })
    } finally {
      setIsAddingStudent(false)
    }
  }

  const handleReportChange = (e) => {
    setReportForm({ ...reportForm, [e.target.name]: e.target.value })
  }

  const checkStudent = () => {
    const exists = players.find(
      (p) => p.name.toLowerCase() === reportForm.studentName.trim().toLowerCase()
    )
    setCheckResult(exists ? 'Student found.' : 'Student not found.')
  }

  const handleVideoFormChange = (e) => {
    const { name, value } = e.target
    setVideoForm({ ...videoForm, [name]: value })

    // Reset partner fields if switching to singles
    if (name === 'gameFormat' && value === 'singles') {
      setVideoForm(prev => ({ ...prev, partnerId: '', partnerAppearance: '' }))
    }

    // Reset event description if not 'other'
    if (name === 'eventType' && value !== 'other') {
      setVideoForm(prev => ({ ...prev, eventTypeDescription: '' }))
    }
  }

  const handleVideoFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file type (videos only)
      if (!file.type.startsWith('video/')) {
        setVideoMessage('Please select a video file')
        return
      }
      // Check file size (max 100MB for videos)
      if (file.size > 100 * 1024 * 1024) {
        setVideoMessage('Video file must be less than 100MB')
        return
      }
      setVideoForm({ ...videoForm, videoFile: file })
      setVideoMessage('')
    }
  }

  const submitVideoAnalysis = async (e) => {
    e.preventDefault()
    setIsSubmittingVideo(true)
    setVideoMessage('')

    const coachUsername = localStorage.getItem('coach')
    if (!coachUsername) {
      setVideoMessage('Not logged in')
      setIsSubmittingVideo(false)
      return
    }

    try {
      // For now, we'll store video as base64 in video_path
      // In production, this would upload to a storage service
      let videoPath = ''
      if (videoForm.videoFile) {
        const reader = new FileReader()
        videoPath = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(videoForm.videoFile)
        })
      }

      const payload = {
        coach_username: coachUsername,
        session_id: videoForm.sessionId,
        game_format: videoForm.gameFormat,
        event_type: videoForm.eventType,
        event_type_description: videoForm.eventType === 'other' ? videoForm.eventTypeDescription : null,
        player_id: parseInt(videoForm.playerId),
        player_appearance: videoForm.playerAppearance,
        partner_id: videoForm.gameFormat === 'doubles' ? parseInt(videoForm.partnerId) : null,
        partner_appearance: videoForm.gameFormat === 'doubles' ? videoForm.partnerAppearance : null,
        video_path: videoPath
      }

      const res = await fetch(`${API_URL}/video-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        setVideoMessage(data.detail || 'Failed to submit video analysis')
      } else {
        setVideoMessage('Video analysis submitted successfully')
        // Reset form
        setVideoForm({
          sessionId: '',
          gameFormat: '',
          eventType: '',
          eventTypeDescription: '',
          playerId: '',
          playerAppearance: '',
          partnerId: '',
          partnerAppearance: '',
          videoFile: null
        })
        // Reset file input
        const fileInput = document.getElementById('videoFile')
        if (fileInput) fileInput.value = ''
      }
    } catch (error) {
      setVideoMessage(error.message || 'Failed to submit video analysis')
    } finally {
      setIsSubmittingVideo(false)
    }
  }

  const submitReport = async (e) => {
    e.preventDefault()

    // Prevent multiple submissions
    if (isSubmittingReport) return

    setMessage('')
    setIsSubmittingReport(true)

    const player = players.find(
      (p) => p.name.toLowerCase() === reportForm.studentName.trim().toLowerCase()
    )
    if (!player) {
      setCheckResult('Student not found.')
      setIsSubmittingReport(false)
      return
    }
    const { studentName: _studentName, attack, defense, ...rest } = reportForm
    const payload = {
      player_id: player.id,
      session_id: rest.session_id,
      date: rest.date || new Date().toISOString(),
      front_court: rest.front_court,
      back_court: rest.back_court,
      attacking_play: attack,
      defensive_play: defense,
      strokeplay: rest.strokeplay,
      footwork: rest.footwork,
      presence: rest.presence,
      intent: rest.intent,
      improvements: rest.improvements,
      strengths: rest.strengths,
      comments: rest.comments
    }
    try {
      const res = await fetch(`${API_URL}/submit-evaluation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('Report submitted.')
        // Save the last submitted report info for View Report button
        setLastSubmittedReport({
          studentName: reportForm.studentName,
          playerId: player.id,
          evaluationId: data.evaluation_id
        })
        setReportForm({
          studentName: '',
          session_id: '',
          date: '',
          front_court: '',
          back_court: '',
          attack: '',
          defense: '',
          strokeplay: '',
          footwork: '',
          presence: '',
          intent: '',
          improvements: '',
          strengths: '',
          comments: ''
        })
      } else {
        setMessage(data.detail || 'Error submitting report.')
      }
    } catch {
      setMessage('Server error.')
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const fetchHistory = async () => {
    setHistory([])
    setIsLoadingHistory(true)

    const player = players.find(
      (p) => p.name.toLowerCase() === historyName.trim().toLowerCase()
    )
    if (!player) {
      setHistory([{ id: 0, ai_feedback: 'Student not found.' }])
      setIsLoadingHistory(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/player/${player.id}/history`)
      const data = await res.json()
      setHistory(data)
    } catch {
      setHistory([{ id: 0, ai_feedback: 'Error loading history.' }])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const coachUsername = localStorage.getItem('coach') || 'Coach'

  return (
    <AppShell showProtectedNav>
      <div className="space-y-10">
        <div className="flex items-center gap-4">
          {profilePicture && (
            <img
              src={profilePicture}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover border-2 border-accent"
            />
          )}
          <div>
            <h1 className="text-3xl font-semibold mb-2">Welcome {coachUsername}</h1>
            <p className="text-sm text-muted">Manage your athletes and track their performance.</p>
          </div>
        </div>
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Add student</h2>
            <p className="text-sm text-muted">Create a roster entry so you can log reports and history.</p>
          </div>
          <form onSubmit={handleAddStudent} className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <label htmlFor="newStudentName" className="text-sm font-medium text-muted">
                Student name
              </label>
              <input
                id="newStudentName"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Enter student name"
                className={inputBaseClasses}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newStudentLevel" className="text-sm font-medium text-muted">
                Level
              </label>
              <div className="relative">
                <select
                  id="newStudentLevel"
                  value={newStudentLevel}
                  onChange={(e) => setNewStudentLevel(e.target.value)}
                  className={`${inputBaseClasses} appearance-none pr-10 ${newStudentLevel ? '' : 'text-muted'}`}
                  required
                >
                  <option value="" disabled>
                    Select level
                  </option>
                  {LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="newStudentGender" className="text-sm font-medium text-muted">
                Gender
              </label>
              <div className="relative">
                <select
                  id="newStudentGender"
                  value={newStudentGender}
                  onChange={(e) => setNewStudentGender(e.target.value)}
                  className={`${inputBaseClasses} appearance-none pr-10 ${newStudentGender ? '' : 'text-muted'}`}
                  required
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isAddingStudent}
              className="w-full rounded-hero bg-accent px-6 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              {isAddingStudent ? 'Adding…' : 'Add student'}
            </button>
          </form>
          {addStudentFeedback.message && (
            <p
              className={`text-sm ${
                addStudentFeedback.type === 'success' ? 'text-accent' : 'text-red-400'
              }`}
              role="status"
            >
              {addStudentFeedback.message}
            </p>
          )}
        </section>

        {/* Video Analysis Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Video Analysis</h2>
            <p className="text-sm text-muted">Upload gameplay videos for AI-powered technical and tactical analysis.</p>
          </div>
          <form onSubmit={submitVideoAnalysis} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="videoSessionId" className="text-sm font-medium text-muted">
                  Session ID
                </label>
                <input
                  id="videoSessionId"
                  name="sessionId"
                  value={videoForm.sessionId}
                  onChange={handleVideoFormChange}
                  placeholder="Enter session ID"
                  required
                  className={inputBaseClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="gameFormat" className="text-sm font-medium text-muted">
                  Game Format
                </label>
                <div className="relative">
                  <select
                    id="gameFormat"
                    name="gameFormat"
                    value={videoForm.gameFormat}
                    onChange={handleVideoFormChange}
                    className={`${inputBaseClasses} appearance-none pr-10 ${videoForm.gameFormat ? '' : 'text-muted'}`}
                    required
                  >
                    <option value="" disabled>Select format</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="eventType" className="text-sm font-medium text-muted">
                  Event Type
                </label>
                <div className="relative">
                  <select
                    id="eventType"
                    name="eventType"
                    value={videoForm.eventType}
                    onChange={handleVideoFormChange}
                    className={`${inputBaseClasses} appearance-none pr-10 ${videoForm.eventType ? '' : 'text-muted'}`}
                    required
                  >
                    <option value="" disabled>Select event type</option>
                    <option value="tournament">Tournament</option>
                    <option value="practice_match">Practice Match</option>
                    <option value="drills">Drills</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                  />
                </div>
              </div>
              {videoForm.eventType === 'other' && (
                <div className="space-y-2">
                  <label htmlFor="eventTypeDescription" className="text-sm font-medium text-muted">
                    Event Description
                  </label>
                  <input
                    id="eventTypeDescription"
                    name="eventTypeDescription"
                    value={videoForm.eventTypeDescription}
                    onChange={handleVideoFormChange}
                    placeholder="Describe the session type"
                    required
                    className={inputBaseClasses}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="videoPlayerId" className="text-sm font-medium text-muted">
                  Student {videoForm.gameFormat === 'doubles' ? '1' : ''}
                </label>
                <div className="relative">
                  <select
                    id="videoPlayerId"
                    name="playerId"
                    value={videoForm.playerId}
                    onChange={handleVideoFormChange}
                    className={`${inputBaseClasses} appearance-none pr-10 ${videoForm.playerId ? '' : 'text-muted'}`}
                    required
                  >
                    <option value="" disabled>Select student</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="playerAppearance" className="text-sm font-medium text-muted">
                  {videoForm.gameFormat === 'doubles' ? 'Student 1 ' : 'Student '}Appearance
                </label>
                <input
                  id="playerAppearance"
                  name="playerAppearance"
                  value={videoForm.playerAppearance}
                  onChange={handleVideoFormChange}
                  placeholder="One sentence description (e.g., wearing blue jersey)"
                  required
                  className={inputBaseClasses}
                />
              </div>
            </div>

            {videoForm.gameFormat === 'doubles' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="videoPartnerId" className="text-sm font-medium text-muted">
                    Student 2
                  </label>
                  <div className="relative">
                    <select
                      id="videoPartnerId"
                      name="partnerId"
                      value={videoForm.partnerId}
                      onChange={handleVideoFormChange}
                      className={`${inputBaseClasses} appearance-none pr-10 ${videoForm.partnerId ? '' : 'text-muted'}`}
                      required
                    >
                      <option value="" disabled>Select partner</option>
                      {players.filter(p => p.id !== parseInt(videoForm.playerId)).map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="partnerAppearance" className="text-sm font-medium text-muted">
                    Student 2 Appearance
                  </label>
                  <input
                    id="partnerAppearance"
                    name="partnerAppearance"
                    value={videoForm.partnerAppearance}
                    onChange={handleVideoFormChange}
                    placeholder="One sentence description (e.g., wearing red jersey)"
                    required
                    className={inputBaseClasses}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="videoFile" className="text-sm font-medium text-muted">
                Upload Video (Max 100MB)
              </label>
              <input
                id="videoFile"
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                required
                className={`${inputBaseClasses} file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-accent file:text-bg hover:file:bg-accent/90`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingVideo}
              className="w-full rounded-hero bg-accent px-6 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
            >
              {isSubmittingVideo ? 'Analyzing...' : 'Submit for Analysis'}
            </button>

            {videoMessage && (
              <p
                className={`text-sm ${
                  videoMessage.includes('success') ? 'text-accent' : 'text-red-400'
                }`}
                role="status"
              >
                {videoMessage}
              </p>
            )}
          </form>
        </section>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="space-y-6 rounded-card bg-surface p-8 shadow">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Coach Assessment</h2>
            <p className="text-sm text-muted">
              Log performance insights and session details for each athlete.
            </p>
          </div>
          <form onSubmit={submitReport} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="studentName" className="text-sm font-medium text-muted">
                Student name
              </label>
              <input
                id="studentName"
                name="studentName"
                value={reportForm.studentName}
                onChange={handleReportChange}
                onBlur={checkStudent}
                placeholder="Enter existing student name"
                required
                className={inputBaseClasses}
              />
              {checkResult && (
                <p
                  id="student-check-result"
                  className={`text-sm ${checkResult.toLowerCase().includes('not') ? 'text-red-400' : 'text-accent'}`}
                >
                  {checkResult}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="session_id" className="text-sm font-medium text-muted">
                  Session ID
                </label>
                <input
                  id="session_id"
                  name="session_id"
                  value={reportForm.session_id}
                  onChange={handleReportChange}
                  placeholder="Enter session ID"
                  required
                  className={inputBaseClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium text-muted">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  name="date"
                  value={reportForm.date}
                  onChange={handleReportChange}
                  className={inputBaseClasses}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="front_court" className="text-sm font-medium text-muted">
                  Front court
                </label>
                <textarea
                  id="front_court"
                  name="front_court"
                  value={reportForm.front_court}
                  onChange={handleReportChange}
                  placeholder="How has the student performed in the front court?"
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="back_court" className="text-sm font-medium text-muted">
                  Back court
                </label>
                <textarea
                  id="back_court"
                  name="back_court"
                  value={reportForm.back_court}
                  onChange={handleReportChange}
                  placeholder="How has the student performed in the back court?"
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="attack" className="text-sm font-medium text-muted">
                  Attacking play
                </label>
                <textarea
                  id="attack"
                  name="attack"
                  value={reportForm.attack}
                  onChange={handleReportChange}
                  placeholder="Comment on the student's attacking play."
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="defense" className="text-sm font-medium text-muted">
                  Defensive play
                </label>
                <textarea
                  id="defense"
                  name="defense"
                  value={reportForm.defense}
                  onChange={handleReportChange}
                  placeholder="Comment on the student's defensive play."
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="strokeplay" className="text-sm font-medium text-muted">
                  Strokeplay
                </label>
                <textarea
                  id="strokeplay"
                  name="strokeplay"
                  value={reportForm.strokeplay}
                  onChange={handleReportChange}
                  placeholder="Comment on the student's strokeplay."
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="footwork" className="text-sm font-medium text-muted">
                  Footwork &amp; movement
                </label>
                <textarea
                  id="footwork"
                  name="footwork"
                  value={reportForm.footwork}
                  onChange={handleReportChange}
                  placeholder="Comment on the student's footwork and movement."
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="presence" className="text-sm font-medium text-muted">
                  Presence on court
                </label>
                <textarea
                  id="presence"
                  name="presence"
                  value={reportForm.presence}
                  onChange={handleReportChange}
                  placeholder="How well has the student shown presence on court?"
                  className={shortTextareaClasses}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="intent" className="text-sm font-medium text-muted">
                  Intent shown
                </label>
                <textarea
                  id="intent"
                  name="intent"
                  value={reportForm.intent}
                  onChange={handleReportChange}
                  placeholder="How intentful was the student in this session?"
                  className={shortTextareaClasses}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <label htmlFor="improvements" className="text-sm font-medium text-muted">
                  Key weaknesses
                </label>
                <textarea
                  id="improvements"
                  name="improvements"
                  value={reportForm.improvements}
                  onChange={handleReportChange}
                  placeholder="Areas where improvement is needed..."
                  className={longTextareaClasses}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label htmlFor="strengths" className="text-sm font-medium text-muted">
                  Key strengths
                </label>
                <textarea
                  id="strengths"
                  name="strengths"
                  value={reportForm.strengths}
                  onChange={handleReportChange}
                  placeholder="Student strengths..."
                  className={longTextareaClasses}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label htmlFor="comments" className="text-sm font-medium text-muted">
                  Additional comments
                </label>
                <textarea
                  id="comments"
                  name="comments"
                  value={reportForm.comments}
                  onChange={handleReportChange}
                  placeholder="Additional comments..."
                  className={longTextareaClasses}
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="inline-flex items-center justify-center rounded-hero bg-accent px-6 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Student Report'}
                </button>
                {lastSubmittedReport && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/reports', {
                        state: {
                          selectedPlayerId: lastSubmittedReport.playerId,
                          selectedEvaluationId: lastSubmittedReport.evaluationId
                        }
                      })
                      setLastSubmittedReport(null)
                    }}
                    className="inline-flex items-center justify-center rounded-hero bg-accent px-6 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    View Report for {lastSubmittedReport.studentName}
                  </button>
                )}
              </div>
              {message && (
                <p className={`text-sm ${message.toLowerCase().includes('error') ? 'text-red-400' : 'text-accent'}`}>
                  {message}
                </p>
              )}
            </div>
          </form>
        </section>

        <section className="space-y-6 rounded-card bg-surface p-8 shadow">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Report History</h2>
            <p className="text-sm text-muted">Pull previous submissions and AI feedback by athlete.</p>
          </div>
          <div className="space-y-3">
            <label htmlFor="historyName" className="text-sm font-medium text-muted">
              Student name
            </label>
            <input
              id="historyName"
              value={historyName}
              onChange={(e) => setHistoryName(e.target.value)}
              placeholder="Enter student name to view history"
              className={inputBaseClasses}
            />
            <button
              type="button"
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="inline-flex w-full items-center justify-center rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingHistory ? 'Loading...' : 'Load History'}
            </button>
          </div>
          <div id="history-results" className="space-y-4 overflow-y-auto">
            {history.length === 0 && (
              <p className="text-sm text-muted">No history loaded yet.</p>
            )}
            {history.map((h) => {
              const feedback = h.ai_feedback || ''
              const truncated = feedback.length > 100 ? feedback.slice(0, 100) + '...' : feedback
              const needsExpand = feedback.length > 100

              return (
                <div key={h.id ?? `${historyName}-empty`} className="space-y-2 rounded-md border border-white/10 bg-bg/50 p-4">
                  {h.session_id ? (
                    <>
                      <p className="text-sm font-semibold">
                        Session {h.session_id}{' '}
                        <span className="text-muted">· PSI: {h.psi_score}</span>
                      </p>
                      <p className="text-sm leading-relaxed text-muted">{truncated}</p>
                      {needsExpand && (
                        <button
                          onClick={() => {
                            const player = players.find(
                              (p) => p.name.toLowerCase() === historyName.trim().toLowerCase()
                            )
                            if (player) {
                              navigate('/reports', { state: { selectedPlayerId: player.id } })
                            }
                          }}
                          className="text-xs text-accent hover:underline focus:outline-none"
                        >
                          View full report →
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted">{truncated}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
        </div>
      </div>
    </AppShell>
  )
}

export default Dashboard
