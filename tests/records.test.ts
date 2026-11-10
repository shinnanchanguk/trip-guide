import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TripDoc, emptyTrip, type TripDoc as TripDocT } from '../src/trip/schema.js'
import { derive } from '../src/trip/derive.js'
import { findPii } from '../src/lib/pii.js'
import { buildFileData, buildReflectionText, parseReflectionFile, DATA_TAG, type Writings } from '../src/lib/reflectionFile.js'
import { collect } from '../src/lib/collect.js'
import { missionRows, salpeemRows, salpeemWorkbook, surveyAnswerRows, surveySummaryRows, summarizeSurvey } from '../src/lib/salpeem.js'
import { isSurveyComplete, surveyOpensAt, surveyQuestions } from '../src/lib/records.js'
import { normalizeDoc } from '../src/features/editor/normalize.js'
import { instant } from '../src/lib/time.js'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const ID = 'trip123456'
const ME = { no: '1103', name: '김가람' }

function trip(): TripDocT {
  const d = emptyTrip({ title: '경주 수학여행', startDate: '2026-10-21', nights: 1, tz: 'Asia/Seoul', studentIdDigits: 4 })
  d.days[0].stops.push({
    id: 'aaaaaa1', time: '10:00', title: '불국사', kind: 'activity', place: { name: '불국사', coords: [129.33, 35.79] }, reflect: { on: true },
    missions: [{ id: 'mission1', title: '탑 비교하기', prompt: '두 탑의 다른 점' }, { id: 'mission2', title: '돌 세기' }],
    teacherTasks: ['인원 확인', '입장권 나눠 주기'],
  })
  d.days[1].stops.push({ id: 'aaaaaa2', time: '09:00', title: '마을', kind: 'activity', place: { name: '양동마을', coords: [129.25, 35.99] }, missions: [{ id: 'mission3', title: '집 찾기' }] })
  d.survey = {
    intro: '솔직하게 답해 주세요.',
    groups: [
      { id: 'group001', title: '숙소', questions: [{ id: 'quest001', text: '방이 깨끗했어요' }, { id: 'quest002', text: '식사가 좋았어요' }], comment: { prompt: '숙소 의견' } },
      { id: 'group002', title: '프로그램', questions: [{ id: 'quest003', text: '배울 것이 많았어요' }] },
    ],
  }
  return d
}

const writings = (over: Partial<Writings> = {}): Writings => ({
  missions: { mission1: { text: '다보탑은 화려해요\n석가탑은 단정해요', updatedAt: '2026-10-21T02:00:00Z' } },
  survey: { scores: { quest001: 5, quest002: 3, quest003: 4 }, comments: { group001: '방이 따뜻했어요' }, submittedAt: '2026-10-23T02:00:00Z' },
  ...over,
})
const fileText = (doc: TripDocT, w: Writings = writings(), me = ME, at = '2026-10-23T03:00:00Z') => {
  const d = derive(doc)
  return buildReflectionText(d, buildFileData(d, ID, me, { aaaaaa1: { text: '탑을 봤어요', updatedAt: 'x' } }, at, w))
}

test('옛 안내 문서(새 칸 없음)는 그대로 읽히고 값이 바뀌지 않는다', () => {
  const raw = JSON.parse(fixture('v1-trip.json'))
  const doc = TripDoc.parse(raw)
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), raw)
  assert.equal(doc.survey, undefined)
  assert.equal(doc.days[0].stops[0].missions, undefined)
  const d = derive(doc)
  assert.equal(d.pages.at(-1)?.key, 'after')
  assert.equal(surveyQuestions(doc).length, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeDoc(doc))), raw)
})

test('이미 내려받은 v1 학생 파일은 그대로 읽히고 모아진다', () => {
  const doc = TripDoc.parse(JSON.parse(fixture('v1-trip.json')))
  const r = parseReflectionFile(fixture('v1-student-file.txt'))
  assert.ok(r.ok && !r.fromText)
  if (!r.ok) return
  assert.equal(r.data.v, 1)
  assert.equal(r.data.missions, undefined)
  assert.equal(r.data.survey, undefined)
  const c = collect(derive(doc), ID, [{ name: 'a.txt', text: fixture('v1-student-file.txt') }])
  assert.equal(c.students[0].answers.get('aaaaaa1'), '첫 줄\n둘째 줄')
  assert.equal(c.students[0].answers.get('aaaaaa2'), '마을을 걸었다')
  assert.deepEqual(c.students[0].warnings, [])
  assert.equal(c.students[0].missions.size, 0)
  assert.equal(c.students[0].survey, null)
})

