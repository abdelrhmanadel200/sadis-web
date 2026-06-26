"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Play, Sparkles, Zap, Brain } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden gradient-hero">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                مدعوم بتقنية GPT المتقدمة
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-balance">
              <span className="text-foreground">أول معلم ذكاء اصطناعي</span>
              <br />
              <span className="text-primary glow-text">لطلاب السادس الإعدادي</span>
              <br />
              <span className="text-foreground">في العراق</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              مدعوم بنماذج GPT المتقدمة لحل مسائل الفيزياء والرياضيات وتلخيص المناهج الدراسية على مدار الساعة طوال أيام الأسبوع
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="gradient-accent text-primary-foreground border-0 gap-2">
                <Link href="/register">
                  انضم الآن
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="gap-2 glass border-primary/50 text-foreground hover:text-foreground hover:bg-primary/10"
              >
                <Link href="/chat">
                  <Play className="h-4 w-4" />
                  جرب مجاناً
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 justify-center lg:justify-start mt-12">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">+10,000</p>
                <p className="text-sm text-muted-foreground">طالب مسجل</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">24/7</p>
                <p className="text-sm text-muted-foreground">دعم متواصل</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">98%</p>
                <p className="text-sm text-muted-foreground">نسبة الرضا</p>
              </div>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative">
            <div className="glass-card rounded-2xl p-6 glow">
              {/* Mock Dashboard Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full gradient-accent flex items-center justify-center">
                    <Brain className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">مساعد الذكاء الاصطناعي</p>
                    <p className="text-xs text-muted-foreground">متصل الآن</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-500">نشط</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-4 mb-6">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs">👤</span>
                  </div>
                  <div className="glass rounded-lg rounded-tr-none px-4 py-3 max-w-xs">
                    <p className="text-sm text-foreground">كيف أحل معادلة من الدرجة الثانية؟</p>
                  </div>
                </div>

                <div className="flex gap-3 flex-row-reverse">
                  <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-primary/20 rounded-lg rounded-tl-none px-4 py-3 max-w-sm">
                    <p className="text-sm text-foreground">
                      لحل المعادلة التربيعية ax² + bx + c = 0، نستخدم القانون العام:
                    </p>
                    <div className="mt-2 p-2 rounded bg-background/50 font-mono text-xs text-primary">
                      x = (-b ± √(b²-4ac)) / 2a
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <div className="flex-1 glass rounded-lg px-4 py-3">
                  <p className="text-sm text-muted-foreground">اكتب سؤالك هنا...</p>
                </div>
                <Button size="icon" className="gradient-accent border-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 glass-card rounded-xl p-3 animate-bounce">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs text-foreground">حل فوري</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 glass-card rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-foreground">+500 طالب نشط الآن</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
