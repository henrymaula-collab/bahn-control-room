import "../globals.css"

// The starter's record pages (orders, inbox, customers, drivers, places), kept
// reachable but out of the way. Their own fonts and stylesheet stay here.
export default function StarterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        precedence="default"
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Reddit+Mono:wght@400;500&family=Unbounded:wght@500;600;700&display=swap"
      />
      {children}
    </>
  )
}
