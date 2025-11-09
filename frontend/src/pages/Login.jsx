import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AppShell from '../components/AppShell'
import { login as loginApi } from '../lib/api'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

export default function Login() {
  const [serverError, setServerError] = useState('')
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setServerError('')
    const res = await loginApi(data)
    if (res.ok) {
      localStorage.setItem('coach', data.username)
      navigate('/dashboard')
    } else {
      setServerError(res.error || 'Login failed')
    }
  }

  return (
    <AppShell>
      <div className="page-transition flex min-h-[calc(100vh-8rem)] items-center justify-center pb-20">
        <div className="w-full max-w-md space-y-6 rounded-card bg-surface p-8 shadow">
          <h1 className="text-center text-2xl font-semibold">Login</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm">
                Username
              </label>
              <input
                id="username"
                {...register('username')}
                className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-invalid={errors.username ? 'true' : 'false'}
              />
              {errors.username && (
                <p className="text-sm text-red-500" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm">
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="w-full rounded-md border border-white/10 bg-bg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              {errors.password && (
                <p className="text-sm text-red-500" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>
            {serverError && (
              <p className="text-sm text-red-500" role="alert">
                {serverError}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-hero bg-accent px-4 py-2 font-medium text-bg transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Logging in…' : 'Login'}
            </button>
          </form>
          <p className="text-center text-sm text-muted">
            Need an account?{' '}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
