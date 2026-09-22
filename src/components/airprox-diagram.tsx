"use client";
import { useRef, useState } from "react";
import type { FieldProps } from "@rjsf/utils";

/**
 * "Diagrams of airprox" (BRD form 4, the sheet attached at the end of it).
 *
 * The pilot marks the passage of the other aircraft relative to their own: in plan on the left and
 * in elevation on the right, with their own aircraft at the centre of each. Both the first sighting
 * and the closest point are marked, as the paper form asks.
 *
 * Coordinates are grid units, the same ones printed on the paper sheet: hundreds of metres left or
 * right on both grids, hundreds of metres ahead or behind in plan, hundreds of feet above or below
 * in elevation.
 */

export interface DiagramMark {
  x: number;
  y: number;
}
export interface AirproxMarks {
  plan?: { firstSeen?: DiagramMark; closest?: DiagramMark };
  elevation?: { firstSeen?: DiagramMark; closest?: DiagramMark };
}

type View = "plan" | "elevation";
type Which = "firstSeen" | "closest";

const X_MAX = 14;
const Y_MAX = 10;
const CELL = 20;
const PAD = { left: 34, right: 12, top: 26, bottom: 28 };
const W = X_MAX * 2 * CELL;
const H = Y_MAX * 2 * CELL;

const VIEWS: { view: View; title: string; caption: string; yUnit: string }[] = [
  { view: "plan", title: "View from above", caption: "Plan: ahead is up, and the numbers are hundreds of metres.", yUnit: "m" },
  { view: "elevation", title: "View from astern", caption: "Elevation: up is above you, in hundreds of feet.", yUnit: "ft" }
];

const WHICH: { which: Which; label: string; short: string }[] = [
  { which: "firstSeen", label: "First sighting", short: "1st" },
  { which: "closest", label: "Closest point", short: "CP" }
];

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, Math.round(v)));

/** "600 m right, 400 m ahead", as the readout under each grid. */
export function describeMark(view: View, mark?: DiagramMark): string {
  if (!mark) return "not marked";
  const across = mark.x === 0 ? "" : `${Math.abs(mark.x) * 100} m ${mark.x > 0 ? "right" : "left"}`;
  const along =
    view === "plan"
      ? mark.y === 0
        ? ""
        : `${Math.abs(mark.y) * 100} m ${mark.y > 0 ? "ahead" : "behind"}`
      : mark.y === 0
        ? ""
        : `${Math.abs(mark.y) * 100} ft ${mark.y > 0 ? "above" : "below"}`;
  const parts = [across, along].filter(Boolean);
  return parts.length ? parts.join(", ") : "at your own position";
}

/** One sentence for each view, for the read-only answer list and the printed extract. */
export function describeDiagram(marks: AirproxMarks | undefined): string {
  if (!marks) return "";
  return VIEWS.map(({ view, title }) => {
    const v = marks[view];
    if (!v?.firstSeen && !v?.closest) return "";
    return `${title}: first sighting ${describeMark(view, v?.firstSeen)}; closest point ${describeMark(view, v?.closest)}.`;
  })
    .filter(Boolean)
    .join(" ");
}

