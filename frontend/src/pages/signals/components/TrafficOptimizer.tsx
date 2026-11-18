import { useMemo, useState } from 'react'

const TRAFFIC_THRESHOLD = 2397
const DIRECTIONS = ['북쪽', '동쪽', '남쪽', '서쪽'] as const
type Direction = typeof DIRECTIONS[number]
type DirectionCounts = Record<Direction, number | null>
type DirectionInputs = Record<Direction, string>
type TrafficRecord = Record<string, string>
type Recommendation = {
  location: string
  volume: number
  triggered: boolean
  directionDataMissing: boolean
  cycleLength: number
  baselineGreens: Record<Direction, number>
  greens: Record<Direction, number>
}

const LOCATION_HEADERS = ['교차로명', '신호등', '위치', '주소', '지점명', 'location', 'intersection', 'signal']
const VOLUME_HEADERS = ['차량이동량', '차량수', '교통량', '전차종합수', '전차종수', '전차종별교통량', '전차종교통량', '전체교통량', '합계', 'volume', 'traffic', 'count', 'total']
const DIRECTION_HEADERS: Record<Direction, string[]> = {
  북쪽: ['북쪽', '북향', '북', 'north', 'nb'],
  동쪽: ['동쪽', '동향', '동', 'east', 'eb'],
  남쪽: ['남쪽', '남향', '남', 'south', 'sb'],
  서쪽: ['서쪽', '서향', '서', 'west', 'wb'],
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_()\-]/g, '').replace(/\[|\]/g, '')
}

function findHeader(headers: string[], aliases: string[]) {
  const normalized = headers.map(normalizeHeader)
  const exact = normalized.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)))
  if (exact >= 0) return headers[exact]
  const partial = normalized.findIndex((header) => aliases.some((alias) => header.includes(normalizeHeader(alias))))
  return partial >= 0 ? headers[partial] : ''
}

function parseCount(value: string | undefined) {
  if (!value) return null
  const number = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(number) && number >= 0 ? number : null
}

function splitDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았어요.')
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

function csvRecords(text: string): TrafficRecord[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let quoted = false
  const delimiterCounts = { '\t': 0, ',': 0, ';': 0 }
  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"' && firstLine[index + 1] === '"' && quoted) index += 1
    else if (firstLine[index] === '"') quoted = !quoted
    else if (!quoted && firstLine[index] in delimiterCounts) delimiterCounts[firstLine[index] as keyof typeof delimiterCounts] += 1
  }
  const delimiter = Object.entries(delimiterCounts).sort((a, b) => b[1] - a[1])[0][0]
  const [headerRow, ...dataRows] = splitDelimited(text.replace(/^\uFEFF/, ''), delimiter)
  if (!headerRow?.length) throw new Error('CSV에서 열 이름을 찾지 못했어요.')
  const headers = headerRow.map((header) => header.trim())
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

function jsonRecords(text: string): TrafficRecord[] {
  const parsed: unknown = JSON.parse(text)
  const findRows = (value: unknown): unknown[] | null => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    for (const key of ['rows', 'data', 'items', 'item', 'records', 'response', 'body']) {
      const rows = findRows(record[key])
      if (rows) return rows
    }
    return Object.values(record).map(findRows).find((rows) => rows !== null) ?? null
  }
  const source = findRows(parsed)
  if (!Array.isArray(source)) throw new Error('JSON은 객체 배열이거나 rows/data/items 배열을 포함해야 해요.')
  return source
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? '')])))
}

