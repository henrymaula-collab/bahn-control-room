import Link from "next/link"

export default function NotFound() {
  return (
    <div className="detail">
      <section className="question detail-inner">
        <h1 className="l what">This case is not open any more.</h1>
        <p className="l ask quiet">It may have been decided, or the agent closed it.</p>
        <div className="answers">
          <Link href="/work" className="btn btn-secondary">
            Back to Work
          </Link>
        </div>
      </section>
    </div>
  )
}
