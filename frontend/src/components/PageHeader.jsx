export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <title>{`${title} | Kuryenta`}</title>
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-3">{actions}</div>}
    </header>
  );
}
