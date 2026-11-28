import { useEffect, useState } from 'react'

type Result<T> = { status: 'loading' | 'error' } | { status: 'ready'; data: T }

export function useApiData<T>(path: string | null) {
  const [revision, setRevision] = useState(0)
  const [request, setRequest] = useState<{path: string; revision: number; result: Result<T>} | null>(null)
  const result: Result<T> | null = path === null
    ? null
    : request?.path === path && request.revision === revision ? request.result : {status:'loading'}

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(path!, {signal: controller.signal})
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: T = await response.json()
        if (!controller.signal.aborted) setRequest({path: path!, revision, result:{status:'ready', data}})
      } catch {
        if (!controller.signal.aborted) setRequest({path: path!, revision, result:{status:'error'}})
      }
    }
    void load()
    return () => controller.abort()
  }, [path, revision])

  return {result, retry: () => setRevision(value => value + 1)}
}
