import { BareFrame } from "../../_ui/bare-frame"
import { CaseSkeleton } from "../../_ui/states"

export default function Loading() {
  return (
    <BareFrame title="Case">
      <CaseSkeleton />
    </BareFrame>
  )
}
