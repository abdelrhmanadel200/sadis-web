"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  BookOpen,
  ClipboardList,
  Users,
  Upload,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  BadgeCheck,
  FileText,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "المنتدى",
    description: "ناقش المواضيع الدراسية واسأل زملاءك، ودخول المنتدى متاح لكل عضو مسجل بدون اشتراك.",
  },
  {
    icon: BookOpen,
    title: "مكتبة سادس",
    description: "شارك ملازمك وملخصاتك مع بقية الطلاب، وتفاعل مع ملفاتهم بالإعجاب.",
  },
  {
    icon: ClipboardList,
    title: "مناهج الأسئلة الوزارية",
    description: "أسئلة وزارية يرفعها فريق سادس ألترا والأعضاء، مرتبة حسب المادة.",
  },
];

const steps = [
  { icon: Upload, title: "ارفع ملفك", text: "مع العنوان والأستاذ والمادة وصورة غلاف" },
  { icon: ShieldCheck, title: "تراجعه الإدارة", text: "حتى تبقى المكتبة نظيفة من المحتوى المخالف" },
  { icon: Users, title: "يظهر للطلاب", text: "يفتحونه بضغطة على الغلاف ويتفاعلون معه" },
];

export function Community() {
  return (
    <section id="community" className="py-24 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">مجتمع سادس ألترا</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            ادرس مع زملائك من{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-teal-400">
              كل أنحاء العراق
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            تبادل الملفات والملاحظات، اسأل في المنتدى، وتدرب على الأسئلة الوزارية مع طلاب السادس الإعدادي
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Features */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                    <feature.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* How sharing works */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-cyan-500/20 rounded-3xl blur-2xl opacity-50" />

            <div className="relative rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden backdrop-blur-xl">
              <div className="p-4 border-b border-white/10 bg-white/5">
                <span className="text-sm font-medium text-foreground">كيف تشارك في مكتبة سادس</span>
              </div>

              <div className="p-4 space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white flex-shrink-0">
                      <step.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {index + 1}. {step.title}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Example card */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-xs text-muted-foreground mb-2">مثال على بطاقة ملف:</p>
                <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="h-14 w-11 rounded-md bg-gradient-to-br from-cyan-500/30 to-teal-500/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">ملزمة الفيزياء</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        <BadgeCheck className="h-3 w-3" /> رسمي
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> إعجاب</span>
                      <span className="inline-flex items-center gap-1"><ThumbsDown className="h-3.5 w-3.5" /> عدم إعجاب</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 p-3 rounded-xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-sky-400" />
                <span className="text-sm font-medium">ملفات رسمية من الفريق</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center mt-16">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-l from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-10 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300"
          >
            <Link href="/register">
              <Users className="w-5 h-5 ml-2" />
              انضم للمجتمع الآن
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            التسجيل مجاني ودخول المنتدى بدون اشتراك
          </p>
        </div>
      </div>
    </section>
  );
}
