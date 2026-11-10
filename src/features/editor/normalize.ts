import { type Mission, type Stop, type Survey, type TripDoc } from '../../trip/schema'
import { orderStops } from '../../trip/order'

/** 저장 전에 빈 칸을 걷어 내고 일차 안 일정을 시각 순서로 둔다 */
export function normalizeDoc(doc: TripDoc): TripDoc {
  const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined)
  const stop = (s: Stop): Stop => {
    const out: Stop = { ...s, title: s.title.trim(), body: clean(s.body) }
    if (!out.body) delete out.body
    const rules = (s.rules ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 20)
    if (rules.length) out.rules = rules
    else delete out.rules
    const meet = { place: clean(s.meet?.place), time: s.meet?.time || undefined }
    if (meet.place || meet.time) out.meet = JSON.parse(JSON.stringify(meet))
    else delete out.meet
    if (s.leg) out.leg = JSON.parse(JSON.stringify({ ...s.leg, note: clean(s.leg.note) }))
    if (s.reflect && !s.reflect.on) delete out.reflect
    if (s.reflect?.on) out.reflect = JSON.parse(JSON.stringify({ on: true, prompt: clean(s.reflect.prompt) }))
    if (!s.end) delete out.end
    if (!s.zone) delete out.zone
    if (!s.dayShift) delete out.dayShift
    const missions = (s.missions ?? [])
      .map((m): Mission => ({ id: m.id, title: m.title.trim(), ...(clean(m.prompt) ? { prompt: clean(m.prompt) } : {}) }))
      .filter((m) => m.title || m.prompt)
    if (missions.length) out.missions = missions
    else delete out.missions
    const tasks = (s.teacherTasks ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20)
    if (tasks.length) out.teacherTasks = tasks
    else delete out.teacherTasks
    if (s.place) out.place = JSON.parse(JSON.stringify({ ...s.place, name: s.place.name.trim() || '이름 없는 곳', address: clean(s.place.address) }))
    return out
  }
  const out: TripDoc = {
    ...doc,
    title: doc.title.trim(),
    school: clean(doc.school),
    summary: clean(doc.summary),
    before: { notes: doc.before.notes.trim(), checklist: doc.before.checklist.map((c) => c.trim()).filter(Boolean).slice(0, 60) },
    after: { notes: doc.after.notes.trim() },
    announcements: doc.announcements.map((a) => ({ ...a, title: a.title.trim(), body: a.body.trim() })),
    days: doc.days.map((d, di) => ({ ...(clean(d.title) ? { title: clean(d.title) } : {}), stops: orderStops(doc, di, d.stops.map(stop)) })),
  }
  const survey = cleanSurvey(doc.survey, clean)
  if (survey) out.survey = survey
  else delete out.survey
  return out
}

/** 빈 문항·빈 묶음을 걷어 낸다. 받을 것이 하나도 없으면 만족도 조사 자체를 뺀다(문제가 있는 묶음은 남겨 저장할 때 알려 준다) */
function cleanSurvey(survey: Survey | undefined, clean: (s: string | undefined) => string | undefined): Survey | undefined {
  if (!survey) return undefined
  const groups = survey.groups
    .map((g) => ({
      id: g.id,
      title: g.title.trim(),
      questions: g.questions.map((q) => ({ id: q.id, text: q.text.trim() })).filter((q) => q.text),
      ...(g.comment ? { comment: clean(g.comment.prompt) ? { prompt: clean(g.comment.prompt) } : {} } : {}),
    }))
    .filter((g) => g.questions.length || (g.title && g.comment))
  if (!groups.length) return undefined
  const intro = clean(survey.intro)
  return { ...(intro ? { intro } : {}), groups }
}
