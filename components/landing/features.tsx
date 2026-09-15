import {
  Sparkles,
  Camera,
  Backpack,
  BookMarked,
  ClipboardList,
  PlayCircle,
  CalendarDays,
  MapPin,
} from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "الأستاذ ذكي",
    titleEn: "AI Tutor",
    description: "اسأل بالنص أو بالصوت واحصل على شرح خطوة بخطوة يناسب منهج السادس الإعدادي، في أي وقت من اليوم.",
    gradient: true,
  },
  {
    icon: Camera,
    title: "حل بالصورة",
    titleEn: "Photo-to-Solve",
    description: "التقط صورة المسألة وارفعها للأستاذ ذكي، فيحلها لك ويشرح الخطوات بالتفصيل.",
    gradient: false,
  },
  {
    icon: Backpack,
    title: "حقيبة الدفاتر",
    titleEn: "Digital Workbooks",
    description: "دفاتر رقمية بصفحات متعددة لأسئلتك وأجوبتك، مع الصور وفيديوهات يوتيوب والرسم والكتابة على الصور، وتصدير PDF.",
    gradient: false,
  },
  {
    icon: BookMarked,
    title: "مكتبة أُلترا ومكتبة سادس",
    titleEn: "Libraries",
    description: "كتب وملازم وملخصات مرتبة حسب المادة من فريق سادس ألترا، وملفات يشاركها الطلاب بعد مراجعة الإدارة.",
    gradient: true,
  },
  {
    icon: ClipboardList,
    title: "مناهج الأسئلة الوزارية",
    titleEn: "Ministry Exams",
    description: "أسئلة وزارية مرتبة حسب المادة لتتدرب على نمط الامتحان الوزاري قبل موعده.",
    gradient: true,
  },
  {
    icon: PlayCircle,
    title: "المحاضرات",
    titleEn: "Lectures",
    description: "محاضرات وقوائم تشغيل لأساتذة السادس الإعدادي مرتبة حسب المادة في مكان واحد.",
    gradient: false,
  },
  {
    icon: CalendarDays,
    title: "تقويم السادس والجدول الأسبوعي",
    titleEn: "Calendar & Schedule",
    description: "تقويم السنة الدراسية بالعطل والمواعيد المهمة، وجدول أسبوعي تنظم به مذاكرتك وملاحظاتك.",
    gradient: false,
  },
  {
    icon: MapPin,
    title: "المعاهد على الخريطة",
    titleEn: "Institutes Map",
    description: "اعثر على المعاهد القريبة منك على الخريطة مع رقم التواصل وزر الاتجاهات.",
    gradient: true,
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">المميزات</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            <span className="text-foreground">كل ما تحتاجه</span>
            <br />
            <span className="text-primary">للتفوق الدراسي</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            كل أدوات السادس الإعدادي في منصة واحدة، على الموقع وتطبيق الأندرويد
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass-card rounded-2xl p-8 hover:glow transition-all duration-300 group"
            >
              <div className="flex items-start gap-6">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 ${
                    feature.gradient
                      ? "gradient-accent"
                      : "bg-secondary"
                  }`}
                >
                  <feature.icon
                    className={`h-7 w-7 ${
                      feature.gradient
                        ? "text-primary-foreground"
                        : "text-primary"
                    }`}
                  />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-primary mb-3">{feature.titleEn}</p>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
