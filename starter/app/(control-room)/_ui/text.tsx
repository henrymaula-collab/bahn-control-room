/** Keeps "S-Class" or "E-Class" on one line: a big headline must not break at a model name's hyphen. */
export function Keep({ text }: { text: string }) {
  const parts = text.split(/(\S*\w-\w\S*)/g)
  return (
    <>
      {parts.map((p, i) =>
        /\w-\w/.test(p) ? (
          <span key={i} style={{ whiteSpace: "nowrap" }}>
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  )
}
