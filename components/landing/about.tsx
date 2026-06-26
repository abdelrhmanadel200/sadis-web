import { Target, Lightbulb, Users, GraduationCap } from "lucide-react"

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
                  <p className="text-xs text-muted-foreground">تحويل التعليم العراقي</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
                    <Lightbulb className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">الابتكار</h4>
                  <p className="text-xs text-muted-foreground">تقنية AI متطورة</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">المجتمع</h4>
                  <p className="text-xs text-muted-foreground">دعم الطلاب</p>
                </div>

                <div className="glass rounded-xl p-4">
                  <div className="h-12 w-12 rounded-lg gradient-accent flex items-center justify-center mb-3">
                    <GraduationCap className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">التفوق</h4>
                  <p className="text-xs text-muted-foreground">نجاح مضمون</p>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="mt-6 glass rounded-xl p-4 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">95%</p>
                  <p className="text-xs text-muted-foreground">نسبة النجاح</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+50K</p>
                  <p className="text-xs text-muted-foreground">سؤال محلول</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">+15</p>
                  <p className="text-xs text-muted-foreground">مادة دراسية</p>
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
              <span className="text-foreground">نحن نُحدث ثورة في</span>
              <br />
              <span className="text-primary">التعليم العراقي</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              &quot;سادس ألترا&quot; هي منصة تعليمية ذكية مصممة خصيصاً لطلاب السادس الإعدادي في العراق. نستخدم أحدث تقنيات الذكاء الاصطناعي لتوفير تجربة تعليمية شخصية وفعالة.
            </p>

            <p className="text-muted-foreground mb-8 leading-relaxed">
              رؤيتنا هي جعل التعليم عالي الجودة متاحاً لكل طالب عراقي، بغض النظر عن موقعه الجغرافي أو ظروفه الاقتصادية. نؤمن بأن كل طالب يستحق معلماً شخصياً ذكياً يفهم احتياجاته ويساعده على التفوق.
            </p>

            <ul className="space-y-3">
              {[
                "منهج عراقي معتمد ومحدث",
                "شرح تفاعلي بالذكاء الاصطناعي",
                "متابعة مستمرة لتقدم الطالب",
                "دعم فني على مدار الساعة"
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
