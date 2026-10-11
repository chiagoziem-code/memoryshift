import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/home", label: "My space" },
  { to: "/studio", label: "Studio" },
  { to: "/library", label: "Library" },
  { to: "/review", label: "Review" },
  { to: "/check", label: "Memory check" },
  { to: "/progress", label: "Progress" },

  { to: "/onboarding", label: "Calibration" },
  { to: "/profile", label: "My profile" },
  { to: "/settings", label: "Reading & access" },
] as const;

export function AppNav() {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-5 py-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          MemoryShift
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-base">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              className="rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:font-semibold data-[status=active]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
