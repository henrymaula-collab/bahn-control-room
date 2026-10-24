import Link from "next/link"
import { BahnLogo } from "./logo"

/** The top bar without a person, for error and not-found pages. */
export function BareFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="logo" aria-label="Control room home">
            <BahnLogo />
          </Link>
        </div>
        <div className="topbar-center">
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="topbar-right" />
      </header>
      <main className="page">{children}</main>
    </>
  )
}
