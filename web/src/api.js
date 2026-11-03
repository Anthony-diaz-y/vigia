const TOKEN_KEY = 'vigia-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || 'vigia-dev'
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'X-Access-Token': getToken(),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${response.status}: ${detail}`)
  }
  return response.json()
}

export const endpoints = {
  health: () => request('/api/health'),
  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/upload', { method: 'POST', body: form })
  },
  loadDemo: () => request('/api/demo/load', { method: 'POST' }),
  uploads: () => request('/api/uploads'),
  clear: () => request('/api/uploads', { method: 'DELETE' }),
  quality: (id) => request(`/api/uploads/${id}/quality`),
  series: () => request('/api/analysis/series'),
  interannual: () => request('/api/analysis/interannual'),
  heatmap: (year) => request(`/api/analysis/heatmap?year=${year}`),
  ranking: (year) => request(`/api/analysis/ranking${year ? `?year=${year}` : ''}`),
  anomalies: () => request('/api/analysis/anomalies'),
  forecast: () => request('/api/forecast'),
  explain: () => request('/api/explain'),
}
