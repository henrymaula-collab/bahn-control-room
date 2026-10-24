import Link from "next/link"
import { BareFrame } from "./_ui/bare-frame"

export default function NotFound() {
  return (
    <BareFrame title="Control room">
      <div className="state">
        <h2 className="t-headline">This case is not open any more.</h2>
        <p className="t-body">It may have been decided, or the agent closed it after a reseed.</p>
        <div className="actions">
          <Link href="/" className="btn btn-secondary">
            Back to your desk
          </Link>
        </div>
      </div>
    </BareFrame>
  )
}
