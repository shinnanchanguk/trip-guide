/**
 * 학생·선생님이 이 기기에 남기는 것들: 활동지 답, 개인 메모, 만족도 답, 선생님 할 일 체크.
 * 서버로 보내지 않는다. 활동지·만족도 답은 학생이 저장하는 파일에 함께 담기고, 메모와 체크는 파일에도 담지 않는다.
 */
import { useCallback } from 'react'
import { useStored } from './storage'
import type { Derived } from '../trip/derive'
import type { TripDoc } from '../trip/schema'
import { instant } from './time'

export const MISSION_MAX = 2000
export const NOTE_MAX = 3000
export const COMMENT_MAX = 2000
export const DEFAULT_COMMENT = '좋았던 점이나 아쉬웠던 점을 자유롭게 적어 주세요.'
export const SURVEY_SNOOZE_MS = 10 * 60 * 1000
export const SCORE_LABEL: Record<number, string> = { 1: '전혀 아니에요', 2: '아니에요', 3: '보통이에요', 4: '그래요', 5: '매우 그래요' }

export type Written = { text: string; updatedAt: string }
export type MissionBook = Record<string, Written>
export type NoteBook = Record<string, Written>
export type SurveyState = { scores: Record<string, number>; comments: Record<string, string>; submittedAt?: string }

const EMPTY_SURVEY: SurveyState = { scores: {}, comments: {} }

/** 한 칸만 고치고 나머지 칸은 그대로 두는 저장 */
function useWrittenBook(key: string, max: number): [Record<string, Written>, (id: string, text: string | null) => void, (b: Record<string, Written>) => void] {
  const [book, setBook] = useStored<Record<string, Written>>(key, {})
  const save = useCallback(
    (id: string, text: string | null) =>
      setBook((prev) => {
        const next = { ...prev }
        if (text && text.trim()) next[id] = { text: text.slice(0, max), updatedAt: new Date().toISOString() }
        else delete next[id]
        return next
      }),
    [setBook, max],
  )
  return [book, save, setBook]
}

export const useMissions = (scope: string) => useWrittenBook(`missions:${scope}`, MISSION_MAX)
export const useNotes = (scope: string) => useWrittenBook(`notes:${scope}`, NOTE_MAX)

export function useSurveyState(scope: string) {
  return useStored<SurveyState>(`survey:${scope}`, EMPTY_SURVEY)
}

export const validScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5

export function surveyQuestions(doc: TripDoc) {
  return (doc.survey?.groups ?? []).flatMap((g) => g.questions.map((q) => ({ ...q, groupId: g.id, groupTitle: g.title })))
}

/** 5점 문항을 모두 골랐는지(자유 의견은 쓰지 않아도 된다) */
export function allScored(doc: TripDoc, st: SurveyState | undefined): boolean {
  const qs = surveyQuestions(doc)
  return qs.length > 0 && qs.every((q) => validScore(st?.scores[q.id]))
}

/** 다 답하고 「마치기」까지 눌렀는지. 나중에 문항이 늘면 다시 false 가 된다 */
export function isSurveyComplete(doc: TripDoc, st: SurveyState | undefined): boolean {
  return !!st?.submittedAt && allScored(doc, st)
}

/** 만족도 안내를 띄우기 시작하는 때: 마지막 일정 시작(적어도 마지막 날). 일정이 없으면 마지막 날이 끝날 때 */
export function surveyOpensAt(d: Derived): Date {
  if (!d.stopPages.length) return instant(d.endDate, '23:59', d.doc.tz)
  const lastDay = instant(d.endDate, '00:00', d.doc.tz).getTime()
  return new Date(Math.max(lastDay, ...d.stopPages.map((p) => p.start.getTime())))
}
