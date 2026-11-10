import { rich } from '../../components/Rich'
import { Icon } from '../../components/Icon'
import { useTrip } from '../../trip/context'
import { useStored } from '../../lib/storage'
import type { StopPage } from '../../trip/derive'
import { Section } from './parts'

/** 선생님 할 일: 역할이 선생님일 때만 보이고, 체크는 이 기기에만 남는다 */
export function TeacherTasks({ page }: { page: StopPage }) {
  const { scope } = useTrip()
  const [checks, setChecks] = useStored<Record<string, boolean>>(`teacher-checks:${scope}`, {})
  const tasks = page.stop.teacherTasks ?? []
  const keyOf = (t: string) => `${page.stop.id}:${t}`
  return (
    <Section title="선생님 할 일" icon="check">
      <div className="checklist" data-noswipe>
        <div className="checklist__group">
          {tasks.map((t) => (
            <label key={t} className="check" data-done={checks[keyOf(t)] || undefined}>
              <input type="checkbox" checked={!!checks[keyOf(t)]} onChange={(e) => setChecks((x) => ({ ...x, [keyOf(t)]: e.target.checked }))} />
              <span className="check__box" aria-hidden="true">
                <Icon name="check" size="0.9rem" strokeWidth={2.4} />
              </span>
              <span className="check__text">
                <span className="check__label">{rich(t)}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="fineprint">체크한 것은 이 기기에만 저장돼요.</p>
      </div>
    </Section>
  )
}
