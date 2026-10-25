"use client"

// The agent's legwork under the situation (Henry, 25 Oct, h22): one grey line with a tick, the step
// that says most and how many more ("Called Calverona Hamburg in German at 12:01, and 6 more steps"),
// opening to every step in the decide:07 log style with its time.

import { useState } from "react"
import { CardLog, type Legwork } from "./card-log"
import { Icon } from "./icons"

export function CardLegwork({ work, caseId }: { work: Legwork; caseId: string }) {
  const [open, setOpen] = useState(false)
  const id = `legwork-${caseId}`
  return (
    <div className={`clegwork${open ? " open" : ""}`}>
      <button type="button" className="clegwork-line" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="check" size={16} />
        <span>
          {open ? `What the agent did, ${work.more + 1} ${work.more === 0 ? "step" : "steps"}` : work.lead}
          {!open && work.more > 0 && `, and ${work.more} more ${work.more === 1 ? "step" : "steps"}`}
          <span className="clegwork-chev">
            <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
          </span>
        </span>
      </button>
      {open && <CardLog rows={work.rows} id={id} />}
    </div>
  )
}