function distributeGreens(cycleLength: number, counts: DirectionCounts) {
  const lostTime = DIRECTIONS.length * 4
  const greenTotal = cycleLength - lostTime
  const baseline = greenTotal / DIRECTIONS.length
  const knownCounts = DIRECTIONS.map((direction) => counts[direction])
  const maxCount = Math.max(0, ...knownCounts.filter((value): value is number => value !== null))
  const weights = DIRECTIONS.map((direction) => {
    const count = counts[direction]
    return count === null || maxCount === 0 ? 1 : 1 + 2 * count / maxCount
  })
  const greens = Object.fromEntries(DIRECTIONS.map((direction) => [direction, 0])) as Record<Direction, number>
  let remaining = greenTotal
  const active = new Set(DIRECTIONS.map((_, index) => index))
  while (active.size) {
    const weightTotal = [...active].reduce((sum, index) => sum + weights[index], 0)
    const shares = [...active].map((index) => [index, remaining * weights[index] / weightTotal] as const)
    const belowMinimum = shares.filter(([, share]) => share < 6)
    if (!belowMinimum.length) {
      for (const [index, share] of shares) greens[DIRECTIONS[index]] = share
      break
    }
    for (const [index] of belowMinimum) {
      greens[DIRECTIONS[index]] = 6
      remaining -= 6
      active.delete(index)
    }
  }
  return { greens, baseline }
}

function recommendation(location: string, volume: number, directions: DirectionCounts, cycleLength: number): Recommendation {
  const triggered = volume > TRAFFIC_THRESHOLD
  const hasDirectionalCounts = DIRECTIONS.some((direction) => (directions[direction] ?? 0) > 0)
  const { greens, baseline } = distributeGreens(cycleLength, directions)
  return {
    location,
    volume,
    triggered,
    directionDataMissing: triggered && !hasDirectionalCounts,
    cycleLength,
    baselineGreens: Object.fromEntries(DIRECTIONS.map((direction) => [direction, baseline])) as Record<Direction, number>,
    greens: triggered ? greens : Object.fromEntries(DIRECTIONS.map((direction) => [direction, baseline])) as Record<Direction, number>,
  }
}

