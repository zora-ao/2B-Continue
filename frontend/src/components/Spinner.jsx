export default function Spinner({ label = "Loading" }) {
  return <progress className="loading-spinner" aria-label={label} />;
}
