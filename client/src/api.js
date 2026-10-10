import { API_URL } from './config.js'

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    const error = new Error('FocusLock server is unavailable. Check your connection and try again.')
    error.cause = requestError
    throw error
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned an invalid response.')
  }

  if (!response.ok) {
    const error = new Error(
      payload.error || payload.message || 'The request could not be completed.',
    )
    error.status = response.status
    throw error
  }

  return payload
}
