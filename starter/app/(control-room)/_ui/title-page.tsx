import { Icon, type IconName } from "./icons"

/** A section that exists in the menu but has no content yet: its name, nothing invented. */
export function TitlePage({ title, icon }: { title: string; icon: IconName }) {
  return (
    <section className="title-page">
      <span className="title-icon">
        <Icon name={icon} size={24} />
      </span>
      <h1 className="m strong">{title}</h1>
    </section>
  )
}
