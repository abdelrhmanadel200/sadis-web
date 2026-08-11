'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Phone, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Institute {
  id: string;
  name: string;
  governorate: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  sort_order: number;
}

// Leaflet is loaded from the CDN at runtime (client-only) so we don't add a
// build dependency. The loader injects the CSS + JS once and resolves the
// global `L`. OpenStreetMap tiles need no API key.
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const MARKER_ICON = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const MARKER_ICON_2X = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const MARKER_SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as unknown as { L: unknown }).L);
    script.onerror = () => reject(new Error('تعذّر تحميل الخريطة'));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

function InstitutesMap({ institutes }: { institutes: Institute[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const withCoords = institutes.filter(
      (i) => typeof i.lat === 'number' && typeof i.lng === 'number',
    );
    loadLeaflet()
      .then((L: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LL = L as any;
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          // Default view: Iraq.
          mapRef.current = LL.map(containerRef.current).setView([33.3, 44.4], 6);
          LL.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
          }).addTo(mapRef.current);
        }
        const icon = LL.icon({
          iconUrl: MARKER_ICON,
          iconRetinaUrl: MARKER_ICON_2X,
          shadowUrl: MARKER_SHADOW,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });
        const bounds: [number, number][] = [];
        withCoords.forEach((i) => {
          const marker = LL.marker([i.lat, i.lng], { icon }).addTo(mapRef.current);
          const place = [i.governorate, i.area].filter(Boolean).join(' - ');
          marker.bindPopup(
            `<b>${i.name}</b>${place ? `<br/>${place}` : ''}${
              i.phone ? `<br/>${i.phone}` : ''
            }`,
          );
          bounds.push([i.lat as number, i.lng as number]);
        });
        if (bounds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mapRef.current as any).fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [institutes]);

  if (mapError) {
    return (
      <div className="rounded-2xl border border-dark-border bg-card/40 py-10 text-center text-muted text-sm">
        تعذّر تحميل الخريطة. تحقّق من اتصال الإنترنت.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-dark-border overflow-hidden"
      style={{ height: 420, width: '100%', zIndex: 0 }}
    />
  );
}

export default function InstitutesPage() {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('institutes')
        .select('*')
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setInstitutes((data ?? []) as Institute[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mapped = institutes.filter(
    (i) => typeof i.lat === 'number' && typeof i.lng === 'number',
  );

  return (
    <main className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted hover:opacity-80 mb-6"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">عناوين المعاهد</h1>
          <p className="text-muted">
            مواقع المعاهد المعتمدة على الخريطة — اضغط على أي علامة لعرض التفاصيل.
          </p>
        </header>

        {loading ? (
          <div className="py-10 text-center text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
          </div>
        ) : institutes.length === 0 ? (
          <div className="py-10 text-center text-muted">لا توجد معاهد مضافة بعد.</div>
        ) : (
          <>
            {mapped.length > 0 && (
              <div className="mb-8">
                <InstitutesMap institutes={mapped} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {institutes.map((i) => (
                <div
                  key={i.id}
                  className="card border border-dark-border rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold mb-1">{i.name}</h3>
                      {(i.governorate || i.area) && (
                        <p className="text-sm text-muted">
                          {[i.governorate, i.area].filter(Boolean).join(' - ')}
                        </p>
                      )}
                      {i.address && (
                        <p className="text-sm text-muted mt-1">{i.address}</p>
                      )}
                      {i.phone && (
                        <a
                          href={`tel:${i.phone}`}
                          dir="ltr"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                        >
                          <Phone className="w-3.5 h-3.5" /> {i.phone}
                        </a>
                      )}
                    </div>
                    {typeof i.lat === 'number' && typeof i.lng === 'number' && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        الاتجاهات
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
