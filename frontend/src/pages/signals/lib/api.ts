export const api = (path: string, init?: RequestInit) =>
  fetch('/api/signals-service/' + path.replace(/^\/+/, ''), init)
