import { useEffect, useState } from 'react'
import { rich } from '../../components/Rich'
import { Icon } from '../../components/Icon'
import { Dialog } from '../../components/Dialog'
import { useTrip } from '../../trip/context'
import { goTo } from '../../lib/router'
import { allScored, COMMENT_MAX, DEFAULT_COMMENT, isSurveyComplete, SCORE_LABEL, SURVEY_SNOOZE_MS, surveyOpensAt, surveyQuestions, useSurveyState, validScore } from '../../lib/records'
import { AutoTextarea } from './AutoTextarea'
import { Section } from './parts'

const SCORES = [1, 2, 3, 4, 5]

/** 만족도 조사(다녀와서 장). 답은 이 기기에 저장되고 학생 파일에 함께 담긴다 */
export function SurveyForm() {
  const { doc, scope } = useTrip()
  const [st, setSt] = useSurveyState(scope)
  const [missing, setMissing] = useState(false)
  const survey = doc.survey
  const questions = surveyQuestions(doc)
  if (!survey || (!questions.length && !survey.groups.some((g) => g.comment))) return null
  const left = questions.filter((q) => !validScore(st.scores[q.id])).length
  const complete = isSurveyComplete(doc, st)
  return (
    <Section title="만족도 조사" icon="star">
      <div className="survey" data-noswipe>
        {survey.intro?.trim() ? <p className="survey__intro">{rich(survey.intro)}</p> : null}
        {questions.length ? (
          <p className="survey__scale">
            <span>1 {SCORE_LABEL[1]}</span>
            <span>5 {SCORE_LABEL[5]}</span>
          </p>
        ) : null}
        {survey.groups.map((g) => (
          <fieldset key={g.id} className="survey__group">
            <legend className="survey__title">{rich(g.title)}</legend>
            {g.questions.map((q) => (
              <div key={q.id} className="survey__q" data-missing={(missing && !validScore(st.scores[q.id])) || undefined} role="radiogroup" aria-label={q.text}>
                <p className="survey__text">{rich(q.text)}</p>
                <div className="scores">
                  {SCORES.map((v) => (
                    <label key={v} className="score" data-on={st.scores[q.id] === v || undefined}>
                      <input type="radio" name={q.id} checked={st.scores[q.id] === v} aria-label={`${v}점 ${SCORE_LABEL[v]}`} onChange={() => setSt((s) => ({ ...s, scores: { ...s.scores, [q.id]: v } }))} />
                      <span className="mono" aria-hidden="true">
                        {v}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {g.comment ? (
              <div className="survey__comment">
                <p className="survey__text">
                  {rich(g.comment.prompt?.trim() || DEFAULT_COMMENT)} <span className="survey__opt">쓰지 않아도 돼요</span>
                </p>
                <AutoTextarea key={g.id} value={st.comments[g.id] ?? ''} onSave={(t) => setSt((s) => ({ ...s, comments: { ...s.comments, [g.id]: t.slice(0, COMMENT_MAX) } }))} maxLength={COMMENT_MAX} rows={3} label={`${g.title} 자유 의견`} />
              </div>
            ) : null}
          </fieldset>
        ))}
        {missing && left ? (
          <p className="form-error" role="alert">
            아직 고르지 않은 문항이 {left}개 있어요.
          </p>
        ) : null}
        {complete ? (
          <p className="form-ok" role="status">
            만족도 조사를 마쳤어요. 답을 바꿔도 돼요. 아래에서 파일을 저장해 선생님께 내 주세요.
          </p>
        ) : questions.length ? (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              if (!allScored(doc, st)) return setMissing(true)
              setMissing(false)
              setSt((s) => ({ ...s, submittedAt: new Date().toISOString() }))
            }}
          >
            <Icon name="check" size="1.1rem" /> 만족도 조사 마치기
          </button>
        ) : null}
      </div>
    </Section>
  )
}

/**
 * 여행 마지막 일정 이후, 만족도 조사를 아직 마치지 않은 학생에게 띄우는 안내.
 * 닫으면 10분 뒤 다시 뜨고, 다른 창이 떠 있거나 조사 화면을 보는 동안에는 뜨지 않는다.
 */
export function SurveyReminder({ blocked }: { blocked: boolean }) {
  const { doc, d, at, role, scope } = useTrip()
  const [st] = useSurveyState(scope)
  const [snoozedUntil, setSnoozedUntil] = useState(0)
  const [, wake] = useState(0)
  useEffect(() => {
    const ms = snoozedUntil - Date.now()
    if (ms <= 0) return
    const t = window.setTimeout(() => wake((n) => n + 1), ms + 50)
    return () => window.clearTimeout(t)
  }, [snoozedUntil])
  if (role !== 'student' || blocked || !surveyQuestions(doc).length) return null
  if (at < surveyOpensAt(d) || isSurveyComplete(doc, st) || Date.now() < snoozedUntil) return null
  const snooze = () => setSnoozedUntil(Date.now() + SURVEY_SNOOZE_MS)
  return (
    <Dialog
      title="만족도 조사에 참여해 주세요"
      onClose={snooze}
      foot={
        <>
          <button type="button" className="btn btn--ghost" onClick={snooze}>
            닫기
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              snooze()
              goTo('after')
            }}
          >
            참여하기
          </button>
        </>
      }
    >
      <p className="body-text">이번 여행은 어땠나요? 다녀와서 장에서 잠깐이면 답할 수 있어요.</p>
      <p className="fineprint">마칠 때까지 다시 알려 드려요. 닫으면 10분 뒤에 다시 보여요.</p>
    </Dialog>
  )
}
