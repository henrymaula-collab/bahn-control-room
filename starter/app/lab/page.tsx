import "./lab.css"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Metadata } from "next"
import { SLOT_FOLDERS, SLOTS, type Slot } from "../(control-room)/_lab/slots"

export const metadata: Metadata = { title: "Night lab" }
export const dynamic = "force-dynamic"

type State = { state: string; person: string; path: string; params: Record<string, string>; note?: string }
const LAB = join(process.cwd(), "app", "(control-room)", "_lab")

const SLOT_WHAT: Record<Slot, string> = {
  needs: "How the person sees and switches between their Needs-you tasks",
  card: "The decision card",
  welcome: "The Overview's welcome panel",
  chat: "Talk it through",
  decide: "The decision moment: email preview, after the yes",
  situation: "The situation panel beside the card",
  map: "The Overview map",
  menu: "Side menu, lockup, person block",
  rows: "The rows under the card and the Other options sheet",
  rule: "Kaisa meets the agent's trust-rule proposal",
}

function variantsOf(slot: Slot) {
  const dir = join(LAB, slot)
  const index = existsSync(join(dir, "index.ts")) ? readFileSync(join(dir, "index.ts"), "utf8") : ""
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-[a-z0-9-]+$/.test(d.name))
    .map((d) => {
      const md = join(dir, d.name, "RATIONALE.md")
      return {
        nn: d.name.slice(0, 2),
        slug: d.name.slice(3),
        rationale: existsSync(md) ? readFileSync(md, "utf8") : "",
        registered: index.includes(`"${d.name.slice(0, 2)}"`),
      }
    })
    .sort((a, b) => a.nn.localeCompare(b.nn))
}

const href = (slot: Slot, nn: string, s: State) => {
  const q = new URLSearchParams({ v: `${slot}:${nn}`, ...s.params }).toString().replace(/%3A/g, ":")
  return `/lab/as?person=${s.person}&to=${encodeURIComponent(`${s.path}?${q}`)}`
}

/** Night lab gallery: per slot, every variant's rationale and its in-context links. A tool. */
export default async function LabPage({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const states = JSON.parse(readFileSync(join(LAB, "states.json"), "utf8")) as Record<Slot, State[]>
  const only = (await searchParams).slot
  const slots = SLOTS.filter((s) => !only || s === only)
  return (
    <main className="lab">
      <header className="lab-head">
        <h1>Night lab</h1>
        <p>
          Every variant in context. A link signs in as the state&apos;s person and opens the real page with <code>?v=slot:nn</code>; combine
          slots by hand (<code>?v=card:07,needs:03</code>). Images: <code>~/Desktop/Bahn-lab-bilder/</code>. Shots:{" "}
          <code>node research/scratch-lab/shots.mjs &lt;slot&gt; [nn ...]</code>.
        </p>
        <nav className="lab-nav">
          <a href="/lab" aria-current={!only ? "page" : undefined}>All</a>
          {SLOTS.map((s) => (
            <a key={s} href={`/lab?slot=${s}`} aria-current={only === s ? "page" : undefined}>
              {s}
            </a>
          ))}
        </nav>
      </header>
      {slots.map((slot) => (
        <section key={slot} className="lab-slot" id={slot}>
          <h2>
            {slot} <span>{SLOT_WHAT[slot]}. Images in {SLOT_FOLDERS[slot]}/</span>
          </h2>
          {variantsOf(slot).map((v) => (
            <article key={v.nn} className="lab-variant">
              <div className="lab-variant-head">
                <h3>
                  {v.nn} {v.slug}
                </h3>
                {!v.registered && <span className="lab-warn">not in {slot}/index.ts: shows today</span>}
                <ul className="lab-links">
                  {states[slot].map((s) => (
                    <li key={s.state}>
                      <a href={href(slot, v.nn, s)} title={s.note}>
                        {s.state}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <Markdown text={v.rationale} />
            </article>
          ))}
        </section>
      ))}
    </main>
  )
}

/** Enough Markdown for a rationale: headings, paragraphs, lists, **bold**, `code`, [links](url). */
function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="lab-md">
      {blocks.map((b, i) => {
        if (/^#{1,6} /.test(b)) return <h4 key={i}>{inline(b.replace(/^#+ /, ""))}</h4>
        if (/^\s*[-*] /.test(b))
          return (
            <ul key={i}>
              {b.split("\n").map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>
              ))}
            </ul>
          )
        return <p key={i}>{inline(b.replace(/\n/g, " "))}</p>
      })}
    </div>
  )
}

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith("**")) out.push(<strong key={m.index}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith("`")) out.push(<code key={m.index}>{t.slice(1, -1)}</code>)
    else {
      const [, label, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!
      out.push(
        <a key={m.index} href={url} target="_blank" rel="noreferrer">
          {label}
        </a>,
      )
    }
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}
