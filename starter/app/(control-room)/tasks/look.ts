/**
 * Where the Needs you list lives on Your tasks (Henry picks, 24 Oct 20:40). Default ("menu"): in
 * the side menu under "Your tasks", so the page has no list. `?tasks=switcher`: a slim row above
 * the card (the car opens the list as a menu, "1 of 2", "Next"). `?tasks=column`: the narrow list
 * on the left. Shared by the server pages and the client frame, so it is not a client module.
 */
export type TasksLook = "menu" | "switcher" | "column"

export const lookOf = (v: string | string[] | null | undefined): TasksLook => {
  const one = Array.isArray(v) ? v[0] : v
  return one === "switcher" || one === "column" ? one : "menu"
}

/** The query that keeps the chosen look when moving between cases ("" for the default). */
export const lookQuery = (v: string | string[] | null | undefined) => {
  const look = lookOf(v)
  return look === "menu" ? "" : `?tasks=${look}`
}
