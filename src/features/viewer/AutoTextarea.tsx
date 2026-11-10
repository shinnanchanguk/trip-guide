import { useEffect, useRef, useState } from 'react'

/**
 * 쓰는 대로 저장하는 글 칸(활동지 답·메모·자유 의견). 잠깐 멈추면 저장하고, 칸을 떠나거나 장을 넘길 때도 저장한다.
 * 칸마다 key 를 달아 쓴다(다른 칸의 글이 섞이지 않게).
 */
export function AutoTextarea({ value, onSave, maxLength, rows = 4, placeholder, label, className = 'reflect__input' }: { value: string; onSave: (text: string) => void; maxLength: number; rows?: number; placeholder?: string; label: string; className?: string }) {
  const [text, setText] = useState(value)
  const timer = useRef<number | null>(null)
  const latest = useRef(text)
  latest.current = text
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  // 다른 탭에서 바뀌면 따라간다(입력 중이 아닐 때)
  useEffect(() => {
    if (timer.current == null) setText(value)
  }, [value])

  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        saveRef.current(latest.current)
      }
    },
    [],
  )

  const flush = () => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
      saveRef.current(latest.current)
    }
  }

  return (
    <textarea
      className={className}
      rows={rows}
      value={text}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onBlur={flush}
      onChange={(e) => {
        setText(e.target.value)
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          timer.current = null
          saveRef.current(latest.current)
        }, 500)
      }}
    />
  )
}
