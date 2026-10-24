"use client"

/** Failure is never shown as an empty page. */
export default function ControlRoomError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="detail">
      <section className="question detail-inner" role="alert">
        <h1 className="l what">This page could not load.</h1>
        <p className="l ask quiet">Nothing was changed, sent or booked.</p>
        <div className="answers">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </section>
    </div>
  )
}
