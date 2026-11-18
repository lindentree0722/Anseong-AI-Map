export async function loadApiOrDummy(loadApi, loadDummy) {
  try {
    return { data: await loadApi(), usedDummy: false }
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    return { data: loadDummy(), usedDummy: true }
  }
}