test('v1 파일의 정보 줄이 지워져도 본문으로 읽힌다', () => {
  const cut = fixture('v1-student-file.txt').split('\n').filter((l) => !l.startsWith(DATA_TAG)).join('\n')
  const r = parseReflectionFile(cut)
  assert.ok(r.ok && r.fromText)
  assert.equal(r.ok && r.data.items.length, 2)
})

test('새 파일은 활동지·만족도를 담아 왕복한다', () => {
  const doc = trip()
  const r = parseReflectionFile(fileText(doc))
  assert.ok(r.ok && !r.fromText)
  if (!r.ok) return
  assert.equal(r.data.missions?.length, 1)
  assert.equal(r.data.missions?.[0].a, '다보탑은 화려해요\n석가탑은 단정해요')
  assert.deepEqual(r.data.survey?.scores, { quest001: 5, quest002: 3, quest003: 4 })
  assert.equal(r.data.survey?.comments.group001, '방이 따뜻했어요')
  assert.equal(r.data.survey?.done, true)
})

test('정보 줄이 지워진 새 파일: 활동지·만족도 절을 느낀 점으로 착각하지 않는다', () => {
  const doc = trip()
  const cut = fileText(doc).split('\n').filter((l) => !l.startsWith(DATA_TAG)).join('\n')
  assert.ok(cut.includes('다보탑은 화려해요'))
  assert.ok(cut.includes('방이 따뜻했어요'))
  const r = parseReflectionFile(cut)
  assert.ok(r.ok && r.fromText)
  if (!r.ok) return
  assert.deepEqual(r.data.items.map((i) => [i.d, i.t, i.a]), [[1, '불국사', '탑을 봤어요']])
  const c = collect(derive(doc), ID, [{ name: 'a.txt', text: cut }])
  assert.equal(c.students[0].answers.get('aaaaaa1'), '탑을 봤어요')
  assert.ok(c.students[0].warnings.some((w) => w.includes('활동지')))
})

test('느낀 점에 없고 활동지만 있는 파일도 본문에서 느낀 점 0개로 읽는다', () => {
  const doc = trip()
  const d = derive(doc)
  const text = buildReflectionText(d, buildFileData(d, ID, ME, {}, '2026-10-23T03:00:00Z', writings()))
  const cut = text.split('\n').filter((l) => !l.startsWith(DATA_TAG)).join('\n')
  const r = parseReflectionFile(cut)
  assert.ok(r.ok)
  assert.equal(r.ok && r.data.items.length, 0)
})

test('파일에서 읽은 값은 상한으로 자르고, 망가진 새 절이 느낀 점을 해치지 않는다', () => {
  const doc = trip()
  const d = derive(doc)
  const data = buildFileData(d, ID, ME, { aaaaaa1: { text: '글', updatedAt: 'x' } }, '2026-10-23T03:00:00Z') as unknown as Record<string, unknown>
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const long = 'ㄱ'.repeat(9000)
  const r1 = parseReflectionFile(`${DATA_TAG} ${b64({ ...data, missions: [{ id: 'mission1', a: long, u: long }], survey: { scores: {}, comments: { group001: long } } })}`)
  assert.ok(r1.ok && !r1.fromText)
  if (!r1.ok) return
  assert.equal(r1.data.missions?.[0].a.length, 2000)
  assert.equal(r1.data.survey?.comments.group001.length, 2000)
  const r2 = parseReflectionFile(`${DATA_TAG} ${b64({ ...data, missions: 'x', survey: 7 })}`)
  assert.ok(r2.ok && !r2.fromText)
  if (!r2.ok) return
  assert.equal(r2.data.items.length, 1)
  assert.equal(r2.data.missions, undefined)
  assert.equal(r2.data.survey, undefined)
})

test('글 속에 정보 줄처럼 쓴 줄이 있어도 맨 끝 정보 줄을 읽는다', () => {
  const doc = trip()
  const w = writings({ missions: { mission1: { text: `${DATA_TAG} AAAA`, updatedAt: 'x' } } })
  const r = parseReflectionFile(fileText(doc, w))
  assert.ok(r.ok && !r.fromText)
})

