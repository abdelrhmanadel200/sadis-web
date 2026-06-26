import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Sparkles, Crown, ArrowLeft } from "lucide-react"

// Plans here MUST stay in sync with `subscription_plans.id` in Supabase.
// Clicking subscribe sends the visitor to /account/subscription which is
// where the authenticated checkout actually happens.
const plans = [
  {
    id: "chat_monthly",
    name: "الأستاذ ذكي - شهري",
    nameEn: "AI Teacher - Monthly",
    priceIQD: "25,000 د.ع",
    period: "/شهرياً",
    description: "للدردشة مع الأستاذ ذكي نص وصوت",
    features: [
      "50 سؤال نصي يومياً",
      "5 أسئلة صوتية يومياً",
      "حل المسائل بالصور",
      "ذاكرة المحادثات السابقة",
      "يتجدد شهرياً",
    ],
    popular: false,
    icon: Sparkles,
  },
  {
    id: "lifetime_access",
    name: "تفعيل المنصة - سنوي",
    nameEn: "Yearly Activation",
    priceIQD: "250,000 د.ع",
    period: "اشتراك سنوي",
    description: "افتح المنصة كاملة لمدة سنة كاملة",
    features: [
      "المكتبة الرقمية لمدة سنة",
      "المحاضرات المسجلة لمدة سنة",
      "المنتدى ومناقشات الزملاء",
      "تجديد سنوي",
      "كل التحديثات خلال فترة الاشتراك",
    ],
    popular: true,
    icon: Crown,
  },
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
            <span className="text-foreground">اختر خطتك</span>
            <br />
            <span className="text-primary">وابدأ التفوق اليوم</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            أسعار مناسبة لجميع الطلاب مع ضمان جودة الخدمة والدعم المستمر
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
                      الأكثر شعبية
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
                <Link href={`/account/subscription?plan=${plan.id}`}>
                  اشترك الآن
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">طرق الدفع المتاحة</p>
          <div className="flex items-center justify-center gap-6">
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
              <div className="h-6 w-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">VISA</span>
              </div>
              <span className="text-sm text-muted-foreground">Visa</span>
            </div>
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
              <div className="h-6 w-10 bg-gradient-to-r from-red-500 to-orange-500 rounded flex items-center justify-center">
                <span className="text-[6px] font-bold text-white">MasterCard</span>
              </div>
              <span className="text-sm text-muted-foreground">MasterCard</span>
            </div>
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
              <div className="h-6 w-10 bg-secondary rounded flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">زين كاش</span>
              </div>
              <span className="text-sm text-muted-foreground">Zain Cash</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
