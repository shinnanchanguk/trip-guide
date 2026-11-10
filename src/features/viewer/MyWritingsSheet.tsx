import { useMemo } from 'react'
import { rich } from '../../components/Rich'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useTrip } from '../../trip/context'
import { useBook } from '../../lib/reflections'
import { useMissions, useNotes } from '../../lib/records'
import { dateLabel } from '../../lib/time'
import type { StopPage } from '../../trip/derive'

type Piece = { kind: string; text: string }
type Row = { page: StopPage; pieces: Piece[] }

/** 내 느낀 점 모아 보기: 날짜 순서로 장소별 글을 한곳에서 본다. 장소 이름을 누르면 그 장으로 간다 */
export function MyWritingsSheet({ onJump, onClose }: { onJump: (key: string) => void; onClose: () => void }) {
  const { d, scope } = useTrip()
  const [book] = useBook(scope)
  const [notes] = useNotes(scope)
  const [missions] = useMissions(scope)
  const days = useMemo(() => {
    const groups: { label: string; rows: Row[] }[] = []
    for (const page of d.stopPages) {
      const pieces: Piece[] = []
      if (book[page.stop.id]?.text.trim()) pieces.push({ kind: '느낀 점', text: book[page.stop.id].text })
      for (const m of page.stop.missions ?? []) if (missions[m.id]?.text.trim()) pieces.push({ kind: `활동지 · ${m.title}`, text: missions[m.id].text })
      if (notes[page.stop.id]?.text.trim()) pieces.push({ kind: '내 메모', text: notes[page.stop.id].text })
      if (!pieces.length) continue
      const label = `${page.chapter.label} · ${dateLabel(page.chapter.date!)}`
      if (groups.at(-1)?.label !== label) groups.push({ label, rows: [] })
      groups.at(-1)!.rows.push({ page, pieces })
    }
    return groups
  }, [d, book, notes, missions])
  const stopIds = new Set(d.stopPages.map((p) => p.stop.id))
  const others = [...Object.entries(book), ...Object.entries(notes)].filter(([id, v]) => !stopIds.has(id) && v.text.trim())
  return (
    <Sheet title="내 느낀 점 모아 보기" onClose={onClose}>
      <div className="writings">
        {days.length || others.length ? null : <p className="empty-note">아직 적은 글이 없어요. 장소마다 느낀 점이나 메모를 적으면 여기에 모여요.</p>}
        {days.map((g) => (
          <section key={g.label} className="writings__day">
            <h3 className="writings__h">{g.label}</h3>
            {g.rows.map(({ page, pieces }) => (
              <article key={page.key} className="writing">
                <button type="button" className="writing__place" onClick={() => onJump(page.key)}>
                  <span className="mono writing__time">{page.stop.time}</span>
                  <span className="writing__name">{rich(page.stop.place?.name ?? page.stop.title)}</span>
                  <Icon name="chevronRight" size="1rem" />
                </button>
                {pieces.map((p, i) => (
                  <div key={i} className="writing__piece">
                    <p className="writing__kind">{p.kind}</p>
                    <p className="writing__text">{p.text}</p>
                  </div>
                ))}
              </article>
            ))}
          </section>
        ))}
        {others.length ? (
          <section className="writings__day">
            <h3 className="writings__h">지금 일정에 없는 곳</h3>
            {others.map(([id, v]) => (
              <article key={id} className="writing">
                <p className="writing__text">{v.text}</p>
              </article>
            ))}
          </section>
        ) : null}
        <p className="fineprint">여기 있는 글은 이 기기에 있어요. 느낀 점과 활동지는 다녀와서 장에서 파일로 저장해 선생님께 내요.</p>
      </div>
    </Sheet>
  )
}
