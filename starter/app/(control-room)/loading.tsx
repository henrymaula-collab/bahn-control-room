import { BareFrame } from "./_ui/bare-frame"
import { DeskSkeleton } from "./_ui/states"

export default function Loading() {
  return (
    <BareFrame title="Your desk">
      <DeskSkeleton />
    </BareFrame>
  )
}
