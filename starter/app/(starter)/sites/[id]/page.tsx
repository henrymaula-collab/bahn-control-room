import { EntityPage } from "@/app/components/entity-page"

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EntityPage kind="site" params={params} />
}
