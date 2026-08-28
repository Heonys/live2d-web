const SCROLL_REGION_SELECTOR = '[data-page-scroll-region]'

let lockCount = 0
let lastTouchY: number | undefined

function getScrollRegion(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>(SCROLL_REGION_SELECTOR)
    : null
}

function canScroll(region: HTMLElement, deltaY: number) {
  if (deltaY === 0)
    return true
  if (deltaY < 0)
    return region.scrollTop > 0
  return region.scrollTop + region.clientHeight < region.scrollHeight - 1
}

function handleTouchStart(event: TouchEvent) {
  lastTouchY = event.touches[0]?.clientY
}

function handleTouchMove(event: TouchEvent) {
  const touchY = event.touches[0]?.clientY
  if (touchY === undefined)
    return

  const previousTouchY = lastTouchY ?? touchY
  lastTouchY = touchY
  const region = getScrollRegion(event.target)
  const deltaY = previousTouchY - touchY
  if (!region || !canScroll(region, deltaY))
    event.preventDefault()
}

function handleTouchEnd() {
  lastTouchY = undefined
}

function handleWheel(event: WheelEvent) {
  const region = getScrollRegion(event.target)
  if (!region || !canScroll(region, event.deltaY))
    event.preventDefault()
}

function addScrollGuards() {
  document.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd, { passive: true })
  document.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  document.addEventListener('wheel', handleWheel, { passive: false })
  document.documentElement.dataset.pageScrollLocked = 'true'
}

function removeScrollGuards() {
  document.removeEventListener('touchstart', handleTouchStart)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
  document.removeEventListener('touchcancel', handleTouchEnd)
  document.removeEventListener('wheel', handleWheel)
  delete document.documentElement.dataset.pageScrollLocked
  lastTouchY = undefined
}

export function lockPageScroll() {
  let released = false
  if (lockCount === 0)
    addScrollGuards()
  lockCount += 1

  return () => {
    if (released)
      return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0)
      removeScrollGuards()
  }
}
