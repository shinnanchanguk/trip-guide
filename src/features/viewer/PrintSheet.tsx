import { useState } from 'react'
import { createPortal } from 'react-dom'
import { rich } from '../../components/Rich'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { useTrip } from '../../trip/context'
import { dateLabel } from '../../lib/time'
import { LEG_LABEL, legMinutes, type Chapter, type StopPage } from '../../trip/derive'
import { duration } from '../../lib/time'
import { timeText } from './parts'

const stopsOf = (c: Chapter) => c.pages.filter((p): p is StopPage => p.type === 'stop')

/** 인쇄할 일정표 한 벌. 미리 보기와 실제 인쇄가 같은 내용을 쓴다 */
function Schedule({ chapters, detail }: { chapters: Chapter[]; detail: boolean }) {
  const { d, doc } = useTrip()
  return (
    <div className="printdoc">
      <header className="printdoc__head">
        {doc.school ? <p className="printdoc__school">{doc.school}</p> : null}
        <h1 className="printdoc__title">{rich(doc.title)}</h1>
        <p className="printdoc__dates mono">
          {dateLabel(doc.startDate)}–{dateLabel(d.endDate)} · {doc.nights ? `${doc.nights}박 ${doc.nights + 1}일` : '당일'}
        </p>
      </header>
      {chapters.map((c) => (
        <section key={c.n} className="printdoc__day">
          <h2 className="printdoc__h2">
            {c.label} · {dateLabel(c.date!)} · {rich(c.title)}
          </h2>
          {stopsOf(c).length ? (
            <table className="printdoc__table">
              <thead>
                <tr>
                  <th scope="col">시각</th>
                  <th scope="col">일정</th>
                  <th scope="col">다시 모이는 곳</th>
                </tr>
              </thead>
              <tbody>
                {stopsOf(c).map((p) => {
                  const min = legMinutes(p)
                  return (
                    <tr key={p.key}>
                      <td className="mono printdoc__time">{timeText(d, p).range}</td>
                      <td>
                        <strong>{rich(p.stop.title)}</strong>
                        {p.stop.place ? <span className="printdoc__sub">{p.stop.place.name}</span> : null}
                        {p.stop.leg ? (
                          <span className="printdoc__sub">
                            오는 길: {LEG_LABEL[p.stop.leg.mode]}
                            {min ? ` ${duration(min)}` : ''}
                            {p.stop.leg.note ? ` · ${p.stop.leg.note}` : ''}
                          </span>
                        ) : null}
                        {detail && p.stop.body?.trim() ? <span className="printdoc__body">{p.stop.body}</span> : null}
                        {detail && p.stop.rules?.length ? <span className="printdoc__body">꼭 지켜요: {p.stop.rules.join(' · ')}</span> : null}
                      </td>
                      <td>
                        {p.stop.meet?.place ? <span>{p.stop.meet.place}</span> : null}
                        {p.stop.meet?.time ? <span className="mono printdoc__sub">{p.stop.meet.time}</span> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="printdoc__empty">이날 일정이 아직 없어요.</p>
          )}
        </section>
      ))}
    </div>
  )
}

/** 일정표 인쇄: 전체 또는 하루를 골라 브라우저 인쇄(PDF로 저장 포함)로 낸다 */
export function PrintSheet({ onClose }: { onClose: () => void }) {
  const { d } = useTrip()
  const days = d.chapters.filter((c) => c.date)
  const [which, setWhich] = useState<number>(0)
  const [detail, setDetail] = useState(false)
  const chapters = which === 0 ? days : days.filter((c) => c.n === which)
  return (
    <Sheet title="일정표 인쇄" onClose={onClose} wide>
      <div className="printsheet" data-noswipe>
        <div className="printsheet__tools">
          <label className="field">
            <span className="field__label">인쇄할 범위</span>
            <select className="input" value={which} onChange={(e) => setWhich(Number(e.target.value))}>
              <option value={0}>전체 일정</option>
              {days.map((c) => (
                <option key={c.n} value={c.n}>
                  {c.label} · {dateLabel(c.date!)}
                </option>
              ))}
            </select>
          </label>
          <label className="agree">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
            <span className="check__box" aria-hidden="true">
              <Icon name="check" size="0.9rem" strokeWidth={2.4} />
            </span>
            <span>안내사항과 꼭 지킬 것도 넣기</span>
          </label>
          <button type="button" className="btn btn--primary btn--block" onClick={() => window.print()}>
            <Icon name="print" size="1.1rem" /> 인쇄하기
          </button>
          <p className="fineprint">인쇄 창의 프린터 고르는 곳에서 「PDF로 저장」을 고르면 파일로 받을 수 있어요.</p>
        </div>
        <div className="printsheet__paper">
          <Schedule chapters={chapters} detail={detail} />
        </div>
      </div>
      {createPortal(
        <div className="print-root">
          <Schedule chapters={chapters} detail={detail} />
        </div>,
        document.body,
      )}
    </Sheet>
  )
}
