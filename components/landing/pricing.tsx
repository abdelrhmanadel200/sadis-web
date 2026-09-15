import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Sparkles, Crown, ArrowLeft, ClipboardList, KeyRound, BadgeCheck } from "lucide-react"

// Plans here MUST stay in sync with `subscription_plans.id` in Supabase.
// Every plan is activated with a code: the button opens the code request form.
const plans = [
  {
    id: "chat_monthly",
    name: "الباقة الأساسية",
    nameEn: "Basic",
    priceIQD: "25,000 د.ع",
    period: "الأقسام سنة + الذكاء شهر",
    description: "كل أقسام المنصة لمدة سنة، والأستاذ ذكي لمدة شهر قابل للتجديد",
    features: [
      "كل الأقسام لمدة سنة كاملة",
      "مكتبة أُلترا ومكتبة سادس والأسئلة الوزارية",
      "المحاضرات وحقيبة الدفاتر والمسودة",
      "الأستاذ ذكي لمدة شهر ويتجدد بكود إعادة التعبئة",
      "50 سؤال نصي و5 صوتية يوميا",
      "حل المسائل بالصورة",
    ],
    popular: false,
    icon: Sparkles,
  },
  {
    id: "lifetime_access",
    name: "الباقة السنوية",
    nameEn: "Yearly",
    priceIQD: "250,000 د.ع",
    period: "سنة كاملة لكل شيء",
    description: "كل الأقسام والأستاذ ذكي لمدة سنة كاملة",
    features: [
      "كل الأقسام لمدة سنة كاملة",
      "الأستاذ ذكي لمدة سنة كاملة",
      "بدون تجديد شهري للذكاء",
      "50 سؤال نصي و5 صوتية يوميا",
      "حل المسائل بالصورة",
      "دخول المنتدى بدون اشتراك",
    ],
    popular: true,
    icon: Crown,
  },
]

const steps = [
  { icon: ClipboardList, title: "اطلب الكود", text: "اختر نوع الكود واملأ بياناتك" },
  { icon: KeyRound, title: "استلم الرمز", text: "يتواصل معك فريق التفعيل ويسلمك الرمز" },
  { icon: BadgeCheck, title: "فعّل حسابك", text: "أدخل الرمز في صفحة الاشتراك" },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 relative">
      {/* Gradient transition from Community section */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent pointer-events-none" />

      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <span className="text-sm text-primary">الأسعار</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            <span className="text-foreground">اختر باقتك</span>
            <br />
            <span className="text-primary">وابدأ التفوق اليوم</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            اشتراك واحد يفتح لك المنصة كلها، والتفعيل برمز تستلمه من فريق التفعيل
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? "glass-card glow border-primary/50"
                  : "glass-card"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="gradient-accent px-4 py-1 rounded-full">
                    <span className="text-sm font-medium text-primary-foreground">
                      الأكثر توفيرا
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                    plan.popular ? "gradient-accent" : "bg-secondary"
                  }`}
                >
                  <plan.icon
                    className={`h-7 w-7 ${
                      plan.popular ? "text-primary-foreground" : "text-primary"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.nameEn}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold text-primary">{plan.priceIQD}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.period}</p>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full gradient-accent flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`w-full gap-2 ${
                  plan.popular
                    ? "gradient-accent text-primary-foreground border-0"
                    : "glass border-primary/40 text-foreground hover:bg-primary/10"
                }`}
                variant={plan.popular ? "default" : "outline"}
              >
                <Link href={`/activation-request?plan=${plan.id}`}>
                  اطلب كود التفعيل
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* How activation works */}
        <div className="mt-12 max-w-4xl mx-auto">
          <p className="text-center text-sm text-muted-foreground mb-4">طريقة التفعيل</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {steps.map((step, index) => (
              <div key={index} className="glass rounded-xl p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{index + 1}. {step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            انتهى شهر الأستاذ ذكي وأقسامك ما زالت مفعلة؟{" "}
            <Link href="/activation-request?plan=ai_refill" className="text-primary hover:underline">
              اطلب كود إعادة تعبئة الذكاء الاصطناعي
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
