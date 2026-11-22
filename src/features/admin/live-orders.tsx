"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function LiveOrders({ count, realtime }: { count: number; realtime: { url: string; key: string } | null }) {
  const router = useRouter();
  const lastCount = useRef(count);
  const audio = useRef<AudioContext | null>(null);
  const [seen, setSeen] = useState(count);
  const [sound, setSound] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const url = realtime?.url;
  const key = realtime?.key;

  useEffect(() => {
    if (!url || !key) {
      const timer = window.setInterval(() => router.refresh(), 10_000);
      return () => window.clearInterval(timer);
    }
    const client = createBrowserClient(url, key);
    let timer: number | undefined;
    const fallback = () => { timer ??= window.setInterval(() => router.refresh(), 10_000); };
    fallback();
    const channel = client.channel("mat-nha-admin-orders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_order_signal" }, () => router.refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.clearInterval(timer);
          timer = undefined;
          router.refresh();
        } else fallback();
      });
    return () => {
      window.clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [key, router, url]);

  useEffect(() => {
    const added = count > lastCount.current;
    lastCount.current = count;
    const context = audio.current;
    if (!added || !sound || context?.state !== "running") return;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = 660;
    volume.gain.value = 0.12;
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    tone.connect(volume);
    volume.connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.36);
  }, [count, sound]);

  useEffect(() => () => { void audio.current?.close(); audio.current = null; }, []);

  async function toggleSound() {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setAudioFailed(false);
      setSound(true);
    } catch {
      setAudioFailed(true);
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" className="button" aria-pressed={sound} onClick={toggleSound}>{sound ? "Tắt âm báo" : "Bật âm báo"}</button>
    {count > seen && <button type="button" className="button button-primary" onClick={() => setSeen(count)}>
      {count - seen} đơn mới · Đánh dấu đã xem
    </button>}
    <span className="sr-only" role="status">{count > seen ? (count - seen) + " đơn mới" : ""}</span>
    {audioFailed && <p className="shop-error" role="alert">Trình duyệt chưa bật được âm báo.</p>}
  </div>;
}
