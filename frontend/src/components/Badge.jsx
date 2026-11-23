const TONES = {
  green: "bg-green-soft text-green",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  yellow: "bg-yellow-soft text-yellow",
};

export default function Badge({ tone = "green", children }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
