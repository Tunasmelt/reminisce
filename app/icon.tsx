import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const nodes = [
    { x: 18, y: 14 },
    { x: 18, y: 86 },
    { x: 72, y: 14 },
    { x: 72, y: 50 },
    { x: 18, y: 50 },
    { x: 78, y: 86 },
  ]
  const edges = [
    [0, 1], [0, 2], [2, 3], [3, 4], [4, 5],
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: 32, height: 32,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={28}
          height={28}
          viewBox="0 0 100 100"
        >
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={nodes[a].x} y1={nodes[a].y}
              x2={nodes[b].x} y2={nodes[b].y}
              stroke="#ffffff"
              strokeWidth="6"
              strokeLinecap="round"
            />
          ))}
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r="5" fill="#ffffff" />
          ))}
        </svg>
      </div>
    ),
    { ...size }
  )
}
