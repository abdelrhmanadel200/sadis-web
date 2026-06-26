import Link from "next/link"
import { 
  Sparkles, 
  Facebook, 
  Instagram, 
  MessageCircle,
  Youtube,
  Mail,
  Phone,
  MapPin
} from "lucide-react"

const footerLinks = {
  platform: {
    title: "المنصة",
    links: [
      { href: "#about", label: "من نحن" },
      { href: "#features", label: "المميزات" },
      { href: "#pricing", label: "الأسعار" },
      { href: "#faq", label: "الأسئلة الشائعة" },
    ],
  },
  support: {
    title: "الدعم",
    links: [
      { href: "mailto:support@6thultra.com", label: "تواصل معنا" },
      { href: "#faq", label: "مركز المساعدة" },
      { href: "#community", label: "المجتمع" },
      { href: "/sadis-ultra.apk", label: "تحميل التطبيق" },
    ],
  },
  legal: {
    title: "قانوني",
    links: [
      { href: "/privacy", label: "سياسة الخصوصية" },
      { href: "/terms", label: "شروط الخدمة" },
      { href: "/refund", label: "سياسة الاسترداد" },
      { href: "/commercial-register", label: "السجل التجاري" },
    ],
  },
}

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: MessageCircle, href: "#", label: "Telegram" },
  { icon: Youtube, href: "#", label: "YouTube" },
]

export function Footer() {
  return (
    <footer className="py-16 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                سادس ألترا
              </span>
            </Link>

            <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
              أول منصة تعليمية ذكية مصممة خصيصاً لطلاب السادس الإعدادي في العراق. نستخدم أحدث تقنيات الذكاء الاصطناعي لتوفير تجربة تعليمية فريدة.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <a
                href="mailto:support@6thultra.com"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4 text-primary" />
                <span>support@6thultra.com</span>
              </a>
              <a
                href="tel:+9647801234567"
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4 text-primary" />
                <span dir="ltr">+964 780 123 4567</span>
              </a>
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>بغداد، العراق</span>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {footerLinks.platform.title}
            </h4>
            <ul className="space-y-3">
              {footerLinks.platform.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {footerLinks.support.title}
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">
              {footerLinks.legal.title}
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social & Payment */}
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="h-10 w-10 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-primary hover:glow transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>

            {/* Payment Icons */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">طرق الدفع:</span>
              <div className="flex items-center gap-2">
                <div className="h-8 w-12 glass rounded flex items-center justify-center">
                  <div className="h-5 w-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-sm flex items-center justify-center">
                    <span className="text-[6px] font-bold text-white">VISA</span>
                  </div>
                </div>
                <div className="h-8 w-12 glass rounded flex items-center justify-center">
                  <div className="h-5 w-8 bg-gradient-to-r from-red-500 to-orange-500 rounded-sm flex items-center justify-center">
                    <span className="text-[5px] font-bold text-white">MasterCard</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Android APK download */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <span className="text-sm text-muted-foreground">حمّل التطبيق الآن</span>
            <a
              href="/sadis-ultra.apk"
              className="h-12 px-4 glass rounded-lg flex items-center gap-3 hover:glow transition-all group"
              aria-label="Download Android APK"
            >
              <svg
                className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 0 1-.609-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 0 1 0 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
              </svg>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
                  تطبيق Android
                </span>
                <span className="text-sm font-semibold text-foreground">
                  تحميل مباشر (APK)
                </span>
              </div>
            </a>
          </div>

          {/* Copyright */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} سادس ألترا (6th Ultra). جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
