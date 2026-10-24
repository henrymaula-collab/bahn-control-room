/** Loading: skeletons in the shape of the content. Never a "0" while loading. */
export function DeskSkeleton() {
  return (
    <div className="desk" aria-busy="true" aria-label="Loading your desk">
      <div className="skeleton skeleton-pulse">
        <div className="bar w-30" />
        <div className="bar lg w-90" style={{ marginTop: 20 }} />
        <div className="bar w-60" />
        <div className="bar w-75" style={{ marginTop: 28 }} />
        <div className="bar w-40" />
        <div className="bar lg w-40" style={{ marginTop: 32, height: 44, borderRadius: 22 }} />
      </div>
      <div className="queue skeleton-pulse">
        {[0, 1, 2].map((i) => (
          <div className="skeleton-row" key={i}>
            <div className="bar w-60" />
            <div className="bar w-30" />
          </div>
        ))}
      </div>
      <p className="quiet t-2 late-note">Checking orders.</p>
    </div>
  )
}

export function CaseSkeleton() {
  return (
    <div className="case-layout" aria-busy="true" aria-label="Loading the case">
      <div className="skeleton-pulse">
        <div className="bar w-20" />
        <div className="bar lg w-90" style={{ marginTop: 24 }} />
        <div className="bar w-60" />
        <div className="bar w-75" style={{ marginTop: 48 }} />
        <div className="bar w-60" />
        <div className="bar w-75" />
        <div className="bar w-40" />
      </div>
      <div className="skeleton skeleton-pulse">
        <div className="bar w-30" />
        <div className="bar lg w-90" style={{ marginTop: 16 }} />
        <div className="bar w-75" style={{ marginTop: 24 }} />
        <div className="bar w-60" />
        <div className="bar lg" style={{ marginTop: 32, height: 44, borderRadius: 22 }} />
      </div>
    </div>
  )
}

export function LeadSkeleton() {
  return (
    <div className="lead" aria-busy="true" aria-label="Loading the shift">
      <div className="skeleton-pulse">
        <div className="bar lg w-75" />
        <div className="bar w-40" />
      </div>
      <div className="skeleton skeleton-pulse" style={{ marginTop: 24, height: 104 }} />
      <div className="skeleton skeleton-pulse" style={{ marginTop: 48 }}>
        <div className="bar w-30" />
        <div className="bar lg w-90" style={{ marginTop: 16 }} />
        <div className="bar w-60" />
      </div>
    </div>
  )
}
