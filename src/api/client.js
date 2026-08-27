const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export function getApiUrl(path) {
  return `${configuredBaseUrl}${path}`
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `API request failed: ${response.status}`
    try {
      const data = await response.json()
      message = data?.error?.message ?? message
    } catch {
      // Keep the status-based message when a proxy returns a non-JSON error.
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}

export async function apiGet(path) {
  return apiRequest(path)
}

export async function apiPost(path, body) {
  return apiRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}
