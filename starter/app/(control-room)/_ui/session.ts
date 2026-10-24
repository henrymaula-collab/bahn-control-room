import { cookies } from "next/headers"

export const PERSON_COOKIE = "cr-person"

/** Who is on this screen. A demo switch, not a login. */
export async function currentPersonId(): Promise<string> {
  const jar = await cookies()
  return jar.get(PERSON_COOKIE)?.value ?? "aino"
}
