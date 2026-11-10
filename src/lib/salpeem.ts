/**
 * 모은 느낀 점 → 살핌 설문 양식 엑셀.
 *
 * 살핌(생기부 AI)은 첫 시트를 읽고, 첫 줄을 '학번 · 이름 · 질문…'으로, 그 아래 한 줄을 학생 한 명으로 본다.
 * 학번과 이름이 살핌 명단과 둘 다 맞아야 받으므로 학번은 여행 설정의 자릿수(4: G1C1N2, 5: G1C2N2)로 둔다.
 * 살핌은 응답을 '질문: 답' 줄로 다시 읽어 첫 쌍점에서 가르므로 질문 제목에는 쌍점·줄바꿈을 두지 않고,
 * 통째로 건너뛰는 칸 제목 낱말(타임스탬프·이메일·응답시간·제출시간)도 남기지 않는다.
 * 둘째 시트 '모아 보기'는 사람이 읽기 좋게 학생·장소마다 한 줄씩 둔다.
 */
import type { Derived, StopPage } from '../trip/derive'
import { DEFAULT_PROMPT } from '../trip/derive'
import type { Collected } from './collect'
import { dateLabel } from './time'

export const SALPEEM_SHEET = '설문응답'
export const READ_SHEET = '모아 보기'
export const MISSION_SHEET = '활동지'
export const SURVEY_SUMMARY_SHEET = '만족도 요약'
export const SURVEY_ANSWER_SHEET = '만족도 응답'

const SKIP_WORDS: [RegExp, string][] = [
  [/타임스탬프/g, '타임 스탬프'],
  [/timestamp/gi, 'time stamp'],
  [/제출시간/g, '제출 시간'],
  [/응답시간/g, '응답 시간'],
  [/이메일/g, '메일'],
  [/email/gi, 'e-mail'],
]
const CELL_MAX = 32000