test('모으기: 활동지·점수·의견을 학생별로, 일정에 없는 답과 이상한 점수는 뺀다', () => {
  const doc = trip()
  // 학생이 파일을 저장한 뒤 선생님이 미션을 지운 경우
  const before = trip()
  before.days[0].stops[0].missions!.push({ id: 'gone0001', title: '사라진 미션' })
  const data = buildFileData(derive(before), ID, ME, { aaaaaa1: { text: '글', updatedAt: 'x' } }, '2026-10-23T03:00:00Z', { missions: { mission1: { text: '답', updatedAt: 'x' }, gone0001: { text: '사라진', updatedAt: 'x' } } })
  // 손으로 고친 파일처럼 점수를 망가뜨린다
  const tampered = { ...data, survey: { scores: { quest001: 5, quest002: 9, quest003: 2.5, gone0002: 4 }, comments: { nogroup1: '없는 묶음' }, done: true } }
  const text = `${DATA_TAG} ${Buffer.from(JSON.stringify(tampered)).toString('base64url')}`
  const c = collect(derive(doc), ID, [{ name: 'a.txt', text }])
  const s = c.students[0]
  assert.equal(s.missions.get('mission1'), '답')
  assert.equal(s.missions.size, 1)
  assert.deepEqual([...s.survey!.scores], [['quest001', 5]])
  assert.equal(s.survey!.comments.size, 0)
  assert.ok(s.warnings.some((x) => x.includes('활동지')))
})

test('같은 학번이면 늦게 저장한 파일의 활동지·만족도를 쓴다', () => {
  const doc = trip()
  const older = fileText(doc, writings({ survey: { scores: { quest001: 1 }, comments: {} } }), ME, '2026-10-22T00:00:00Z')
  const newer = fileText(doc, writings({ survey: { scores: { quest001: 5 }, comments: {} } }), ME, '2026-10-24T00:00:00Z')
  const c = collect(derive(doc), ID, [{ name: 'new.txt', text: newer }, { name: 'old.txt', text: older }])
  assert.equal(c.students.length, 1)
  assert.equal(c.students[0].survey?.scores.get('quest001'), 5)
})

test('문항별 평균·응답 수(빈 답은 세지 않고 소수 둘째 자리까지)', () => {
  const doc = trip()
  const a = fileText(doc, writings({ survey: { scores: { quest001: 5, quest002: 4 }, comments: {} } }), { no: '1101', name: '가나' })
  const b = fileText(doc, writings({ survey: { scores: { quest001: 4 }, comments: {} } }), { no: '1102', name: '다라' })
  const e = fileText(doc, writings({ survey: { scores: { quest001: 4 }, comments: {} } }), { no: '1104', name: '마바' })
  const c = collect(derive(doc), ID, [{ name: 'a', text: a }, { name: 'b', text: b }, { name: 'e', text: e }])
  const sum = summarizeSurvey(c)
  assert.deepEqual(sum.map((q) => [q.id, q.n, q.avg]), [['quest001', 3, 4.33], ['quest002', 1, 4], ['quest003', 0, null]])
  const rows = surveySummaryRows(c)
  assert.deepEqual(rows[1], ['숙소', '방이 깨끗했어요', '4.33', '3'])
  assert.deepEqual(rows[3], ['프로그램', '배울 것이 많았어요', '', '0'])
  assert.ok(rows.flat().every((v) => typeof v === 'string'))
})

test('살핌 첫 시트는 느낀 점 전용: 활동지·만족도가 끼어들지 않는다', () => {
  const doc = trip()
  const c = collect(derive(doc), ID, [{ name: 'a', text: fileText(doc) }])
  const rows = salpeemRows(c)
  assert.equal(rows[0].length, 3)
  assert.deepEqual(rows[0].slice(0, 2), ['학번', '이름'])
  assert.equal(rows.length, 2)
  assert.equal(rows[1][2], '탑을 봤어요')
  assert.ok(!JSON.stringify(rows).includes('다보탑'))
  // 느낀 점이 없는 학생은 첫 시트에 들어가지 않아도 활동지 시트에는 들어간다
  const d = derive(doc)
  const only = buildReflectionText(d, buildFileData(d, ID, ME, {}, '2026-10-23T03:00:00Z', writings()))
  const c2 = collect(d, ID, [{ name: 'a', text: only }])
  assert.equal(salpeemRows(c2).length, 1)
  assert.equal(missionRows(c2).length, 2)
})

