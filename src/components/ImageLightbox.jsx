import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const MIN = 1
const MAX = 4
const STEP = 0.5

// Full-screen viewer: shows the whole picture (object-contain), zoom with the
// +/- buttons (bottom centre), the mouse wheel or the +/- keys, and drag to pan
// while zoomed. Esc or clicking the dark backdrop closes it.
export default function ImageLightbox({ images, index, onIndexChange, onClose, alt = '' }) {
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  const reset = useCallback(() => {
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }, [])

  const changeZoom = useCallback((delta) => {
    setZoom((z) => {
      const next = Math.min(MAX, Math.max(MIN, +(z + delta).toFixed(2)))
      if (next === MIN) setPos({ x: 0, y: 0 })
      return next
    })
  }, [])

  const go = useCallback(
    (dir) => {
      if (images.length < 2) return
      reset()
      onIndexChange((index + dir + images.length) % images.length)
    },
    [images.length, index, onIndexChange, reset]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') changeZoom(STEP)
      else if (e.key === '-' || e.key === '_') changeZoom(-STEP)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, changeZoom, go])

  function onPointerDown(e) {
    if (zoom === 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  function onPointerMove(e) {
    if (!drag.current) return
    setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
  }
  function onPointerUp() {
    drag.current = null
  }

  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[22px] font-semibold text-ink transition hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onWheel={(e) => changeZoom(e.deltaY < 0 ? 0.25 : -0.25)}
    >
      <button
        type="button"
        aria-label="Close image viewer"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-xl text-ink"
      >
        <Icon name="x" />
      </button>

      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous image" onClick={() => go(-1)} className={`${btn} absolute left-4 top-1/2 -translate-y-1/2`}>‹</button>
          <button type="button" aria-label="Next image" onClick={() => go(1)} className={`${btn} absolute right-4 top-1/2 -translate-y-1/2`}>›</button>
        </>
      )}

      <div
        className="flex h-full w-full items-center justify-center overflow-hidden p-6 pb-24"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <img
          src={images[index]}
          alt={alt}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoom === 1 ? changeZoom(1) : reset())}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
            transition: drag.current ? 'none' : 'transform .15s ease-out',
            touchAction: 'none',
          }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-STEP)} disabled={zoom <= MIN} className={btn}>−</button>
        <span className="min-w-[52px] rounded-full bg-black/60 px-3 py-1.5 text-center text-[13px] font-semibold text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" aria-label="Zoom in" onClick={() => changeZoom(STEP)} disabled={zoom >= MAX} className={btn}>+</button>
      </div>
    </div>
  )
}
