"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Trophy, BookOpen, Users, Heart, Star, ThumbsUp } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "منتديات النقاش",
    description: "ناقش المواضيع الدراسية مع زملائك واحصل على إجابات فورية",
  },
  {
    icon: Trophy,
    title: "قصص نجاح الطلاب",
    description: "استلهم من تجارب الطلاب المتفوقين وتعلم من أساليبهم",
  },
  {
    icon: BookOpen,
    title: "موارد دراسية مشتركة",
    description: "شارك ملاحظاتك وملخصاتك واستفد من مشاركات الآخرين",
  },
];

const mockComments = [
  {
    name: "أحمد محمد",
    avatar: "أ",
    comment: "التطبيق ساعدني كثيراً في فهم الرياضيات!",
    likes: 24,
    time: "منذ ساعتين",
  },
  {
    name: "زهراء علي",
    avatar: "ز",
    comment: "أفضل منصة للدراسة، شكراً سادس ألترا",
    likes: 18,
    time: "منذ 3 ساعات",
  },
  {
    name: "محمد حسين",
    avatar: "م",
    comment: "حصلت على درجة كاملة في الامتحان بفضلكم",
    likes: 42,
    time: "منذ 5 ساعات",
  },
];

const stats = [
  { value: "15,000+", label: "طالب نشط" },
  { value: "50,000+", label: "سؤال تمت الإجابة عليه" },
  { value: "1,200+", label: "ملخص مشترك" },
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
            انضم إلى أكبر مجتمع لطلاب{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-teal-400">
              السادس الإعدادي
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            تبادل الملاحظات، شارك التجارب، واحصل على التحفيز مع آلاف الطلاب في جميع أنحاء العراق
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Features */}
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
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-teal-400">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Social Proof Widget */}
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-cyan-500/20 rounded-3xl blur-2xl opacity-50" />
            
            {/* Widget Container */}
            <div className="relative rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden backdrop-blur-xl">
              {/* Widget Header */}
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-sm font-medium text-foreground">المحادثات النشطة</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span>1,247 متصل الآن</span>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="p-4 space-y-4">
                {mockComments.map((comment, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {comment.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-foreground">{comment.name}</span>
                          <span className="text-xs text-muted-foreground">{comment.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{comment.comment}</p>
                        <div className="flex items-center gap-4">
                          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-400 transition-colors">
                            <Heart className="w-3.5 h-3.5" />
                            <span>{comment.likes}</span>
                          </button>
                          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-400 transition-colors">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>رد</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Widget Footer */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {["س", "ع", "ن", "ر"].map((letter, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/80 to-teal-500/80 border-2 border-slate-900 flex items-center justify-center text-white text-xs font-medium"
                      >
                        {letter}
                      </div>
                    ))}
                    <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-white text-xs">
                      +99
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    انضم إليهم الآن
                  </span>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 p-3 rounded-xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium">4.9/5</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 p-3 rounded-xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-medium">98% راضون</span>
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
            مجاناً - لا يتطلب بطاقة ائتمان
          </p>
        </div>
      </div>
    </section>
  );
}
