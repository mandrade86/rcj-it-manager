/**
 * Patches the global `fetch` to automatically include the JWT Authorization header
 * for all requests to /api/* and redirect to /login on 401 responses.
 */
export function setupFetchInterceptor() {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    const isApi = url.startsWith('/api') || url.startsWith('http://localhost:3001/api')

    if (isApi && !url.includes('/api/auth/login')) {
      const token = localStorage.getItem('rcj_token')
      if (token) {
        const existingHeaders = new Headers(init?.headers as HeadersInit | undefined)
        existingHeaders.set('Authorization', `Bearer ${token}`)
        init = { ...init, headers: existingHeaders }
      }
    }

    const res = await originalFetch(input, init)

    if (res.status === 401 && isApi && !url.includes('/api/auth/login')) {
      localStorage.removeItem('rcj_token')
      localStorage.removeItem('rcj_user')
      window.location.href = '/login'
    }

    return res
  }
}