test('활동지·응답 시트: 한 줄 글자 칸, 엑셀 이스케이프 차단, 첫 줄 제목', () => {
  const doc = trip()
  const w = writings({
    missions: { mission1: { text: '첫째\n=SUM(1) _x000A_', updatedAt: 'x' } },
    survey: { scores: { quest001: 5 }, comments: { group001: '의견\n둘째' } },
  })
  const c = collect(derive(doc), ID, [{ name: 'a', text: fileText(doc, w) }])
  const m = missionRows(c)
  assert.deepEqual(m[0], ['학번', '이름', '일차', '장소', '미션', '답'])
  assert.deepEqual(m[1].slice(0, 5), ['1103', '김가람', '1일차', '불국사', '탑 비교하기'])
  assert.ok(!m[1][5].includes('\n'))
  assert.ok(!m[1][5].includes('_x000A_'))
  assert.ok(m[1][5].includes('=SUM(1)'))
  const a = surveyAnswerRows(c)
  assert.deepEqual(a[0].slice(0, 2), ['학번', '이름'])
  assert.equal(a[0][2], '[숙소] 방이 깨끗했어요')
  assert.ok(a[0].includes('[숙소] 자유 의견'))
  assert.equal(a[1][2], '5')
  assert.equal(a[1][a[0].indexOf('[숙소] 자유 의견')], '의견 둘째')
  assert.ok([...m, ...a].flat().every((v) => typeof v === 'string'))
})

test('새 글자 칸은 빠짐없이 개인정보 검사를 받는다', () => {
  const PHONE = '010-1234-5678'
  const cases: ((d: TripDocT) => void)[] = [
    (d) => { d.days[0].stops[0].missions![0].title = PHONE },
    (d) => { d.days[0].stops[0].missions![0].prompt = PHONE },
    (d) => { d.days[0].stops[0].teacherTasks![1] = PHONE },
    (d) => { d.survey!.intro = PHONE },
    (d) => { d.survey!.groups[0].title = PHONE },
    (d) => { d.survey!.groups[1].questions[0].text = PHONE },
    (d) => { d.survey!.groups[0].comment!.prompt = PHONE },
  ]
  assert.equal(findPii(trip()).length, 0)
  cases.forEach((mutate, i) => {
    const d = trip()
    mutate(d)
    assert.ok(findPii(d).some((h) => h.kind === 'phone'), `case ${i}`)
  })
})

test('문서 상한: 개수·길이를 넘기면 저장하지 않는다(경계값)', () => {
  const ok = (mut: (d: TripDocT) => void) => {
    const d = trip()
    mut(d)
    return TripDoc.safeParse(d).success
  }
  const missions = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `mission${100 + i}`, title: '미션' }))
  assert.equal(ok((d) => { d.days[0].stops[0].missions = missions(10) }), true)
  assert.equal(ok((d) => { d.days[0].stops[0].missions = missions(11) }), false)
  assert.equal(ok((d) => { d.days[0].stops[0].missions![0].title = 'ㄱ'.repeat(60) }), true)
  assert.equal(ok((d) => { d.days[0].stops[0].missions![0].title = 'ㄱ'.repeat(61) }), false)
  assert.equal(ok((d) => { d.days[0].stops[0].missions![0].prompt = 'ㄱ'.repeat(301) }), false)
  assert.equal(ok((d) => { d.days[0].stops[0].teacherTasks = Array(20).fill('할 일') }), true)
  assert.equal(ok((d) => { d.days[0].stops[0].teacherTasks = Array(21).fill('할 일') }), false)
  assert.equal(ok((d) => { d.days[0].stops[0].teacherTasks = ['ㄱ'.repeat(201)] }), false)
  assert.equal(ok((d) => { d.survey!.intro = 'ㄱ'.repeat(401) }), false)
  assert.equal(ok((d) => { d.survey!.groups[0].questions = Array.from({ length: 21 }, (_, i) => ({ id: `quest${100 + i}`, text: '문항' })) }), false)
  assert.equal(ok((d) => { d.survey!.groups = Array.from({ length: 13 }, (_, i) => ({ id: `group${100 + i}`, title: '묶음', questions: [] })) }), false)
  assert.equal(ok((d) => { d.days[1].stops[0].missions![0].id = 'mission1' }), false)
})

