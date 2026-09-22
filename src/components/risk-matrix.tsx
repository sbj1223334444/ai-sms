"use client";
import cfg from "@config/risk-matrix.json";

type Zone = "red" | "orange" | "yellow" | "green";

const FILL: Record<Zone, string> = {
  red: "bg-risk-red text-white",
  orange: "bg-risk-orange text-white",
  yellow: "bg-risk-yellow text-ink",
  green: "bg-risk-green text-white"
};

export function zoneOf(index: string): Zone | null {
  return ((cfg.cells as Record<string, string>)[index] as Zone) ?? null;
}

export function RiskChip({ index }: { index?: string }) {
  if (!index) return <span className="text-sm text-slate1">Not rated</span>;
  const zone = zoneOf(index);
  const info = zone ? (cfg.zones as Record<string, { label: string }>)[zone] : null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[0.8125rem] font-medium ${zone ? FILL[zone] : ""}`}>
      <span className="id">{index}</span>
      {info && <span className="font-normal opacity-90">{info.label}</span>}
    </span>
  );
}

/**
 * The 5x5 is the one place colour carries meaning, so everything around it stays neutral.
 * Selection is a grid of buttons rather than two dropdowns: an investigator picks the cell
 * they can see, the way the paper matrix works.
 */
export default function RiskMatrix({
  value,
  onChange,
  label,
  disabled
}: {
  value?: string;
  onChange: (index: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const zone = value ? zoneOf(value) : null;
  const info = zone ? (cfg.zones as Record<string, { label: string; tolerability: string; authority: string }>)[zone] : null;

  return (
    <div>
      <p className="label mb-2">{label}</p>
      <div className="inline-block border border-line rounded bg-white p-3">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-24" />
              {cfg.severity.map((s) => (
                <th key={s.code} className="px-1 pb-1 text-[0.6875rem] font-medium text-slate1 w-20 leading-tight">
                  {s.code} {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cfg.probability.map((p) => (
              <tr key={p.code}>
                <th className="pr-2 text-right text-[0.6875rem] font-medium text-slate1 leading-tight">
                  {p.code} {p.label}
                </th>
                {cfg.severity.map((s) => {
                  const index = `${p.code}${s.code}`;
                  const cellZone = zoneOf(index)!;
                  const selected = value === index;
                  return (
                    <td key={index}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={`Risk index ${index}, ${cellZone}`}
                        onClick={() => onChange(index)}
                        className={`h-9 w-full rounded text-[0.8125rem] font-medium transition-[outline] ${FILL[cellZone]}
                          ${selected ? "outline outline-2 outline-offset-2 outline-ink" : "opacity-75 hover:opacity-100"}
                          disabled:cursor-not-allowed`}
                      >
                        {index}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {info && (
        <p className="mt-2 text-[0.8125rem] text-slate1 max-w-md">
          <span className="font-medium text-ink">{info.label}.</span> {info.tolerability} Acceptance authority: {info.authority}.
        </p>
      )}
    </div>
  );
}
