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

function qs(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const endpoints = {
  health: () => request('/api/health'),
  preview: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/upload/preview', { method: 'POST', body: form })
  },
  upload: (file, mapping) => {
    const form = new FormData()
    form.append('file', file)
    if (mapping) {
      form.append('mapping', JSON.stringify(mapping))
    }
    return request('/api/upload', { method: 'POST', body: form })
  },
  uploads: () => request('/api/uploads'),
  clear: () => request('/api/uploads', { method: 'DELETE' }),
  quality: (id) => request(`/api/uploads/${id}/quality`),
  series: (uploadId) => request(`/api/analysis/series${qs({ upload_id: uploadId })}`),
  interannual: (uploadId) => request(`/api/analysis/interannual${qs({ upload_id: uploadId })}`),
  heatmap: (year, uploadId) =>
    request(`/api/analysis/heatmap${qs({ year, upload_id: uploadId })}`),
  ranking: (year, uploadId) =>
    request(`/api/analysis/ranking${qs({ year, upload_id: uploadId })}`),
  anomalies: (uploadId) => request(`/api/analysis/anomalies${qs({ upload_id: uploadId })}`),
  forecast: (uploadId) => request(`/api/forecast${qs({ upload_id: uploadId })}`),
  explain: (uploadId) => request(`/api/explain${qs({ upload_id: uploadId })}`),
  export: (format, uploadId) =>
    request(`/api/export${qs({ format, upload_id: uploadId })}`),
}
