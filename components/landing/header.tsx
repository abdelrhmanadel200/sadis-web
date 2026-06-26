"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/providers/ThemeProvider"

const navLinks = [
  { href: "#about", label: "من نحن" },
  { href: "#features", label: "المميزات" },
  { href: "#pricing", label: "الأسعار" },
  { href: "#faq", label: "الأسئلة الشائعة" },
  { href: "https://forum.6thultra.com/session/sso", label: "المنتدى", external: true },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-background/85 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo — fixed pixel height + auto width keeps the portrait "6"
              glyph fully visible (it's taller than wide). flex-shrink-0 +
              block stops the parent from squishing it. */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/icon-web.png"
              alt="Sads Ultra"
              className="block h-10 md:h-12 w-auto max-w-none shrink-0"
            />
            <span className="text-xl font-bold text-foreground leading-none">
              سادس ألترا
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="toggle theme"
              className="w-9 h-9 rounded-full flex items-center justify-center text-foreground hover:bg-primary/10 transition"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="gradient-accent text-primary-foreground border-0"
            >
              <Link href="/register">ابدأ الآن</Link>
            </Button>
          </div>

          {/* Mobile: theme toggle + menu button */}
          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={toggleTheme}
              aria-label="toggle theme"
              className="p-2 text-foreground"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              className="p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ),
              )}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                >
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    تسجيل الدخول
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="gradient-accent text-primary-foreground border-0"
                >
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    ابدأ الآن
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
