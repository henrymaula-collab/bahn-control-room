// The kind of a case, for the chat: the learning loop's kind, never a second
// detector. A kind is a property of the problem ("Seller hold on the car"),
// never one pickup place; lib/control-room/kinds.ts reads it from the case, and
// the loop, the trust gate, Know-how, History and the chat all group by it.

import { KINDS, kindDef, kindForType, kindOf as loopKindOf } from "@/lib/control-room/kinds"
import type { Case, CaseType } from "@/lib/control-room/types"

export interface Kind {
  key: string
  label: string
}

/** A kind key with its label, as the loop names it. */
export function kindRef(key: string): Kind {
  return { key, label: kindDef(key).label }
}

export const KIND_LABELS: Record<string, string> = Object.fromEntries(Object.values(KINDS).map((k) => [k.key, k.label]))

/** The loop's kind of this case (lib/control-room/kinds.ts kindOf). */
export function kindOf(c: Case): Kind {
  return kindRef(loopKindOf(c))
}

/** A decision with no stored case and no case record only knows its case type. */
export function kindOfType(caseType: string): Kind {
  return kindRef(kindForType(caseType as CaseType))
}

/** Option ids are Bahn's semantic keys, with a suffix when one case has two of a kind ("ask_customer_2"). */
export const optionKey = (id: string) => id.replace(/_\d+$/, "")
