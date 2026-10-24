import "../(control-room)/bx-tokens.css"
import "../(control-room)/control-room.css"

// Developer pages: one part of the control room on its own, in the control room's
// look but outside its frame (no side menu, no data needed).
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <main className="dev-page">{children}</main>
}
