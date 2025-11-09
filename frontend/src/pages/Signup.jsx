import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import VerificationInput from '../components/VerificationInput'

const API_URL = 'http://127.0.0.1:8000'

function Signup() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    repeatPassword: ''
  })
  const [error, setError] = useState('')
  const [step, setStep] = useState('signup') // 'signup' | 'verify-email'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&+=!]).{8,20}$/
    const emailRegex = /^[^@\s]+@[^@\s]+\.com$/
    if (!passwordRegex.test(form.password)) {
      setError('Password must be 8-20 chars, with 1 capital letter, 1 number, and 1 symbol.')
      return
    }
    if (form.password !== form.repeatPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!emailRegex.test(form.email)) {
      setError('Invalid email format.')
      return
    }
    if (!/^\d{10}$/.test(form.phone)) {
      setError('Phone number must be 10 digits.')
      return
    }

    setIsSubmitting(true)

    // Check if email already exists before sending verification
    try {
      const checkRes = await fetch(`${API_URL}/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      })
      const checkData = await checkRes.json()
      if (checkData.exists) {
        setError('Email already registered')
        setIsSubmitting(false)
        return
      }
    } catch {
      setError('Server error')
      setIsSubmitting(false)
      return
    }

    // Send email verification code
    try {
      const res = await fetch(`${API_URL}/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', contact: form.email })
      })
      if (res.ok) {
        setStep('verify-email')
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to send verification code')
      }
    } catch {
      setError('Server error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailVerified = async () => {
    // Complete signup after email verification
    try {
      const { repeatPassword: _repeatPassword, ...payload } = form
      const res = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        localStorage.setItem('coach', form.username)
        navigate('/dashboard')
      } else {
        const data = await res.json()
        setError(data.detail || 'Signup failed')
      }
    } catch {
      setError('Server error')
    }
  }

  const handleResendCode = async () => {
    try {
      await fetch(`${API_URL}/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', contact: form.email })
      })
    } catch {
      console.error('Failed to resend code')
    }
  }

  // Show verification screen if on email verification step
  if (step === 'verify-email') {
    return (
      <AppShell>
        <VerificationInput
          type="email"
          contact={form.email}
          onVerified={handleEmailVerified}
          onResend={handleResendCode}
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-transition flex min-h-[calc(100vh-8rem)] items-center justify-center pb-20">
        <div className="w-full max-w-xl space-y-6 rounded-card bg-surface p-8 shadow">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold">Coach Signup</h1>
            <p className="text-sm text-muted">Create an account to begin tracking your squad.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm text-muted">
                Username
              </label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Username"
                required
                className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm text-muted">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="coach@example.com"
                required
                className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="phone" className="text-sm text-muted">
                Phone number
              </label>
              <div className="flex items-center gap-3">
                <span className="rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-muted">+91</span>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone (10 digits)"
                  value={form.phone}
                  onChange={handleChange}
                  maxLength="10"
                  pattern="\d{10}"
                  required
                  className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="dob" className="text-sm text-muted">
                Date of birth
              </label>
              <input
                id="dob"
                name="dob"
                type="date"
                value={form.dob}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-muted">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="repeatPassword" className="text-sm text-muted">
                Confirm password
              </label>
              <input
                id="repeatPassword"
                name="repeatPassword"
                type="password"
                placeholder="Repeat Password"
                value={form.repeatPassword}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-white/10 bg-bg/60 px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-center text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  )
}

export default Signup

