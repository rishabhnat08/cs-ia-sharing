const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export async function login(payload) {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data.detail || 'Login failed' }
    }
    return { ok: true, user: payload.username, ...data }
  } catch (error) {
    return { ok: false, error: error.message || 'Network error' }
  }
}