function Grid({
  view, marks, active, readOnly, onPlace
}: {
  view: View;
  marks: { firstSeen?: DiagramMark; closest?: DiagramMark };
  active: Which;
  readOnly: boolean;
  onPlace: (mark: DiagramMark) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const px = (x: number) => PAD.left + (x + X_MAX) * CELL;
  const py = (y: number) => PAD.top + (Y_MAX - y) * CELL;

  function place(e: React.MouseEvent<SVGSVGElement>) {
    if (readOnly || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const scale = box.width / (W + PAD.left + PAD.right);
    const x = (e.clientX - box.left) / scale - PAD.left;
    const y = (e.clientY - box.top) / scale - PAD.top;
    onPlace({ x: clamp(x / CELL - X_MAX, X_MAX), y: clamp(Y_MAX - y / CELL, Y_MAX) });
  }

  function nudge(e: React.KeyboardEvent<SVGSVGElement>) {
    if (readOnly) return;
    const step = e.shiftKey ? 5 : 1;
    const from = marks[active] ?? { x: 0, y: 0 };
    const moves: Record<string, DiagramMark> = {
      ArrowLeft: { x: from.x - step, y: from.y },
      ArrowRight: { x: from.x + step, y: from.y },
      ArrowUp: { x: from.x, y: from.y + step },
      ArrowDown: { x: from.x, y: from.y - step }
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    onPlace({ x: clamp(next.x, X_MAX), y: clamp(next.y, Y_MAX) });
  }

  const lines = [];
  for (let x = -X_MAX; x <= X_MAX; x++) {
    const major = x % 5 === 0;
    lines.push(
      <line key={`v${x}`} x1={px(x)} y1={py(Y_MAX)} x2={px(x)} y2={py(-Y_MAX)}
        stroke={x === 0 ? "#334155" : major ? "#cbd5e1" : "#e8edf3"} strokeWidth={x === 0 ? 1.4 : 1} />
    );
  }
  for (let y = -Y_MAX; y <= Y_MAX; y++) {
    const major = y % 5 === 0;
    lines.push(
      <line key={`h${y}`} x1={px(-X_MAX)} y1={py(y)} x2={px(X_MAX)} y2={py(y)}
        stroke={y === 0 ? "#334155" : major ? "#cbd5e1" : "#e8edf3"} strokeWidth={y === 0 ? 1.4 : 1} />
    );
  }

  const ticks = [];
  for (let x = -X_MAX + 1; x < X_MAX; x += 2) {
    ticks.push(<text key={`tx${x}`} x={px(x)} y={PAD.top - 10} textAnchor="middle" fontSize="8" fill="#64748b">{Math.abs(x)}</text>);
  }
  for (let y = -Y_MAX + 2; y < Y_MAX; y += 2) {
    ticks.push(<text key={`ty${y}`} x={PAD.left - 8} y={py(y) + 3} textAnchor="end" fontSize="8" fill="#64748b">{Math.abs(y)}</text>);
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W + PAD.left + PAD.right} ${H + PAD.top + PAD.bottom}`}
      className={`w-full rounded-xl border border-line bg-white ${readOnly ? "" : "cursor-crosshair focus:outline-none focus:ring-2 focus:ring-chart/40"}`}
      role={readOnly ? "img" : "application"}
      tabIndex={readOnly ? -1 : 0}
      aria-label={
        readOnly
          ? `${view === "plan" ? "Plan view" : "Elevation view"}: first sighting ${describeMark(view, marks.firstSeen)}, closest point ${describeMark(view, marks.closest)}`
          : `${view === "plan" ? "Plan view" : "Elevation view"}. Click to place the ${WHICH.find((w) => w.which === active)!.label.toLowerCase()}, or move it with the arrow keys.`
      }
      onClick={place}
      onKeyDown={nudge}
    >
      {lines}
      {ticks}
      {/* Own aircraft, at the centre of the diagram */}
      <g>
        <line x1={px(0) - 9} y1={py(0)} x2={px(0) + 9} y2={py(0)} stroke="#0f172a" strokeWidth="2.5" />
        <line x1={px(0)} y1={py(0) - 6} x2={px(0)} y2={py(0) + 6} stroke="#0f172a" strokeWidth="2.5" />
        <text x={px(0) + 12} y={py(0) - 6} fontSize="8" fill="#0f172a" fontWeight="600">YOU</text>
      </g>
      {marks.firstSeen && marks.closest && (
        <line x1={px(marks.firstSeen.x)} y1={py(marks.firstSeen.y)} x2={px(marks.closest.x)} y2={py(marks.closest.y)}
          stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {WHICH.map(({ which, short }) => {
        const m = marks[which];
        if (!m) return null;
        const filled = which === "closest";
        return (
          <g key={which}>
            <circle cx={px(m.x)} cy={py(m.y)} r="6.5" fill={filled ? "#0EA5E9" : "#ffffff"} stroke="#0EA5E9" strokeWidth="2" />
            <text x={px(m.x) + 10} y={py(m.y) - 8} fontSize="8.5" fontWeight="600" fill="#0369a1">{short}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface DiagramProps {
  value: AirproxMarks;
  readOnly?: boolean;
  onChange?: (next: AirproxMarks) => void;
}

/** Both diagrams side by side, with the readout the paper form asks for underneath. */
export function AirproxDiagram({ value, readOnly = false, onChange }: DiagramProps) {
  const [active, setActive] = useState<Which>("firstSeen");

  function place(view: View, which: Which, mark: DiagramMark | undefined) {
    onChange?.({ ...value, [view]: { ...(value[view] ?? {}), [which]: mark } });
  }

  const marked = VIEWS.some(({ view }) => value[view]?.firstSeen || value[view]?.closest);

  return (
    <div>
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-slate1">Marking:</span>
          {WHICH.map(({ which, label }) => (
            <button
              key={which}
              type="button"
              aria-pressed={active === which}
              onClick={() => setActive(which)}
              className={`rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition ${
                active === which ? "border-chart bg-chart text-white" : "border-line text-slate1 hover:bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
          {marked && (
            <button type="button" className="ml-auto text-[0.8125rem] font-medium text-risk-red"
              onClick={() => onChange?.({})}>
              Clear both diagrams
            </button>
          )}
        </div>
      )}

      {/* Stacked, not side by side: the form column is narrow, and a squeezed grid cannot be read. */}
      <div className="space-y-6">
        {VIEWS.map(({ view, title, caption }) => {
          const marks = value[view] ?? {};
          return (
            <div key={view} className="min-w-0">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mb-2 text-[0.75rem] text-slate1">{caption}</p>
              <Grid
                view={view}
                marks={marks}
                active={active}
                readOnly={readOnly}
                onPlace={(mark) => place(view, active, mark)}
              />
              <dl className="mt-2 space-y-1 text-[0.8125rem]">
                {WHICH.map(({ which, label }) => (
                  <div key={which} className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-slate1">{label}:</dt>
                    <dd className="font-medium text-ink">{describeMark(view, marks[which])}</dd>
                    {!readOnly && marks[which] && (
                      <button type="button" className="text-[0.75rem] text-risk-red" onClick={() => place(view, which, undefined)}>
                        clear
                      </button>
                    )}
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The form field. A form asks for it with "ui:field": "airproxDiagram" on an object property - see
 * config/forms/air-traffic-incident.json.
 */
export function AirproxDiagramField(props: FieldProps) {
  const { formData, onChange, schema, disabled, readonly } = props;
  return (
    <div className="field">
      <p className="field-label">{typeof schema.title === "string" ? schema.title : "Diagrams of airprox"}</p>
      {typeof schema.description === "string" && <p className="field-hint -mt-0.5 mb-3">{schema.description}</p>}
      <AirproxDiagram
        value={(formData ?? {}) as AirproxMarks}
        readOnly={Boolean(disabled || readonly)}
        onChange={(next) => onChange(next)}
      />
    </div>
  );
}
