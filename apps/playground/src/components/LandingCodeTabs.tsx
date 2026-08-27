'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

interface LandingCodeTabsProps {
  label: string
  panels: readonly ReactNode[]
  tabs: readonly string[]
}

export function LandingCodeTabs({ label, panels, tabs }: LandingCodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const baseId = useId()
  const tabButtonRef = useRef<Array<HTMLButtonElement | null>>([])

  function activate(index: number) {
    setActiveIndex(index)
    tabButtonRef.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined

    if (event.key === 'ArrowRight')
      nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home')
      nextIndex = 0
    else if (event.key === 'End')
      nextIndex = tabs.length - 1

    if (nextIndex === undefined)
      return

    event.preventDefault()
    activate(nextIndex)
  }

  return (
    <div className="landing-code-tabs">
      <div aria-label={label} className="landing-code-tab-list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${baseId}-panel-${index}`}
            aria-selected={activeIndex === index}
            id={`${baseId}-tab-${index}`}
            key={tab}
            onClick={() => setActiveIndex(index)}
            onKeyDown={event => handleKeyDown(event, index)}
            ref={(element) => { tabButtonRef.current[index] = element }}
            role="tab"
            tabIndex={activeIndex === index ? 0 : -1}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={activeIndex !== index}
          id={`${baseId}-panel-${index}`}
          key={tabs[index]}
          role="tabpanel"
          tabIndex={0}
        >
          {panel}
        </div>
      ))}
    </div>
  )
}
