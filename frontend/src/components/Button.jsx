import Icon from "./Icon.jsx";

const VARIANTS = {
  primary: "bg-green text-on-accent hover:brightness-110",
  secondary: "bg-raised text-ink border border-line hover:border-muted",
};

export default function Button({
  variant = "primary",
  icon,
  type = "button",
  disabled = false,
  onClick,
  className = "",
  children,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
