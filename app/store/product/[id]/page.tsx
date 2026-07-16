'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PlatformGate from '@/components/PlatformGate';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Product, Purchase } from '@/lib/types';
import {
  ArrowLeft,
  BookOpen,
  Video,
  FileText,
  Lock,
  PlayCircle,
  Download,
  ShoppingBag,
} from 'lucide-react';

function ProductDetailPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();
      setProduct((data as Product) ?? null);

      if (user) {
        const { data: pur } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', user.id)
          .eq('product_id', params.id)
          .in('payment_status', ['success'])
          .maybeSingle();
        setPurchase((pur as Purchase) ?? null);
      }
      setLoading(false);
    })();
  }, [params, user]);

  const owned = !!purchase || !!product?.is_free;

  const handleBuy = async () => {
    if (!product || !user) return;
    setBuying(true);
    setMsg(null);
    const { error } = await supabase.from('purchases').insert({
      user_id: user.id,
      product_id: product.id,
      amount_iqd: product.price_iqd,
      payment_method: 'manual',
      payment_status: 'pending',
    });
    if (error) {
      setMsg('تعذّر إنشاء الطلب. حاول مرة ثانية');
    } else {
      setMsg('تم إنشاء الطلب — سيتواصل معك فريق الدفع لإكمال العملية');
    }
    setBuying(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-muted">جاري التحميل...</div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="card border border-dark-border rounded-xl p-4 text-sm text-muted">
            المنتج غير موجود
          </div>
        </div>
      </AppShell>
    );
  }

  const Icon =
    product.type === 'video' ? Video : product.type === 'summary' ? FileText : BookOpen;

  return (
    <AppShell>
      <div className="p-5 md:p-8 max-w-5xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-muted hover:opacity-80 mb-5"
        >
          <ArrowLeft className="w-4 h-4 rotate-180" />
          رجوع
        </button>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="aspect-video rounded-xl overflow-hidden border border-dark-border bg-gradient-to-br from-primary/20 to-primary-light/10 flex items-center justify-center">
            {product.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnail_url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon className="w-20 h-20 text-primary-light/70" />
            )}
          </div>

          <div className="space-y-4">
            <span className="inline-flex items-center gap-1 text-xs bg-primary/15 text-primary-light px-3 py-1 rounded-full">
              <Icon className="w-3.5 h-3.5" />
              {product.type === 'book'
                ? 'كتاب'
                : product.type === 'video'
                ? 'فيديو'
                : 'ملخص'}
            </span>

            <h1 className="font-cairo font-extrabold text-2xl md:text-3xl">
              {product.title}
            </h1>

            {product.teacher_name && (
              <p className="text-muted">{product.teacher_name}</p>
            )}

            {product.description && (
              <p className="leading-relaxed">{product.description}</p>
            )}

            <div className="card border border-dark-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">السعر</p>
                <p className="font-bold text-xl text-primary-light">
                  {product.is_free
                    ? 'مجاني'
                    : `${product.price_iqd.toLocaleString('ar-IQ')} د.ع`}
                </p>
              </div>

              {owned ? (
                <span className="text-success text-sm font-semibold flex items-center gap-1">
                  <PlayCircle className="w-5 h-5" /> مفتوح لك
                </span>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="btn-primary disabled:opacity-60"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {buying ? 'جاري...' : 'اشتري الآن'}
                </button>
              )}
            </div>

            {msg && (
              <div className="card border border-dark-border rounded-2xl p-4 space-y-3 text-sm">
                {msg}
              </div>
            )}
          </div>
        </div>

        {owned && product.content_url && (
          <div className="mt-8">
            <h2 className="font-cairo font-bold text-xl mb-3 flex items-center gap-2">
              <Download className="w-5 h-5 text-primary-light" />
              المحتوى
            </h2>
            {product.type === 'video' ? (
              <div className="h-[70vh] rounded-xl overflow-hidden border border-dark-border">
                <video
                  src={product.content_url}
                  controls
                  className="w-full h-full"
                />
              </div>
            ) : (
              <a
                href={product.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex"
              >
                <Download className="w-4 h-4" />
                فتح المحتوى
              </a>
            )}
          </div>
        )}

        {!owned && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Lock className="w-4 h-4" />
            اشتري المنتج لفتح المحتوى الكامل
          </div>
        )}
      </div>
    </AppShell>
  );
}

// The store is a section gated on an active subscription (sectionsActive), so
// the product detail page must be gated too — otherwise a non-subscriber could
// deep-link past the gated listing straight to a product.
export default function ProductDetailPage() {
  return (
    <PlatformGate sectionName="المتجر">
      <ProductDetailPageInner />
    </PlatformGate>
  );
}
