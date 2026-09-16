"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react"

const faqs = [
  {
    question: "هل المحتوى مناسب لمنهج السادس الإعدادي العراقي؟",
    answer:
      "نعم، المنصة مبنية على منهج السادس الإعدادي العراقي للفرعين العلمي والأدبي، والأستاذ ذكي والمكتبات والأسئلة الوزارية كلها مرتبة حسب مواد المنهج، ونحدث المحتوى باستمرار.",
  },
  {
    question: "كيف أشترك وأفعل حسابي؟",
    answer:
      "الاشتراك يتم برمز تفعيل: اطلب الكود من صفحة الاشتراك واختر نوعه، فيتواصل معك فريق التفعيل ويسلمك الرمز، ثم تدخله في صفحة الاشتراك فيتفعل حسابك مباشرة.",
  },
  {
    question: "ما الفرق بين الباقة الأساسية والسنوية؟",
    answer:
      "الباقتان تفتحان كل أقسام المنصة لمدة سنة. الباقة الأساسية (25 ألف) تعطيك الأستاذ ذكي لمدة شهر وتجدده بكود إعادة تعبئة الذكاء الاصطناعي، أما الباقة السنوية (250 ألف) فتعطيك الأستاذ ذكي سنة كاملة بدون تجديد.",
  },
  {
    question: "كم سؤالا يمكنني أن أسأل الأستاذ ذكي يوميا؟",
    answer:
      "المشترك يحصل على 50 سؤالا نصيا و5 أسئلة صوتية يوميا، ويمكنه أيضا إرفاق صورة المسألة ليحلها ويشرحها.",
  },
  {
    question: "ما هي حقيبة الدفاتر؟",
    answer:
      "دفاتر رقمية تنشئها بنفسك لكل مادة وفصل، بصفحات متعددة تكتب فيها الأسئلة والأجوبة وتضيف الصور وفيديوهات يوتيوب، وترسم وتكتب على الصور، ثم تصدر الدفتر ملف PDF.",
  },
  {
    question: "هل يمكنني تغيير فرعي بين العلمي والأدبي؟",
    answer:
      "نعم، تختار فرعك عند أول دخول للدردشة أو المواد، وتقدر تغيره في أي وقت من صفحة حسابي، فتتغير المواد المعروضة لك تلقائيا.",
  },
  {
    question: "هل يمكنني استخدام المنصة على الهاتف؟",
    answer:
      "نعم، الموقع يعمل على الهاتف والتابلت والكمبيوتر، ويتوفر تطبيق أندرويد يمكن تحميله مباشرة من الموقع.",
  },
  {
    question: "هل يمكن استرجاع المبلغ؟",
    answer:
      "شروط الاسترجاع موضحة بالتفصيل في صفحة سياسة الاسترجاع الموجودة أسفل الموقع.",
  },
]

export function FAQ() {
  return (
    <section id="faq" className="py-24 relative">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary">الأسئلة الشائعة</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            <span className="text-foreground">لديك سؤال؟</span>
            <br />
            <span className="text-primary">لدينا الإجابة</span>
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            إليك إجابات لأكثر الأسئلة شيوعا حول منصة سادس ألترا
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-card rounded-xl px-6 border-none"
              >
                <AccordionTrigger className="text-right hover:no-underline hover:text-primary py-6">
                  <span className="text-lg font-medium text-foreground text-right">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            لم تجد إجابة لسؤالك؟
          </p>
          <a
            href="mailto:support@6thultra.com"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            تواصل معنا مباشرة
            <span>←</span>
          </a>
        </div>
      </div>
    </section>
  )
}
