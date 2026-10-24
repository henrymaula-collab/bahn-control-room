# chat 03: The work as a live checklist

- References: Origin Financial's advisor (https://nicelydone.club/examples/screens/92ff41f4-7dcd-4cf3-b4d3-2098190ab86d, `research/premium/visual/shots/chat-02-origin-thinking-steps.png`), Apple HIG Generative AI, "Consider giving specific, reassuring feedback during generation" (https://developer.apple.com/design/human-interface-guidelines/generative-ai, `research/premium/chat-builder/apple-hig-generative-ai.md`).
- Borrowed from Origin: the wait as steps that appear one by one, ticked when done, the next one faint. From Apple: say what is happening ("Reading the messages on this order"), never "Processing" or "Thinking".
- Exactly: a thin rail with one node per step (ink tick when done, a turning ring while running, a faint ring for "Writing the answer"); when the answer is in, the rail folds into "Read 2 things ›" and opens again on a tap. After "Send the email", the same rail says what was decided and what the agent does next, as the next step waiting.
- Why for ops: the person sees which facts the agent is using while it works, which is what makes the suggestion trustworthy, and the wait feels shorter because something visibly moves forward.
- Trade-off: the live rail takes two or three lines more than a single grey line; for a one-step answer it is more structure than the wait needs.
