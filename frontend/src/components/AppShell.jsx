import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Sun, Moon, Settings } from 'lucide-react'

const THEME_STORAGE_KEY = 'theme'

const resolveInitialMode = () => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  const prefersLight = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : false
  return prefersLight ? 'light' : 'dark'
}

export default function AppShell({ children, showProtectedNav = false }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => {
    const initial = resolveInitialMode()
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', initial === 'light')
    }
    return initial
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', mode === 'light')
    }
  }, [mode])

  const toggle = () => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }
  const brandHref = showProtectedNav ? '/dashboard' : '/'

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to={brandHref} className="font-semibold text-lg">
              NextShot AI
            </Link>
            {showProtectedNav && (
              <nav className="hidden gap-1 text-sm font-medium sm:flex">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link--active' : 'nav-link--inactive'}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/reports"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link--active' : 'nav-link--inactive'}`
                  }
                >
                  Student reports
                </NavLink>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showProtectedNav && (
              <button
                onClick={() => navigate('/settings')}
                className="group p-2 rounded-md hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Settings"
              >
                <Settings size={18} className="transition-transform duration-500 group-hover:rotate-180" />
              </button>
            )}
            <button
              onClick={toggle}
              className="p-2 rounded-md hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>
      {showProtectedNav && (
        <div className="sm:hidden border-b border-white/5 bg-surface/70">
          <div className="mx-auto flex max-w-7xl gap-1 px-6 py-2 text-sm font-medium">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : 'nav-link--inactive'}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : 'nav-link--inactive'}`
              }
            >
              Student reports
            </NavLink>
          </div>
        </div>
      )}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 sm:py-12 lg:py-16">
          {children}
        </div>
      </main>
    </div>
  )
}
