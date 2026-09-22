"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "@/components/icons";

export default function ExportPanel() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function run() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/export?from=${from}&to=${to}`);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Export failed." }));
      setError(body.error);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-sms-reports-${from}-to-${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Download className="h-4 w-4" /> Export to Excel
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-4 shadow-lift">
          <p className="text-sm font-semibold">Export reports</p>
          <p className="mt-0.5 text-[0.8125rem] text-slate1">Reports submitted between these dates, up to 10,000 rows.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label text-[0.8125rem]">From</span>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="field-label text-[0.8125rem]">To</span>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {error && <p className="mt-2 text-[0.8125rem] text-risk-red">{error}</p>}
          <button type="button" className="btn-primary mt-4 w-full" onClick={run} disabled={!from || !to || busy}>
            {busy ? "Preparing" : "Download .xlsx"}
          </button>
        </div>
      )}
    </div>
  );
}