export function TrafficOptimizer() {
  const [location, setLocation] = useState('')
  const [volume, setVolume] = useState('')
  const [cycleLength, setCycleLength] = useState('90')
  const [manualDirections, setManualDirections] = useState<DirectionInputs>({ 북쪽: '', 동쪽: '', 남쪽: '', 서쪽: '' })
  const [manualResult, setManualResult] = useState<Recommendation | null>(null)
  const [manualError, setManualError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileRecords, setFileRecords] = useState<TrafficRecord[]>([])
  const [fileError, setFileError] = useState('')
  const [locationColumn, setLocationColumn] = useState('')
  const [volumeColumn, setVolumeColumn] = useState('')
  const [fileCycleLength, setFileCycleLength] = useState('90')

  const headers = useMemo(() => fileRecords.length ? Object.keys(fileRecords[0]) : [], [fileRecords])
  const fileResults = useMemo(() => {
    const cycle = parseCount(fileCycleLength)
    if (!locationColumn || !volumeColumn || cycle === null || cycle < 40 || cycle > 180) return []
    return fileRecords.flatMap((record) => {
      const place = record[locationColumn]?.trim()
      const count = parseCount(record[volumeColumn])
      if (!place || count === null) return []
      const directions = Object.fromEntries(DIRECTIONS.map((direction) => [
        direction,
        parseCount(record[findHeader(headers, DIRECTION_HEADERS[direction])]),
      ])) as DirectionCounts
      return [recommendation(place, count, directions, cycle)]
    })
  }, [fileCycleLength, fileRecords, headers, locationColumn, volumeColumn])
  const alertedCount = fileResults.filter((item) => item.triggered).length

  const handleFile = async (file?: File) => {
    setFileError('')
    setFileRecords([])
    setFileName('')
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      let text: string
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        text = new TextDecoder('euc-kr').decode(buffer)
      }
      const records = /\.json$/i.test(file.name) || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')
        ? jsonRecords(text)
        : csvRecords(text)
      if (!records.length) throw new Error('분석할 데이터 행이 없어요.')
      const fileHeaders = Object.keys(records[0])
      setFileRecords(records)
      setFileName(file.name)
      setLocationColumn(findHeader(fileHeaders, LOCATION_HEADERS))
      setVolumeColumn(findHeader(fileHeaders, VOLUME_HEADERS))
      if (!findHeader(fileHeaders, LOCATION_HEADERS) || !findHeader(fileHeaders, VOLUME_HEADERS)) {
        setFileError('위치 또는 교통량 열을 자동으로 찾지 못했어요. 아래에서 열을 직접 선택해 주세요.')
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : '파일을 읽지 못했어요.')
    }
  }

  const analyzeManual = () => {
    const count = parseCount(volume)
    const cycle = parseCount(cycleLength)
    const directions = Object.fromEntries(DIRECTIONS.map((direction) => [
      direction,
      manualDirections[direction].trim() ? parseCount(manualDirections[direction]) : null,
    ])) as DirectionCounts
    if (!location.trim()) {
      setManualResult(null)
      return setManualError('신호등 위치를 입력해 주세요.')
    }
    if (count === null) {
      setManualResult(null)
      return setManualError('차량 이동량은 0 이상의 숫자로 입력해 주세요.')
    }
    if (cycle === null || cycle < 40 || cycle > 180) {
      setManualResult(null)
      return setManualError('신호 주기는 40초에서 180초 사이로 입력해 주세요.')
    }
    if (DIRECTIONS.some((direction) => manualDirections[direction].trim() && directions[direction] === null)) {
      setManualResult(null)
      return setManualError('방향별 차량 수는 0 이상의 숫자로 입력해 주세요.')
    }
    setManualError('')
    setManualResult(recommendation(location.trim(), count, directions, cycle))
  }

  const downloadResults = () => {
    const columns = ['위치', '차량이동량', '2397초과여부', ...DIRECTIONS.flatMap((direction) => [`${direction}균등기준녹색초`, `${direction}권고녹색초`])]
    const rows = fileResults.map((item) => [
      item.location,
      item.volume,
      item.triggered ? '개선 권고' : '기준 이하',
      ...DIRECTIONS.flatMap((direction) => item.triggered ? [item.baselineGreens[direction].toFixed(1), item.greens[direction].toFixed(1)] : ['', '']),
    ])
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'traffic-signal-recommendations.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="optimizer">
    <div className="optimizer-heading">
      <div><p className="eyebrow">교통량 기반 신호 진단</p><h2>혼잡 신호 개선안</h2></div>
      <span className="threshold-badge">기준 {TRAFFIC_THRESHOLD.toLocaleString()}대 초과</span>
    </div>
    <p className="optimizer-intro">신호등 위치와 분석 기간의 차량 이동량을 입력하거나, 내려받은 CSV·JSON을 불러오세요. 기준을 초과한 교차로에 방향별 권고 녹색시간을 계산합니다.</p>

    <div className="optimizer-grid">
      <section className="optimizer-card">
        <h3>직접 입력</h3>
        <div className="optimizer-fields">
          <label className="optimizer-field"><span>신호등 위치</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="예: 안성시 중앙로 사거리" /></label>
          <label className="optimizer-field"><span>차량 이동량 <small>(분석 기간 기준)</small></span><input type="number" min="0" value={volume} onChange={(event) => setVolume(event.target.value)} placeholder="예: 2500" /></label>
          <label className="optimizer-field"><span>현재 주기 <small>(초)</small></span><input type="number" min="40" max="180" value={cycleLength} onChange={(event) => setCycleLength(event.target.value)} /></label>
        </div>
        <details className="direction-inputs">
          <summary>방향별 차량 수 추가 <span>(선택)</span></summary>
          <div className="optimizer-fields direction-grid">{DIRECTIONS.map((direction) => <label className="optimizer-field" key={direction}><span>{direction}</span><input type="number" min="0" placeholder="미입력" value={manualDirections[direction]} onChange={(event) => setManualDirections((current) => ({ ...current, [direction]: event.target.value }))} /></label>)}</div>
        </details>
        <button type="button" className="optimizer-submit" onClick={analyzeManual}>교통량 분석</button>
        {manualError && <p className="optimizer-error" role="alert">{manualError}</p>}
        {manualResult && <RecommendationCard result={manualResult} />}
      </section>

      <section className="optimizer-card">
        <div className="optimizer-section-title"><h3>파일에서 교통량 찾기</h3><span>CSV · JSON</span></div>
        <p className="optimizer-help">공공데이터에서 내려받은 파일을 선택하세요. 파일은 이 브라우저에서만 읽으며 서버로 전송하지 않습니다.</p>
        <label className="file-picker">파일 선택<input type="file" accept=".csv,.tsv,.json,text/csv,application/json,text/tab-separated-values" onChange={(event) => handleFile(event.target.files?.[0])} /></label>
        {fileName && <p className="file-name">{fileName} · {fileRecords.length.toLocaleString()}행</p>}
        {fileRecords.length > 0 && <div className="optimizer-fields file-fields">
          <label className="optimizer-field"><span>위치 열</span><select value={locationColumn} onChange={(event) => { setLocationColumn(event.target.value); setFileError('') }}><option value="">열 선택</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="optimizer-field"><span>차량 이동량 열</span><select value={volumeColumn} onChange={(event) => { setVolumeColumn(event.target.value); setFileError('') }}><option value="">열 선택</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className="optimizer-field"><span>적용 주기 <small>(초)</small></span><input type="number" min="40" max="180" value={fileCycleLength} onChange={(event) => setFileCycleLength(event.target.value)} /></label>
        </div>}
        {fileError && <p className="optimizer-error" role="alert">{fileError}</p>}
        {fileRecords.length > 0 && (parseCount(fileCycleLength) === null || Number(fileCycleLength) < 40 || Number(fileCycleLength) > 180) && <p className="optimizer-error" role="alert">적용 주기는 40초에서 180초 사이로 입력해 주세요.</p>}
        {fileRecords.length > 0 && <>
          <div className="file-summary"><strong>{fileResults.length.toLocaleString()}개 위치 분석 · {Math.max(0, fileRecords.length - fileResults.length).toLocaleString()}행 제외</strong><span>{alertedCount.toLocaleString()}곳 개선 권고</span></div>
          {fileResults.length > 0 && <div className="file-results" role="region" aria-label="파일 분석 결과">
            {fileResults.slice(0, 30).map((result, index) => <div className={`file-result ${result.triggered ? 'over-threshold' : ''}`} key={`${result.location}-${index}`}>
              <span><strong>{result.location}</strong><small>{result.volume.toLocaleString()}대</small></span>
              <b>{result.triggered ? '개선 검토' : '기준 이하'}</b>
            </div>)}
            {fileResults.length > 30 && <p className="optimizer-help">화면에는 처음 30개 행만 표시합니다. 다운로드에는 전체 결과가 포함됩니다.</p>}
          </div>}
          <button type="button" className="download-button" onClick={downloadResults} disabled={!fileResults.length}>분석 결과 CSV 다운로드</button>
        </>}
      </section>
    </div>
    <p className="optimizer-disclaimer">권고안은 입력값에 따른 단순 시뮬레이션이며 실제 신호를 변경하지 않습니다. 신호 주기·보행자 시간·황색 및 전적색 시간·교통 연동을 검토한 뒤 관할 기관에서 안전성을 확인해야 합니다. 2,397 기준은 사용자가 입력한 분석 기간과 동일한 단위로 적용됩니다.</p>
  </section>
}

function RecommendationCard({ result }: { result: Recommendation }) {
  return <div className={`recommendation ${result.triggered ? 'recommendation-active' : ''}`} aria-live="polite">
    <p className="eyebrow">{result.location}</p>
    <h4>{result.triggered ? '개선 검토 대상' : '기준 이하'}</h4>
    <p>{result.volume.toLocaleString()}대 · 기준 {TRAFFIC_THRESHOLD.toLocaleString()}대 {result.triggered ? '초과' : '이하'}</p>
    {result.triggered && <>
      <div className="green-plan">{DIRECTIONS.map((direction) => <div key={direction}><span>{direction}</span><strong>균등 {result.baselineGreens[direction].toFixed(1)} → 권고 {result.greens[direction].toFixed(1)}초</strong></div>)}</div>
      <small>{result.directionDataMissing ? '방향별 교통량이 없어 균등 배분한 검토용 권고입니다. 방향별 계수를 입력하면 다시 계산할 수 있어요.' : `${result.cycleLength}초 주기에서 방향별 녹색시간을 재배분한 검토용 권고입니다.`}</small>
    </>}
  </div>
}
