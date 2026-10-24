"use client"

import { BareFrame } from "./_ui/bare-frame"

/** Failure is never shown as an empty desk. */
export default function ControlRoomError({ reset }: { error: Error; reset: () => void }) {
  return (
    <BareFrame title="Control room">
      <div className="state" role="alert">
        <h2 className="t-headline">This page could not load.</h2>
        <p className="t-body">Nothing was changed, sent or booked. Your cases are where you left them.</p>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </div>
    </BareFrame>
  )
}