/** 줄바꿈을 한 칸으로 접고, 엑셀이 문자로 되읽는 '_xHHHH_' 의 밑줄을 바꾼다(글 칸은 문자 칸으로만 쓰므로 = 로 시작해도 수식이 되지 않는다) */
export function oneLine(s: string): string {
  return s
    .replace(/_(?=x[0-9a-f]{4}_)/gi, '\uFF3F')
    .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function salpeemQuestion(p: StopPage): string {
  const where = p.stop.place?.name ?? p.stop.title
  const prompt = p.stop.reflect?.prompt?.trim() || DEFAULT_PROMPT
  let q = oneLine(`[${p.dayN}일차 ${where}] ${prompt}`).replace(/\s*[:：]\s*/g, ' · ')
  for (const [re, to] of SKIP_WORDS) q = q.replace(re, to)
  return q
}

export function salpeemRows(c: Collected): string[][] {
  const header = ['학번', '이름', ...c.questions.map(salpeemQuestion)]
  const rows = c.students
    .map((s) => [oneLine(s.no).slice(0, 10), oneLine(s.name).slice(0, 30), ...c.questions.map((q) => oneLine(s.answers.get(q.stop.id) ?? '').slice(0, CELL_MAX))])
    .filter((r) => r.slice(2).some(Boolean))
  return [header, ...rows]
}

export function readableRows(d: Derived, c: Collected): string[][] {
  const out: string[][] = [['학번', '이름', '일차', '날짜·시각', '장소', '질문', '느낀 점']]
  for (const s of c.students) {
    for (const q of c.questions) {
      const a = s.answers.get(q.stop.id)
      if (!a) continue
      out.push([s.no, s.name, `${q.dayN}일차`, `${dateLabel(q.chapter.date!)} ${q.stop.time}`, q.stop.place?.name ?? q.stop.title, q.stop.reflect?.prompt?.trim() || DEFAULT_PROMPT, a.slice(0, CELL_MAX)])
    }
  }
  void d
  return out
}

/** 글자 칸 하나: 줄바꿈을 접고 상한으로 자른다(모든 값을 글자로 둔다) */
const cell = (s: string) => oneLine(s).slice(0, CELL_MAX)

/** 활동지 시트: 학생·미션마다 한 줄. 살핌 첫 시트와 섞지 않는다 */
export function missionRows(c: Collected): string[][] {
  const out: string[][] = [['학번', '이름', '일차', '장소', '미션', '답']]
  for (const s of c.students) {
    for (const { mission, page } of c.missionItems) {
      const a = s.missions.get(mission.id)
      if (!a) continue
      out.push([cell(s.no), cell(s.name), `${page.dayN}일차`, cell(page.stop.place?.name ?? page.stop.title), cell(mission.title), cell(a)])
    }
  }
  return out
}

export type SurveySummary = { id: string; group: string; text: string; n: number; avg: number | null }

/** 문항별 평균(소수 둘째 자리)과 응답 수. 답하지 않은 학생은 세지 않는다 */
export function summarizeSurvey(c: Collected): SurveySummary[] {
  return (c.survey?.groups ?? []).flatMap((g) =>
    g.questions.map((q) => {
      const vals = c.students.flatMap((s) => (s.survey?.scores.has(q.id) ? [s.survey.scores.get(q.id)!] : []))
      return { id: q.id, group: g.title, text: q.text, n: vals.length, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null }
    }),
  )
}

export function surveySummaryRows(c: Collected): string[][] {
  return [['묶음', '문항', '평균(5점 만점)', '응답 수'], ...summarizeSurvey(c).map((q) => [cell(q.group), cell(q.text), q.avg === null ? '' : String(q.avg), String(q.n)])]
}

/** 학생별 응답: 문항마다 한 칸, 자유 의견은 묶음 끝에 한 칸 */
export function surveyAnswerRows(c: Collected): string[][] {
  const cols = (c.survey?.groups ?? []).flatMap((g) => [
    ...g.questions.map((q) => ({ head: `[${g.title}] ${q.text}`, value: (s: Collected['students'][number]) => String(s.survey?.scores.get(q.id) ?? '') })),
    ...(g.comment ? [{ head: `[${g.title}] 자유 의견`, value: (s: Collected['students'][number]) => s.survey?.comments.get(g.id) ?? '' }] : []),
  ])
  const rows = c.students
    .filter((s) => s.survey && (s.survey.scores.size || s.survey.comments.size))
    .map((s) => [cell(s.no), cell(s.name), ...cols.map((col) => cell(col.value(s)))])
  return [['학번', '이름', ...cols.map((col) => cell(col.head))], ...rows]
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function salpeemWorkbook(d: Derived, c: Collected): Promise<Blob> {
  const XLSX = await import('xlsx')
  const rows = salpeemRows(c)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = rows[0].map((_, i) => ({ wch: i === 0 ? 7 : i === 1 ? 9 : 40 }))
  const read = readableRows(d, c)
  const ws2 = XLSX.utils.aoa_to_sheet(read)
  ws2['!cols'] = [{ wch: 7 }, { wch: 9 }, { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 80 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SALPEEM_SHEET)
  XLSX.utils.book_append_sheet(wb, ws2, READ_SHEET)
  // 활동지·만족도는 뒤쪽 시트로만 둔다(살핌은 첫 시트만 읽는다)
  const addSheet = (rows: string[][], name: string, widths: number[]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, sheet, name)
  }
  if (c.missionItems.length) addSheet(missionRows(c), MISSION_SHEET, [7, 9, 6, 18, 24, 80])
  if (c.survey?.groups.length) {
    addSheet(surveySummaryRows(c), SURVEY_SUMMARY_SHEET, [14, 50, 14, 8])
    const answers = surveyAnswerRows(c)
    addSheet(answers, SURVEY_ANSWER_SHEET, answers[0].map((_, i) => (i < 2 ? 9 : 26)))
  }
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([data], { type: XLSX_TYPE })
}
