export const api = (path: string, init?: RequestInit) =>
  fetch('/api/' + path.replace(/^\/+/, ''), init)
