import { useState } from 'react'
import { rich } from '../../components/Rich'
import { Icon } from '../../components/Icon'
import { useTrip } from '../../trip/context'
import type { StopPage } from '../../trip/derive'
import { MISSION_MAX, useMissions } from '../../lib/records'
import { AutoTextarea } from './AutoTextarea'

/** 활동지·미션: 미션을 골라 답을 적는다. 답은 미션마다 따로 이 기기에 저장되고, 다녀와서 저장하는 파일에 함께 담긴다. */
export function MissionBox({ page }: { page: StopPage }) {
  const { scope } = useTrip()
  const [book, save] = useMissions(scope)
  const missions = page.stop.missions ?? []
  const [open, setOpen] = useState<string | null>(missions.length === 1 ? missions[0].id : null)
  const done = missions.filter((m) => book[m.id]?.text.trim()).length
  return (
    <section className="block missions" data-noswipe>
      <h2 className="block__title">
        <Icon name="bulb" size="1.05rem" /> 활동지
        <span className="missions__count mono">
          {done} / {missions.length}
        </span>
      </h2>
      {missions.length > 1 ? <p className="missions__hint">하고 싶은 미션을 골라 답을 적어요. 다른 미션의 답은 그대로 남아 있어요.</p> : null}
      <ul className="missions__list">
        {missions.map((m) => {
          const isOpen = open === m.id
          const has = !!book[m.id]?.text.trim()
          return (
            <li key={m.id} className="mission" data-open={isOpen || undefined}>
              <button type="button" className="mission__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}>
                <span className="mine__mark" data-done={has || undefined} aria-hidden="true">
                  {has ? <Icon name="check" size="0.85rem" strokeWidth={2.4} /> : null}
                </span>
                <span className="mission__title">{rich(m.title)}</span>
                <span className="sr-only">{has ? '답을 적었어요' : '아직 답을 적지 않았어요'}</span>
                <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size="1rem" />
              </button>
              {isOpen ? (
                <div className="mission__body">
                  {m.prompt?.trim() ? <p className="reflect__prompt">{rich(m.prompt)}</p> : null}
                  <AutoTextarea key={m.id} value={book[m.id]?.text ?? ''} onSave={(t) => save(m.id, t)} maxLength={MISSION_MAX} placeholder="찾은 것, 생각한 것을 적어 보세요." label={`${m.title} 답`} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="fineprint">쓰는 대로 이 휴대폰에 저장돼요. 다녀와서 느낀 점 파일에 함께 담겨 선생님께 전해져요.</p>
    </section>
  )
}

/** 선생님 화면: 학생에게 어떤 미션이 보이는지만 알려 준다 */
export function MissionNote({ page }: { page: StopPage }) {
  const missions = page.stop.missions ?? []
  return (
    <p className="fineprint reflect-note">
      <Icon name="bulb" size="0.95rem" /> 학생 활동지 {missions.length}개 · {missions.map((m) => m.title).join(', ')}
    </p>
  )
}
