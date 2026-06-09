import { ConnectionItem } from '@/types'

function buildChains(connections: ConnectionItem[]): string[][] {
  const toSet = new Set(connections.map(c => c.to))
  const starts = connections.filter(c => !toSet.has(c.from))

  if (starts.length === 0) {
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
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">오늘 뉴스, 어떻게 연결되어 있을까?</h2>
      <div className="bg-white rounded-card border border-line p-4 space-y-3">
        {chains.map((chain, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            {chain.map((node, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <span className="bg-white border border-line text-xs font-medium text-ink px-2.5 py-1 rounded-full whitespace-nowrap">
                  {node}
                </span>
                {j < chain.length - 1 && (
                  <span className="text-brand-green font-bold text-sm leading-none">→</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
