import { BareFrame } from "../_ui/bare-frame"
import { LeadSkeleton } from "../_ui/states"

export default function Loading() {
  return (
    <BareFrame title="Shift lead">
      <LeadSkeleton />
    </BareFrame>
  )
}
