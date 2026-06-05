import { ConnectionItem } from '@/types'

function buildChains(connections: ConnectionItem[]): string[][] {
  const toSet = new Set(connections.map(c => c.to))
  const starts = connections.filter(c => !toSet.has(c.from))

  if (starts.length === 0) {
    // 시작점 없으면 첫 번째 항목부터 단일 체인
    const chain = [connections[0].from]
    let current = connections[0].to
    while (chain.length <= connections.length) {
      chain.push(current)
      const next = connections.find(c => c.from === current)
      if (!next) break
      current = next.to
    }
    return [chain]
  }

  return starts.map(start => {
    const chain = [start.from]
    let current = start.to
    while (chain.length <= connections.length) {
      chain.push(current)
      const next = connections.find(c => c.from === current)
      if (!next) break
      current = next.to
    }
    return chain
  })
}

interface Props {
  connections: ConnectionItem[] | null
}

export default function ConnectionDiagram({ connections }: Props) {
  if (!connections || connections.length === 0) return null

  const chains = buildChains(connections)

  return (
    <section>
      <h2 className="notion-heading">오늘의 경제 연결관계</h2>
      <div className="bg-notion-hover rounded-lg p-4 space-y-3">
        {chains.map((chain, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            {chain.map((node, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <span className="bg-white border border-notion-border text-xs font-medium text-notion-text px-2.5 py-1 rounded-full whitespace-nowrap">
                  {node}
                </span>
                {j < chain.length - 1 && (
                  <span className="text-notion-muted text-sm leading-none">→</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
