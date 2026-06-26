import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  FlaskConical, 
  Calculator, 
  Atom, 
  Globe, 
  BookOpen, 
  Languages, 
  PenTool,
  History,
  ArrowLeft
} from "lucide-react"

const scientificSubjects = [
  { icon: Calculator, name: "الرياضيات" },
  { icon: Atom, name: "الفيزياء" },
  { icon: FlaskConical, name: "الكيمياء" },
  { icon: Globe, name: "الأحياء" },
  { icon: Languages, name: "الإنجليزية" },
  { icon: BookOpen, name: "العربية" },
]

const literarySubjects = [
  { icon: History, name: "التاريخ" },
  { icon: Globe, name: "الجغرافية" },
  { icon: BookOpen, name: "الأدب العربي" },
  { icon: PenTool, name: "البلاغة" },
  { icon: Languages, name: "الإنجليزية" },
  { icon: BookOpen, name: "الإسلامية" },
]

export function StudyTracks() {
  return (
    <section id="tracks" className="py-24 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <span className="text-sm text-primary">الفروع الدراسية</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            <span className="text-foreground">اختر فرعك</span>
            <br />
            <span className="text-primary">وابدأ رحلة التفوق</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            نغطي جميع المواد الدراسية للفرعين العلمي والأدبي بما يتوافق مع المنهج العراقي المعتمد
          </p>
        </div>

        {/* Study Track Cards */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Scientific Branch */}
          <div className="glass-card rounded-2xl p-8 glow group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-1">الفرع العلمي</h3>
                <p className="text-primary">Scientific Branch</p>
              </div>
              <div className="h-16 w-16 rounded-xl gradient-accent flex items-center justify-center">
                <Atom className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {scientificSubjects.map((subject, index) => (
                <div
                  key={index}
                  className="glass rounded-xl p-4 text-center hover:bg-primary/10 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-2">
                    <subject.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{subject.name}</p>
                </div>
              ))}
            </div>

            <Button asChild className="w-full gradient-accent text-primary-foreground border-0 gap-2">
              <Link href="/account/subscription?plan=chat_monthly">
                ابدأ الدراسة
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Literary Branch */}
          <div className="glass-card rounded-2xl p-8 group hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-1">الفرع الأدبي</h3>
                <p className="text-primary">Literary Branch</p>
              </div>
              <div className="h-16 w-16 rounded-xl bg-secondary flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {literarySubjects.map((subject, index) => (
                <div
                  key={index}
                  className="glass rounded-xl p-4 text-center hover:bg-primary/10 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mx-auto mb-2">
                    <subject.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{subject.name}</p>
                </div>
              ))}
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full glass gap-2"
            >
              <Link href="/account/subscription?plan=chat_monthly">
                ابدأ الدراسة
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
