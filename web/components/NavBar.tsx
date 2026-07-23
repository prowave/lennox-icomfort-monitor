import Link from "next/link";
import { StatusPill } from "./StatusPill";
import { HeaderTitle } from "./HeaderTitle";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/components", label: "Components" },
  { href: "/charts", label: "Charts" },
  { href: "/energy", label: "Energy" },
];

export function NavBar() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-6">
        <HeaderTitle />
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ color: "var(--text-secondary)" }}
              className="hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <StatusPill />
    </header>
  );
}
