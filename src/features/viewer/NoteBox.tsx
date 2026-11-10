import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { useTrip } from '../../trip/context'
import type { StopPage } from '../../trip/derive'
import { NOTE_MAX, useNotes } from '../../lib/records'
import { AutoTextarea } from './AutoTextarea'

/** 장소별 개인 메모: 느낀 점과 따로, 이 기기에만 남고 파일에도 들어가지 않는다 */
export function NoteBox({ page }: { page: StopPage }) {
  const { scope } = useTrip()
  const [book, save] = useNotes(scope)
  const value = book[page.stop.id]?.text ?? ''
  const [open, setOpen] = useState(!!value)
  return (
    <section className="notebox" data-noswipe>
      <button type="button" className="notebox__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="document" size="1rem" />
        <span className="notebox__label">내 메모</span>
        {value && !open ? <span className="notebox__has">적어 둔 메모가 있어요</span> : null}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size="1rem" />
      </button>
      {open ? (
        <>
          <AutoTextarea key={page.stop.id} value={value} onSave={(t) => save(page.stop.id, t)} maxLength={NOTE_MAX} rows={3} placeholder="나만 볼 메모를 적어요." label={`${page.stop.title} 메모`} />
          <p className="fineprint">이 기기에만 남아요. 선생님께 내는 파일에는 들어가지 않아요.</p>
        </>
      ) : null}
    </section>
  )
}
