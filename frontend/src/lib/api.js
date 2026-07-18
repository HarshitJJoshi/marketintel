// NEW FILE: frontend/src/lib/api.js
// Central axios instance that attaches the user's Supabase JWT to every request.

import axios from 'axios'
import { supabase } from './supabase'

export const API = "https://marketintel-production-e203.up.railway.app"

const api = axios.create({ baseURL: API })

// Attach current session's access token to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export default api