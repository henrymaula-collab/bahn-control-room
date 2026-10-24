// Three likely reasons per kind of step, for the one-tap "why" when a person does
// not take the agent's suggestion. Written as rules someone could reuse, so the
// answer is already a candidate lesson. Keyed by the engine's option ids
// (lib/control-room/learning.ts OPTION_TEXT); the agent can replace these with
// reasons written from the case itself.

export const WHY_BY_OPTION: Record<string, string[]> = {
  pause_gig: [
    "A driver who books before the pickup place is sure will travel for nothing.",
    "This pickup place needs time to check its stock list.",
    "The gig price would go up if a driver booked and was cancelled.",
  ],
  follow_pickup_place: [
    "The pickup place knows its own yard better than the order form.",
    "The customer's note is older than what the pickup place said today.",
    "Waiting for the customer would cost the pickup slot.",
  ],
  keep_slot_call_again: [
    "This pickup place usually answers within the hour.",
    "The pickup is not until later, so there is time to call again.",
    "Moving the slot now would bother the customer for nothing.",
  ],
  hold_driver_until_key_holder: [
    "A driver without a named key holder ends in an empty pickup.",
    "This pickup place has lost keys before.",
    "The customer should not be asked before the pickup place answers.",
  ],
  driver_waits: [
    "The pickup place found cars within the hour before.",
    "A second trip costs more than 30 more minutes.",
    "The driver offered to wait, so ask before paying an empty pickup.",
  ],
  release_driver: [
    "The driver has waited long enough.",
    "Nobody can say when the car will be found.",
    "The driver's next gig is at risk if they stay.",
  ],
  accept_fee: [
    "The fee is lower than a wasted trip.",
    "This pickup place always charges it, and the customer knows.",
    "Arguing over the fee would cost the pickup slot.",
  ],
  ask_customer: [
    "Only the customer can settle this.",
    "The pickup place has said all it can.",
    "The customer asked to be told first.",
  ],
  ask_customer_for_release: [
    "The customer has already been asked and is waiting on the seller.",
    "Seller holds take more than a day to clear.",
    "The release should go straight to the pickup place, not through us.",
  ],
  move_pickup_next_day: [
    "A pickup place that does not answer today will not be ready today.",
    "The customer prefers a sure date over waiting.",
    "The driver's other gigs fit better on the next day.",
  ],
}

/** Reasons for an option id, by exact id first, then by the start of the id. */
export function whyFor(optionId: string): string[] {
  if (WHY_BY_OPTION[optionId]) return WHY_BY_OPTION[optionId]
  const key = Object.keys(WHY_BY_OPTION).find((k) => optionId.startsWith(k))
  return key ? WHY_BY_OPTION[key] : []
}
