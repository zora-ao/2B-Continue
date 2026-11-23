// The big title (and optional subtitle) at the top of every page.
export default function PageHeader({ title, subtitle }) {
  return (
    <header>
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
