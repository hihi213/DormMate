"use client"

import type React from "react"

import { memo, useRef, useState } from "react"

type SwipeableCardProps = {
  children: React.ReactNode
  onClick?: () => void
  actions?: React.ReactNode
  className?: string
  revealWidth?: number // NEW: width to reveal when fully open
}

/**
 * Swipe-to-reveal actions (left-to-right).
 * - Horizontal swipe RIGHT reveals actions on the LEFT.
 * - Tap anywhere closes first; second tap triggers onClick.
 */
function SwipeableCard({ children, onClick, actions, className = "", revealWidth = 96 }: SwipeableCardProps) {
  const [offset, setOffset] = useState(0) // 0 or +maxReveal
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  const threshold = 24

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    dragging.current = true
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current || startX.current == null) return
    const dx = e.touches[0].clientX - startX.current
    // clamp to right swipe only
    const next = Math.max(0, Math.min(revealWidth, dx))
    setOffset(next)
  }
  function handleTouchEnd() {
    dragging.current = false
    // snap
    setOffset((cur) => (cur > threshold ? revealWidth : 0))
  }

  function handleClick() {
    // close first if revealed
    if (offset !== 0) {
      setOffset(0)
      return
    }
    onClick?.()
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Actions area (left) */}
      {actions && (
        <div className="absolute inset-y-0 left-0 flex items-stretch gap-1 pl-2 pr-2 bg-transparent pointer-events-none">
          <div className="my-2 flex items-center gap-2" style={{ width: offset }}>
            {/* Actions are clickable only when revealed */}
            <div className="flex gap-2 pointer-events-auto">{actions}</div>
          </div>
        </div>
      )}

      {/* Content */}
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left transition-transform"
        style={{ transform: `translateX(${offset}px)` }}
        aria-label="항목"
      >
        {children}
      </button>
    </div>
  )
}

export default memo(SwipeableCard)
