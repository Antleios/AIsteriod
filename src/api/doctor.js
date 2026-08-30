import { apiGet, apiPatch, apiPost } from './client.js'

function queryString(params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }
  const value = query.toString()
  return value ? `?${value}` : ''
}

export function fetchDoctorConversations({ cursor, limit = 50, q } = {}) {
  return apiGet(`/api/doctor/conversations${queryString({ cursor, limit, q })}`)
}

export function fetchDoctorConversation(sessionId) {
  return apiGet(`/api/doctor/conversations/${encodeURIComponent(sessionId)}`)
}

export function fetchDoctorDashboard(range = '7d') {
  return apiGet(`/api/doctor/dashboard${queryString({ range })}`)
}

export function fetchDoctorTrainingRecords({ cursor, limit = 20, gameCode, q } = {}) {
  return apiGet(
    `/api/doctor/training-records${queryString({ cursor, limit, gameCode, q })}`,
  )
}

export function fetchDoctorPatients({ cursor, limit = 20, q } = {}) {
  return apiGet(`/api/doctor/patients${queryString({ cursor, limit, q })}`)
}

export function assignDoctorPatient(username) {
  return apiPost('/api/doctor/patients', { username })
}

export function updateDoctorPatientProfile(patientId, profile) {
  return apiPatch(
    `/api/doctor/patients/${encodeURIComponent(patientId)}/profile`,
    profile,
  )
}
