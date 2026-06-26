'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { BookOpen, Video, FileText, ShoppingBag } from 'lucide-react';

const TYPES: { v: Product['type'] | 'all'; l: string }[] = [
  { v: 'all', l: 'الكل' },
  { v: 'book', l: 'كتب' },
  { v: 'summary', l: 'ملخصات' },
  { v: 'video', l: 'فيديوهات' },
];

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Product['type'] | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const q = supabase
        .from('products')
        .select('*')
        .order('chapter_order', { ascending: true });
      const { data, error } = await q;
      if (!error && data) setProducts(data as Product[]);
      setLoading(false);
    })();
  }, []);

  const visible = filter === 'all' ? products : products.filter((p) => p.type === filter);

  return (
    <AppShell>
      <div className="p-5 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="font-cairo font-extrabold text-3xl md:text-4xl mb-2 flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-primary-light" />
            المتجر
          </h1>
          <p className="text-muted">كتب وملخصات وفيديوهات شرح من أفضل الأساتذة</p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          {TYPES.map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
                filter === t.v
                  ? 'bg-primary text-white border-primary'
                  : 'card border border-dark-border text-muted hover:border-primary/40'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-muted text-center py-10">جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="card border border-dark-border rounded-2xl p-12 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted mb-3" />
            <p className="text-muted">لا توجد منتجات حالياً في هذه الفئة</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProductCard({ product }: { product: Product }) {
  const Icon =
    product.type === 'video' ? Video : product.type === 'summary' ? FileText : BookOpen;

  return (
    <Link
      href={`/store/product/${product.id}`}
      className="card border border-dark-border rounded-2xl overflow-hidden hover:border-primary/60 hover:-translate-y-1 transition-all flex flex-col"
    >
      <div className="aspect-[4/5] bg-gradient-to-br from-primary/20 to-primary-light/10 flex items-center justify-center">
        {product.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail_url}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="w-12 h-12 text-primary-light/70" />
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-cairo font-bold text-sm line-clamp-2 mb-1">
          {product.title}
        </h3>
        {product.teacher_name && (
          <p className="text-xs text-muted line-clamp-1 mb-2">{product.teacher_name}</p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm font-bold text-primary-light">
            {product.is_free
              ? 'مجاني'
              : `${product.price_iqd.toLocaleString('ar-IQ')} د.ع`}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-muted">
            {product.type === 'book' ? 'كتاب' : product.type === 'video' ? 'فيديو' : 'ملخص'}
          </span>
        </div>
      </div>
    </Link>
  );
}