test('편집 정리: 빈 미션·문항·묶음을 걷어 내고 비면 칸 자체를 뺀다', () => {
  const d = trip()
  d.days[0].stops[0].missions = [{ id: 'mission1', title: ' 탑 ', prompt: ' ' }, { id: 'mission2', title: '  ' }]
  d.days[0].stops[0].teacherTasks = [' 인원 확인 ', '  ']
  d.survey = { intro: ' ', groups: [{ id: 'group001', title: ' 숙소 ', questions: [{ id: 'quest001', text: ' 깨끗 ' }, { id: 'quest002', text: ' ' }], comment: { prompt: ' ' } }, { id: 'group002', title: ' ', questions: [{ id: 'quest003', text: ' ' }] }] }
  const n = normalizeDoc(d)
  assert.deepEqual(n.days[0].stops[0].missions, [{ id: 'mission1', title: '탑' }])
  assert.deepEqual(n.days[0].stops[0].teacherTasks, ['인원 확인'])
  assert.deepEqual(n.survey, { groups: [{ id: 'group001', title: '숙소', questions: [{ id: 'quest001', text: '깨끗' }], comment: {} }] })
  const e = trip()
  e.days[0].stops[0].missions = [{ id: 'mission1', title: ' ' }]
  e.days[0].stops[0].teacherTasks = [' ']
  e.survey = { groups: [{ id: 'group001', title: ' ', questions: [] }] }
  const n2 = normalizeDoc(e)
  assert.ok(!('missions' in n2.days[0].stops[0]))
  assert.ok(!('teacherTasks' in n2.days[0].stops[0]))
  assert.ok(!('survey' in n2))
  assert.equal(TripDoc.safeParse(n2).success, true)
})

test('만족도 안내는 마지막 일정부터, 일정이 없으면 마지막 날 끝에 시작하고 다 내면 끝난다', () => {
  const doc = trip()
  const d = derive(doc)
  assert.equal(surveyOpensAt(d).getTime(), instant('2026-10-22', '09:00', 'Asia/Seoul').getTime())
  const empty = derive(emptyTrip({ title: 'x', startDate: '2026-10-21', nights: 1, tz: 'Asia/Seoul', studentIdDigits: 4 }))
  assert.equal(surveyOpensAt(empty).getTime(), instant('2026-10-22', '23:59', 'Asia/Seoul').getTime())
  const all = { scores: { quest001: 5, quest002: 3, quest003: 4 }, comments: {}, submittedAt: 'x' }
  assert.equal(isSurveyComplete(doc, all), true)
  assert.equal(isSurveyComplete(doc, { ...all, submittedAt: undefined }), false)
  assert.equal(isSurveyComplete(doc, { ...all, scores: { quest001: 5, quest002: 3 } }), false)
  assert.equal(isSurveyComplete(emptyTrip({ title: 'x', startDate: '2026-10-21', nights: 1, tz: 'Asia/Seoul', studentIdDigits: 4 }), all), false)
})

test('고쳐 쓴 저장 시각으로 같은 학번의 진짜 파일을 밀어내지 못한다', () => {
  const doc = TripDoc.parse(trip())
  const d = derive(doc)
  const stop = d.doc.days[0].stops[0].id
  const book = { [stop]: { text: '진짜 글', updatedAt: '2026-10-21T01:00:00.000Z' } }
  const forged = { [stop]: { text: '위조한 글', updatedAt: '2026-10-21T01:00:00.000Z' } }
  const real = buildReflectionText(d, buildFileData(d, ID, ME, book, '2026-10-22T00:00:00.000Z'))
  const fake = buildReflectionText(d, buildFileData(d, ID, ME, forged, '9999'))
  const c = collect(d, ID, [{ name: 'real.txt', text: real }, { name: 'fake.txt', text: fake }])
  assert.equal(c.students.length, 1)
  assert.equal(c.students[0].answers.get(stop), '진짜 글')
  assert.equal(c.students[0].file, 'real.txt')
  const alone = collect(d, ID, [{ name: 'fake.txt', text: fake }])
  assert.ok(alone.students[0].warnings.some((w) => w.includes('저장한 때')))
})

test('살핌이 읽는 첫 시트는 언제나 설문응답이다', async () => {
  const doc = TripDoc.parse(trip())
  const d = derive(doc)
  const blob = await salpeemWorkbook(d, collect(d, ID, []))
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' })
  assert.equal(wb.SheetNames[0], '설문응답')
})

test('정보 줄이 지워진 파일의 글 속 머리 줄은 절 경계로 보지 않는다', () => {
  const doc = TripDoc.parse(trip())
  const d = derive(doc)
  const stop = d.doc.days[0].stops[0].id
  const book = { [stop]: { text: '===== 활동지 답 =====\n그 다음 이야기', updatedAt: '2026-10-21T01:00:00.000Z' } }
  const text = buildReflectionText(d, buildFileData(d, ID, ME, book, '2026-10-22T00:00:00.000Z'))
  const stripped = text.split('\n').filter((l) => !l.startsWith(DATA_TAG)).join('\n')
  const r = parseReflectionFile(stripped)
  assert.ok(r.ok)
  assert.equal(r.ok && r.data.items.length, 1)
  assert.ok(r.ok && r.data.items[0].a.includes('그 다음 이야기'))
})
