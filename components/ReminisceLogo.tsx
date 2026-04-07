// Reminisce logo — stylised R letterform built from
// straight lines and vertex nodes, matching the provided
// brand image. Scales via the size prop.

export default function ReminisceLogo({
  size = 32,
  color = '#ffffff',
  glowColor,
}: {
  size?: number
  color?: string
  glowColor?: string
}) {
  const s = size
  // Viewbox is 100×100 — all coordinates are in this space.
  // The R is constructed from 6 vertices connected by lines,
  // with filled circles at each junction point.
  //
  // Vertices (x, y):
  //   A  (18, 14)  — top-left of vertical stroke
  //   B  (18, 86)  — bottom-left of vertical stroke
  //   C  (18, 14)  — same as A (top)
  //   D  (72, 14)  — top-right
  //   E  (72, 50)  — mid-right (end of upper bowl)
  //   F  (18, 50)  — mid-left  (junction of bowl and leg)
  //   G  (78, 86)  — bottom-right (end of leg)

  const nodes = [
    { x: 18, y: 14 },   // A — top left
    { x: 18, y: 86 },   // B — bottom left
    { x: 72, y: 14 },   // C — top right
    { x: 72, y: 50 },   // D — mid right
    { x: 18, y: 50 },   // E — mid junction
    { x: 78, y: 86 },   // F — bottom right (leg end)
  ]

  // Edges: pairs of node indices
  const edges = [
    [0, 1],  // A → B  (left vertical stroke)
    [0, 2],  // A → C  (top horizontal)
    [2, 3],  // C → D  (right vertical upper)
    [3, 4],  // D → E  (bowl bottom / crossbar)
    [4, 5],  // E → F  (diagonal leg)
  ]

  const nr = Math.max(2.8, s * 0.048)  // node circle radius
  const sw = Math.max(1.4, s * 0.022)  // stroke width

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Reminisce logo"
      style={glowColor ? { filter: `drop-shadow(0 0 ${s * 0.12}px ${glowColor})` } : undefined}
    >
      {/* Lines */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      ))}
      {/* Vertex nodes */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={nr}
          fill={color}
        />
      ))}
    </svg>
  )
}
