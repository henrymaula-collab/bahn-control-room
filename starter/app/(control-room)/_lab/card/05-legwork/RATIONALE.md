# card 05: The agent's legwork

- Reference: Zendesk auto assist's pre-approved actions (https://support.zendesk.com/hc/en-us/articles/7051314237466-Using-auto-assist-to-solve-tickets, `research/premium/product/shots/card-05-zendesk-preapproved-action-log.png`): what the assistant did on its own is logged as one grey line with a tick, "clearly marked and not attributed to you".
- Borrowed: the single grey log line with a tick, placed with the situation it supports; the most telling step first ("Called Calverona Hamburg in German at 12:01, and 7 more steps"), opening to every step with its time.
- Why for ops: Bahn's pitch is that agents do the legwork and people decide. This shows the legwork happened (the call was made) without asking the person to read it, so trusting the suggestion is a glance, not a hunt.
- The steps are the case's real agent steps (GET /api/cr/cases/:id), loaded with the card; the line fades in when they arrive.
- Trade-off: one more line between the situation and the question; a green tick is the only colour besides the deadline red.
