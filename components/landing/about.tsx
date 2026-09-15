import { Target, Lightbulb, Users, NotebookPen } from "lucide-react"

export function About() {
  return (
    <section id="about" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image/Visual Side */}
          <div className="relative order-2 lg:order-1">
            <div className="glass-card rounded-2xl p-8 glow">
              {/* Mission Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg gradient-accent flex items-center justify-center mb-3">
                    <Target className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">رؤيتنا</h4>
                  <p className="text-xs text-muted-foreground">دراسة أسهل لكل طالب</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">الذكاء الاصطناعي</h4>
                  <p className="text-xs text-muted-foreground">أستاذ يفهم منهجك</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">المجتمع</h4>
                  <p className="text-xs text-muted-foreground">مكتبة يشارك فيها الطلاب</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg gradient-accent flex items-center justify-center mb-3">
                    <NotebookPen className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">التنظيم</h4>
                  <p className="text-xs text-muted-foreground">دفاتر وتقويم وجدول</p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="mt-6 glass rounded-xl p-4 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">11</p>
                  <p className="text-xs text-muted-foreground">مادة دراسية</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">2</p>
                  <p className="text-xs text-muted-foreground">علمي وأدبي</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">24/7</p>
                  <p className="text-xs text-muted-foreground">الأستاذ ذكي</p>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -z-10 -top-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -z-10 -bottom-8 -left-8 w-24 h-24 bg-accent/20 rounded-full blur-2xl" />
          </div>

          {/* Content Side */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <span className="text-sm text-primary">من نحن</span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
              <span className="text-foreground">منصة واحدة</span>
              <br />
              <span className="text-primary">لكل ما يحتاجه طالب السادس</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              &quot;سادس ألترا&quot; منصة تعليمية مصممة خصيصا لطلاب السادس الإعدادي في العراق بفرعيه العلمي والأدبي. تجمع لك الأستاذ ذكي والمكتبات والمحاضرات والأسئلة الوزارية وأدوات تنظيم الدراسة في مكان واحد، على الموقع والتطبيق.
            </p>

            <p className="text-muted-foreground mb-8 leading-relaxed">
              نؤمن بأن كل طالب يستحق أستاذا يجيب سؤاله في أي وقت، ومصادر مرتبة حسب مادته وفرعه، وأدوات تساعده ينظم وقته حتى يوم الامتحان الوزاري.
            </p>

            <ul className="space-y-3">
              {[
                "شرح بالنص والصوت وحل المسائل بالصورة",
                "مكتبات مرتبة حسب المادة والفرع",
                "دفاتر رقمية للواجبات مع تصدير PDF",
                "تقويم السادس وجدول أسبوعي للمذاكرة",
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full gradient-accent" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
