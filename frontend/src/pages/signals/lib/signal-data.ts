import type { Signal, SignalHistory, SignalStatus } from '../components/signal-utils'
import { api } from './api'
import { readJson, validateDetail, validateList } from './responses.mjs'
import { getDemoSignalDetail, listDemoSignals } from './demo-data.mjs'

export type SignalDataMode = 'demo' | 'api'

type ListOptions = {
  mode: SignalDataMode
  q?: string
  status?: 'all' | SignalStatus
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export async function listSignals({ mode, q = '', status = 'all', limit = 20, offset = 0, signal }: ListOptions): Promise<{ items: Signal[]; total: number }> {
  if (mode === 'demo') return listDemoSignals({ q, status, limit, offset })
  const params = new URLSearchParams({ q, status, limit: String(limit), offset: String(offset) })
  return validateList(await readJson(await api(`traffic-signals?${params}`, { signal })))
}

export async function getSignalDetail(mode: SignalDataMode, id: number, signal?: AbortSignal): Promise<{ signal: Signal; history: SignalHistory[] }> {
  if (mode === 'demo') return getDemoSignalDetail(id)
  return validateDetail(await readJson(await api(`traffic-signals/${id}`, { signal })))
}
