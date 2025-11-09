import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Mail, Brain, LogOut, FileText } from 'lucide-react'
import AppShell from '../components/AppShell'
import VerificationInput from '../components/VerificationInput'

const API_URL = 'http://127.0.0.1:8000'

const inputBaseClasses =
  'w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'

export default function Settings() {
  const navigate = useNavigate()
  const storedUsername = localStorage.getItem('coach') || 'Coach'
  const [coachUsername, setCoachUsername] = useState(storedUsername)
  const [initialDetails, setInitialDetails] = useState(null)

  const extractPhoneDigits = (value) => {
    if (!value) return ''
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 10) {
      return digits
    }

    if (digits.startsWith('91')) {
      return digits.slice(-10)
    }

    return digits.slice(0, 10)
  }

  const toApiPhone = (digits) => {
    if (!digits) return ''
    return `+91${digits}`
  }

  const isValidPhoneDigits = (digits) => {
    if (!digits) return true
    return /^\d{10}$/.test(digits)
  }

  // Profile Picture
  const [profilePicture, setProfilePicture] = useState(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState(null)
  const [initialProfilePicture, setInitialProfilePicture] = useState(null)
  const [isSavingPicture, setIsSavingPicture] = useState(false)
  const [pictureMessage, setPictureMessage] = useState('')

  // User Details
  const [userDetails, setUserDetails] = useState({
    username: coachUsername,
    email: '',
    phone: '',
    dob: ''
  })
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  const [detailsMessage, setDetailsMessage] = useState('')

  // Password Change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')

  // Email Change
  const [newEmail, setNewEmail] = useState('')
  const [emailVerificationStep, setEmailVerificationStep] = useState('input') // 'input' | 'verify'
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')

  // AI Tuning
  const [aiInstructions, setAiInstructions] = useState('')
  const [isEditingAI, setIsEditingAI] = useState(false)
  const [isSavingAI, setIsSavingAI] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  // Sign Out
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    // Load user details and AI instructions from backend
    loadUserData()
  }, [coachUsername])

  const loadUserData = async () => {
    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}`)
      if (res.ok) {
        const data = await res.json()
        const formattedPhone = extractPhoneDigits(data.phone)
        const mergedDetails = {
          username: data.username || coachUsername,
          email: data.email || '',
          phone: formattedPhone,
          dob: data.dob || ''
        }
        setUserDetails(mergedDetails)
        setInitialDetails({ ...mergedDetails })
        if (data.username && data.username !== coachUsername) {
          setCoachUsername(data.username)
          localStorage.setItem('coach', data.username)
        }
        setAiInstructions(data.ai_instructions || '')
        const savedPicture = data.profile_picture || ''
        setProfilePicture(savedPicture)
        setProfilePicturePreview(savedPicture)
        setInitialProfilePicture(savedPicture)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setPictureMessage('File size must be less than 2MB')
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setPictureMessage('Please select an image file')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result
        setProfilePicture(base64String)
        setProfilePicturePreview(base64String)
        setPictureMessage('')
      }
      reader.onerror = () => {
        setPictureMessage('Error reading file')
      }
      reader.readAsDataURL(file)
    }
  }

  const saveProfilePicture = async () => {
    setIsSavingPicture(true)
    setPictureMessage('')

    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_picture: profilePicture || '' })
      })

      if (res.ok) {
        setInitialProfilePicture(profilePicture)
        setPictureMessage('Profile picture saved successfully')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Save failed:', errorData)
        setPictureMessage(errorData.detail || 'Failed to save profile picture')
      }
    } catch (error) {
      console.error('Save error:', error)
      setPictureMessage('Server error')
    } finally {
      setIsSavingPicture(false)
    }
  }

  const handleDetailsChange = (e) => {
    const { name, value } = e.target

    if (name === 'phone') {
      setUserDetails({ ...userDetails, phone: extractPhoneDigits(value).slice(0, 10) })
      return
    }

    setUserDetails({ ...userDetails, [name]: value })
  }

  const saveUserDetails = async () => {
    if (!isValidPhoneDigits(userDetails.phone)) {
      setDetailsMessage('Enter a valid 10-digit Indian phone number.')
      return
    }

    setIsSavingDetails(true)
    setDetailsMessage('')

    const baseline =
      initialDetails || {
        username: coachUsername,
        email: userDetails.email || '',
        phone: '',
        dob: ''
      }

    const usernameChanged = userDetails.username !== (baseline.username || '')
    const phoneChanged = userDetails.phone !== (baseline.phone || '')
    const dobChanged = userDetails.dob !== (baseline.dob || '')

    const payload = {}
    if (usernameChanged) {
      payload.username = userDetails.username
    }
    if (phoneChanged) {
      payload.phone = userDetails.phone ? toApiPhone(userDetails.phone) : ''
    }
    if (dobChanged) {
      payload.dob = userDetails.dob || ''
    }

    let updateFailed = false
    if (Object.keys(payload).length > 0) {
      try {
        const res = await fetch(`${API_URL}/coach/${coachUsername}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) {
          const updatedDetails = {
            username: usernameChanged ? userDetails.username : baseline.username,
            email: baseline.email ?? userDetails.email,
            phone: phoneChanged ? userDetails.phone : baseline.phone,
            dob: dobChanged ? userDetails.dob : baseline.dob
          }
          setInitialDetails(updatedDetails)

          if (usernameChanged) {
            localStorage.setItem('coach', userDetails.username)
            setCoachUsername(userDetails.username)
          }

          setDetailsMessage('Details updated successfully')
        } else {
          setDetailsMessage('Failed to update details')
          updateFailed = true
        }
      } catch {
        setDetailsMessage('Server error')
        updateFailed = true
      }
    } else {
      setDetailsMessage('No changes to update')
      setIsSavingDetails(false)
      return
    }

    setIsSavingDetails(false)

    if (updateFailed) {
      return
    }

    setIsEditingDetails(false)
  }

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value })
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setPasswordMessage('')
    setIsChangingPassword(true)

    // First, verify current password
    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword
        })
      })

      if (!res.ok) {
        const data = await res.json()
        setPasswordMessage(data.detail || 'Current password is incorrect')
        setIsChangingPassword(false)
        return
      }

      // Current password is correct, now validate new password
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&+=!]).{8,20}$/
      if (!passwordRegex.test(passwordForm.newPassword)) {
        setPasswordMessage('Password must be 8-20 chars, with 1 capital letter, 1 number, and 1 symbol.')
        setIsChangingPassword(false)
        return
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordMessage('New passwords do not match.')
        setIsChangingPassword(false)
        return
      }

      // All validations passed
      setPasswordMessage('Password changed successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch {
      setPasswordMessage('Server error')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const sendEmailVerification = async () => {
    const trimmedEmail = (newEmail || '').trim()
    if (!trimmedEmail) {
      setEmailMessage('Enter a valid email address')
      return
    }

    if (trimmedEmail === (userDetails.email || '').trim()) {
      setEmailMessage('This email is already your current address')
      return
    }

    setNewEmail(trimmedEmail)
    setEmailMessage('')
    setIsSendingEmail(true)

    // Check if email is already in use
    try {
      const checkRes = await fetch(`${API_URL}/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      })
      const checkData = await checkRes.json()
      if (checkData.exists) {
        setEmailMessage('Email already registered')
        setIsSendingEmail(false)
        return
      }
    } catch {
      setEmailMessage('Server error')
      setIsSendingEmail(false)
      return
    }

    // Send verification code
    try {
      const res = await fetch(`${API_URL}/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', contact: trimmedEmail })
      })
      if (res.ok) {
        setEmailVerificationStep('verify')
        setEmailMessage('Verification code sent successfully')
      } else {
        setEmailMessage('Failed to send verification code')
      }
    } catch {
      setEmailMessage('Server error')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleEmailVerified = async () => {
    const verifiedEmail = (newEmail || '').trim()
    if (!verifiedEmail) {
      setEmailVerificationStep('input')
      setEmailMessage('Failed to change email')
      return
    }

    let success = false
    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: verifiedEmail })
      })
      if (res.ok) {
        success = true
        setEmailMessage('Email changed successfully')
        setUserDetails((prev) => ({ ...prev, email: verifiedEmail }))
        setInitialDetails((prev) => {
          if (prev) {
            return { ...prev, email: verifiedEmail }
          }
          return {
            username: userDetails.username,
            email: verifiedEmail,
            phone: userDetails.phone,
            dob: userDetails.dob
          }
        })
      } else {
        const errorData = await res.json().catch(() => ({}))
        setEmailMessage(errorData.detail || 'Failed to change email')
      }
    } catch {
      setEmailMessage('Server error')
    } finally {
      setEmailVerificationStep('input')
      if (success) {
        setNewEmail('')
        await loadUserData()
      }
    }
  }

  const saveAIInstructions = async () => {
    setIsSavingAI(true)
    setAiMessage('')

    try {
      const res = await fetch(`${API_URL}/coach/${coachUsername}/ai-instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: aiInstructions })
      })
      if (res.ok) {
        setAiMessage('AI instructions saved')
        setIsEditingAI(false)
      } else {
        setAiMessage('Failed to save instructions')
      }
    } catch {
      setAiMessage('Server error')
    } finally {
      setIsSavingAI(false)
    }
  }

  const handleSignOut = () => {
    setIsSigningOut(true)
    setTimeout(() => {
      localStorage.removeItem('coach')
      navigate('/')
    }, 3000)
  }

  if (emailVerificationStep === 'verify') {
    return (
      <AppShell showProtectedNav>
        <VerificationInput
          type="email"
          contact={newEmail}
          onVerified={handleEmailVerified}
          onResend={() => sendEmailVerification()}
        />
      </AppShell>
    )
  }

  return (
    <AppShell showProtectedNav>
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Settings</h1>
          <p className="text-sm text-muted">Manage your account and preferences.</p>
        </div>

        {/* Profile Picture Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <User className="text-accent" size={24} />
            <h2 className="text-2xl font-semibold">Profile Picture</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-bg/60 flex items-center justify-center overflow-hidden">
              {profilePicturePreview ? (
                <img src={profilePicturePreview} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={40} className="text-muted" />
              )}
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  id="profile-picture-upload"
                />
                <label
                  htmlFor="profile-picture-upload"
                  className="inline-flex items-center justify-center rounded-hero bg-white/10 px-4 py-2 font-medium text-text cursor-pointer transition-colors hover:bg-white/20"
                >
                  Choose Picture
                </label>
                <button
                  onClick={saveProfilePicture}
                  disabled={isSavingPicture || profilePicture === initialProfilePicture}
                  className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingPicture ? 'Saving...' : 'Save Picture'}
                </button>
              </div>
              <p className="text-xs text-muted">JPG, PNG or GIF (max. 2MB)</p>
              {pictureMessage && (
                <p className={`text-sm ${pictureMessage.toLowerCase().includes('error') || pictureMessage.toLowerCase().includes('failed') ? 'text-red-400' : 'text-accent'}`}>
                  {pictureMessage}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* User Details Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <FileText className="text-accent" size={24} />
            <h2 className="text-2xl font-semibold">User Details</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Username</label>
              <input
                name="username"
                value={userDetails.username}
                onChange={handleDetailsChange}
                disabled={!isEditingDetails}
                className={`${inputBaseClasses} ${!isEditingDetails ? 'opacity-60' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Phone</label>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-muted ${
                    !isEditingDetails ? 'opacity-60' : ''
                  }`}
                >
                  +91
                </span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={userDetails.phone}
                  onChange={handleDetailsChange}
                  disabled={!isEditingDetails}
                  className={`${inputBaseClasses} ${!isEditingDetails ? 'opacity-60' : ''}`}
                  placeholder="Phone (10 digits)"
                  maxLength={10}
                  pattern="\d{10}"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-muted">Date of Birth</label>
              <input
                name="dob"
                type="date"
                value={userDetails.dob}
                onChange={handleDetailsChange}
                disabled={!isEditingDetails}
                className={`${inputBaseClasses} ${!isEditingDetails ? 'opacity-60' : ''}`}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Need to update your email? Use the Change Email section below.
          </p>
          <div className="flex gap-3">
            {!isEditingDetails ? (
              <button
                onClick={() => setIsEditingDetails(true)}
                className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90"
              >
                Edit Details
              </button>
            ) : (
              <>
                <button
                  onClick={saveUserDetails}
                  disabled={isSavingDetails}
                  className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingDetails ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingDetails(false)
                    loadUserData()
                  }}
                  className="rounded-hero bg-white/10 px-4 py-2 font-medium text-text transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          {detailsMessage && (
            <p className={`text-sm ${detailsMessage.includes('success') ? 'text-accent' : 'text-red-400'}`}>
              {detailsMessage}
            </p>
          )}
        </section>

        {/* Password Change Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <Lock className="text-accent" size={24} />
            <h2 className="text-2xl font-semibold">Change Password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Current Password</label>
              <input
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                className={inputBaseClasses}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">New Password</label>
              <input
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                className={inputBaseClasses}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Confirm New Password</label>
              <input
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                className={inputBaseClasses}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </button>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.includes('success') ? 'text-accent' : 'text-red-400'}`}>
                {passwordMessage}
              </p>
            )}
          </form>
        </section>

        {/* Email Change Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <Mail className="text-accent" size={24} />
            <h2 className="text-2xl font-semibold">Change Email</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Current email:{' '}
              <span className="font-medium text-text">
                {userDetails.email || 'Not set'}
              </span>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">New Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="newemail@example.com"
                className={inputBaseClasses}
              />
            </div>
            <button
              onClick={sendEmailVerification}
              disabled={isSendingEmail || !newEmail.trim()}
              className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingEmail ? 'Sending...' : 'Send Verification Code'}
            </button>
            {emailMessage && (
              <p className={`text-sm ${emailMessage.includes('success') ? 'text-accent' : 'text-red-400'}`}>
                {emailMessage}
              </p>
            )}
          </div>
        </section>

        {/* AI Tuning Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <Brain className="text-accent" size={24} />
            <h2 className="text-2xl font-semibold">AI Tuning</h2>
          </div>
          <p className="text-sm text-muted">
            Customize how the AI generates reports. Your instructions will be applied to all future evaluations.
          </p>
          <div className="space-y-4">
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              disabled={!isEditingAI}
              placeholder="Enter custom instructions for AI report generation..."
              className={`${inputBaseClasses} h-32 resize-none ${!isEditingAI ? 'opacity-60' : ''}`}
            />
            <div className="flex gap-3">
              {!isEditingAI ? (
                <button
                  onClick={() => setIsEditingAI(true)}
                  className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90"
                >
                  Edit Instructions
                </button>
              ) : (
                <>
                  <button
                    onClick={saveAIInstructions}
                    disabled={isSavingAI}
                    className="rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingAI ? 'Saving...' : 'Save Instructions'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingAI(false)
                      loadUserData()
                    }}
                    className="rounded-hero bg-white/10 px-4 py-2 font-medium text-text transition-colors hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            {aiMessage && (
              <p className={`text-sm ${aiMessage.includes('saved') ? 'text-accent' : 'text-red-400'}`}>
                {aiMessage}
              </p>
            )}
          </div>
        </section>

        {/* Sign Out Section */}
        <section className="space-y-4 rounded-card bg-surface p-8 shadow">
          <div className="flex items-center gap-3">
            <LogOut className="text-red-400" size={24} />
            <h2 className="text-2xl font-semibold">Sign Out</h2>
          </div>
          <p className="text-sm text-muted">You will be redirected to the landing page.</p>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-hero bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </section>
      </div>
    </AppShell>
  )
}