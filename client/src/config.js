const developmentServerUrl = 'http://localhost:3001'
const defaultServerUrl = import.meta.env.DEV
  ? developmentServerUrl
  : window.location.origin

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || defaultServerUrl,
)

export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || defaultServerUrl,
)
