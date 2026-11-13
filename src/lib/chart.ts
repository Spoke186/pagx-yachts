// The nautical chart for "A week in the Balearics", drawn at build time. Mallorca is a hand-traced outline
// (simplified, not for navigation) on an equirectangular projection; the route legs go round the headlands.
type LL = [number, number] // lon, lat
const LON0 = 2.15, LON1 = 3.65, LAT0 = 39.05, LAT1 = 40.0
export const W = 1000, H = 820
const P = ([lon, lat]: LL): [number, number] => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT1 - lat) / (LAT1 - LAT0)) * H]

const MALLORCA: LL[] = [
  [2.35, 39.585], [2.375, 39.555], [2.385, 39.54], [2.41, 39.515], [2.46, 39.51], [2.5, 39.475], [2.525, 39.46],
  [2.555, 39.5], [2.6, 39.535], [2.645, 39.565], [2.7, 39.54], [2.745, 39.505], [2.735, 39.465], [2.77, 39.4],
  [2.8, 39.36], [2.87, 39.34], [2.95, 39.33], [2.99, 39.315], [3.05, 39.265], [3.12, 39.3], [3.18, 39.33],
  [3.2, 39.35], [3.27, 39.41], [3.3, 39.47], [3.335, 39.54], [3.385, 39.59], [3.42, 39.65], [3.475, 39.715],
  [3.43, 39.75], [3.37, 39.77], [3.25, 39.75], [3.16, 39.77], [3.135, 39.83], [3.2, 39.87], [3.18, 39.895],
  [3.1, 39.9], [3.11, 39.92], [3.21, 39.96], [3.15, 39.945], [3.06, 39.925], [2.95, 39.9], [2.8, 39.86],
  [2.69, 39.8], [2.63, 39.755], [2.51, 39.695], [2.42, 39.63],
]
const CABRERA: LL[] = [[2.92, 39.165], [2.97, 39.16], [2.985, 39.135], [2.955, 39.115], [2.915, 39.125], [2.9, 39.145]]
const DRAGONERA: LL[] = [[2.305, 39.595], [2.33, 39.6], [2.345, 39.585], [2.32, 39.575]]

// Closed Catmull-Rom curve through the points, as cubic Béziers
const smooth = (pts: [number, number][], closed: boolean) => {
  const n = pts.length, at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return closed ? d + 'Z' : d
}
export const land = [MALLORCA, CABRERA, DRAGONERA].map((r) => smooth(r.map(P), true)).join('')

// Stops (Palma first, Palma last) and the waypoints of each leg between them
const STOPS: LL[] = [[2.64, 39.552], [2.378, 39.538], [2.685, 39.806], [3.135, 39.912], [3.175, 39.808], [3.205, 39.343], [2.935, 39.152], [2.64, 39.552]]
const VIA: LL[][] = [
  [[2.55, 39.515], [2.45, 39.49]],
  [[2.3, 39.55], [2.285, 39.62], [2.48, 39.725], [2.62, 39.79]],
  [[2.8, 39.885], [3.0, 39.94], [3.23, 39.985], [3.2, 39.925]],
  [[3.24, 39.9], [3.27, 39.83]],
  [[3.4, 39.8], [3.52, 39.73], [3.45, 39.6], [3.33, 39.44], [3.24, 39.35]],
  [[3.12, 39.255], [3.0, 39.18]],
  [[2.85, 39.29], [2.72, 39.44], [2.66, 39.52]],
]
export const stops = STOPS.slice(0, 7).map(P)
export const legs = VIA.map((v, i) => smooth([STOPS[i], ...v, STOPS[i + 1]].map(P), false))

// Graticule ticks on the frame, every quarter degree
export const ticks = {
  lon: [2.25, 2.5, 2.75, 3.0, 3.25, 3.5].map((l) => ({ x: P([l, LAT1])[0], label: `${Math.floor(l)}°${String(Math.round((l % 1) * 60)).padStart(2, '0')}′E` })),
  lat: [39.25, 39.5, 39.75].map((l) => ({ y: P([LON0, l])[1], label: `${Math.floor(l)}°${String(Math.round((l % 1) * 60)).padStart(2, '0')}′N` })),
}

// Depth soundings in metres, scattered over open water (seeded, so every build draws the same chart)
const inside = ([x, y]: [number, number], poly: [number, number][]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const polys = [MALLORCA, CABRERA, DRAGONERA].map((r) => r.map(P))
const near = (p: [number, number], d: number) => polys.some((poly) => poly.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < d))
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
export const soundings: { x: number; y: number; d: number }[] = []
for (let k = 0; soundings.length < 70 && k < 4000; k++) {
  const p: [number, number] = [20 + rnd() * (W - 40), 30 + rnd() * (H - 60)]
  if (polys.some((poly) => inside(p, poly)) || near(p, 16)) continue
  if (soundings.some((s) => Math.hypot(s.x - p[0], s.y - p[1]) < 62)) continue
  const coast = near(p, 60) ? 1 : near(p, 130) ? 2 : 3
  soundings.push({ x: p[0], y: p[1], d: Math.round([0, 12, 45, 120][coast] + rnd() * [0, 25, 60, 900][coast]) })
}
