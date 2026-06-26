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
    question: "هل المنهج الدراسي متوافق مع المنهج العراقي الرسمي؟",
    answer:
      "نعم، جميع المحتوى التعليمي في منصة سادس ألترا متوافق 100% مع المنهج العراقي المعتمد من وزارة التربية. نحرص على تحديث المحتوى بشكل مستمر لمواكبة أي تغييرات في المناهج الدراسية.",
  },
  {
    question: "ما هي طرق الدفع المتاحة؟",
    answer:
      "نوفر عدة طرق دفع مريحة تشمل: بطاقات الائتمان (Visa و MasterCard)، زين كاش، آسيا حوالة، والتحويل البنكي المباشر. جميع المعاملات مؤمنة ومشفرة لحماية بياناتك.",
  },
  {
    question: "هل يمكنني استخدام المنصة على الهاتف المحمول؟",
    answer:
      "بالتأكيد! منصة سادس ألترا متوافقة مع جميع الأجهزة - الهواتف الذكية، الأجهزة اللوحية، وأجهزة الكمبيوتر. يمكنك الدراسة في أي وقت ومن أي مكان.",
  },
  {
    question: "كيف تعمل خاصية حل المسائل بالصور؟",
    answer:
      "ببساطة، التقط صورة واضحة للسؤال أو المسألة باستخدام كاميرا هاتفك، وارفعها للمنصة. سيقوم الذكاء الاصطناعي بتحليل السؤال وتقديم الحل الكامل مع شرح تفصيلي لكل خطوة.",
  },
  {
    question: "هل هناك ضمان استرداد الأموال؟",
    answer:
      "نعم، نقدم ضمان استرداد كامل خلال 7 أيام من تاريخ الاشتراك إذا لم تكن راضياً عن الخدمة. لا نطرح أي أسئلة - رضاكم هو أولويتنا.",
  },
  {
    question: "كم عدد الأسئلة التي يمكنني طرحها يومياً؟",
    answer:
      "مع اشتراكك في سادس ألترا، يمكنك طرح عدد غير محدود من الأسئلة يومياً. لا توجد قيود على استخدامك للمنصة - ادرس قدر ما تريد!",
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
            إليك إجابات لأكثر الأسئلة شيوعاً حول منصة سادس ألترا
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
            href="#contact"
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
