import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import logoMarkDark from "@/assets/logo-mark-dark.png";
import logoMarkLight from "@/assets/logo-mark-light.png";

export default function Logo({ compact = false }) {
  const lightSrc = compact ? logoMarkLight : logoLight;
  const darkSrc = compact ? logoMarkDark : logoDark;
  const sizeClass = compact ? "h-8 w-auto" : "h-7 w-auto";

  return (
    <div className="flex items-center">
      <img src={lightSrc} alt="Kuryenta" className={`${sizeClass} block select-none dark:hidden`} />
      <img src={darkSrc} alt="Kuryenta" className={`${sizeClass} hidden select-none dark:block`} />
    </div>
  );
}
