import { useState, useRef, useEffect } from 'react'

export default function VerificationInput({
  type = 'email',
  contact,
  onVerified,
  onResend
}) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(60)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    // Start countdown timer
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Auto-focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (index, value) => {
    // Only allow alphanumeric characters
    if (!/^[A-Z0-9]?$/i.test(value)) return

    const newCode = [...code]
    newCode[index] = value.toUpperCase()
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').toUpperCase().slice(0, 6)
    const newCode = [...code]

    for (let i = 0; i < pastedData.length && i < 6; i++) {
      if (/[A-Z0-9]/.test(pastedData[i])) {
        newCode[i] = pastedData[i]
      }
    }

    setCode(newCode)

    // Focus last filled input or next empty one
    const nextEmpty = newCode.findIndex(c => !c)
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus()
    } else {
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const verificationCode = code.join('')
    if (verificationCode.length !== 6) {
      setError('Please enter all 6 characters')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const response = await fetch('http://127.0.0.1:8000/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          contact,
          code: verificationCode
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Success - wait 3 seconds then call onVerified
        setTimeout(() => {
          onVerified()
        }, 3000)
      } else {
        setError(data.detail || 'Invalid verification code')
        setIsVerifying(false)
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (timer > 0) return

    setTimer(60)
    setCode(['', '', '', '', '', ''])
    setError('')

    if (onResend) {
      await onResend()
    }

    inputRefs.current[0]?.focus()
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center pb-20">
      <div className="w-full max-w-md space-y-6 rounded-card bg-surface p-8 shadow">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">
            {type === 'email' ? 'Verify Email' : 'Verify Phone'}
          </h1>
          <p className="text-sm text-muted">
            We've sent a 6-character code to{' '}
            <span className="font-medium text-text">{contact}</span>
          </p>
          <p className="text-xs text-muted/80 pt-1">
            💡 Didn't receive it? Check your spam/junk folder
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="h-14 w-12 rounded-md border border-white/10 bg-bg text-center text-xl font-semibold text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={isVerifying}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          {isVerifying && (
            <p className="text-center text-sm text-accent">
              ✓ Verification successful! Proceeding...
            </p>
          )}

          <button
            onClick={handleVerify}
            disabled={isVerifying || code.join('').length !== 6}
            className="w-full rounded-hero bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>

          <button
            onClick={handleResend}
            disabled={timer > 0}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {timer > 0 ? `Resend code in ${timer}s` : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  )
}
