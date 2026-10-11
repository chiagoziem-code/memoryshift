import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, BrainCircuit, Menu, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  { to: "/account", label: "Parents" },
] as const;

/** The four things a learner does most, kept one tap away on phones. */
const tabs = [
  { to: "/studio", label: "Make", icon: Wand2 },
  { to: "/review", label: "Review", icon: RotateCcw },
  { to: "/check", label: "Check", icon: BrainCircuit },
  { to: "/progress", label: "Progress", icon: BarChart3 },
] as const;

const linkClass =
  "rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:font-semibold data-[status=active]:text-foreground";

export function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 md:flex-wrap md:justify-start md:px-5 md:py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            MemoryShift
          </Link>

          <nav className="hidden flex-wrap items-center gap-1 text-base md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: link.to === "/" }}
                className={linkClass}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="md:hidden" aria-label="Open menu">
                <Menu className="mr-2 size-5" /> Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-xs overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">All MemoryShift pages</SheetDescription>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 text-lg">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    activeOptions={{ exact: link.to === "/" }}
                    className={`${linkClass} py-3`}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 px-1 py-2 text-sm text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-primary"
            >
              <Icon className="size-6" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
