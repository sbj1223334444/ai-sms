"use client";

export interface EditableStage {
  /** Stable React key: the stage key, or a temporary id for a stage not saved yet. */
  id: string;
  /** Empty for a new stage; the server assigns one. */
  key: string;
  name: string;
  taskDays: number;
  /** Cannot be moved or removed. The text says why. */
  pinned?: string;
  /** Name and days are fixed too. */
  readOnly?: boolean;
  /** Extra detail under the stage, such as its target date. */
  note?: string;
}

let counter = 0;
export function newStage(): EditableStage {
  counter += 1;
  return { id: `new-${Date.now()}-${counter}`, key: "", name: "New stage", taskDays: 5 };
}

interface Props {
  stages: EditableStage[];
  onChange: (stages: EditableStage[]) => void;
  disabled?: boolean;
}

/**
 * An ordered list of workflow stages with rename, target days, move up, move down, remove and add.
 * Pinned stages hold their place, and nothing can be moved past them.
 */
export default function StageListEditor({ stages, onChange, disabled }: Props) {
  const canMove = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    return !disabled && !stages[i].pinned && j >= 0 && j < stages.length && !stages[j].pinned;
  };

  function move(i: number, dir: -1 | 1) {
    if (!canMove(i, dir)) return;
    const next = stages.slice();
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  }

  function update(i: number, patch: Partial<EditableStage>) {
    onChange(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function add() {
    // New stages go after the last movable stage, before the pinned stages at the end.
    let at = stages.length;
    while (at > 0 && stages[at - 1].pinned) at--;
    const firstFree = stages.findIndex((s) => !s.pinned);
    if (firstFree === -1) at = stages.length - 1;
    const next = stages.slice();
    next.splice(Math.max(at, 0), 0, newStage());
    onChange(next);
  }

  return (
    <div>
      <ol className="space-y-2">
        {stages.map((s, i) => (
          <li key={s.id} className={`card p-3 ${s.readOnly ? "bg-surface" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="id w-6 text-slate1 text-right">{i + 1}</span>
              <input
                aria-label={`Stage ${i + 1} name`}
                className="input flex-1 min-w-[12rem]"
                value={s.name}
                disabled={disabled || s.readOnly}
                maxLength={80}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <label className="flex items-center gap-2 text-[0.8125rem] text-slate1">
                <input
                  aria-label={`Stage ${i + 1} target days`}
                  type="number"
                  min={1}
                  max={365}
                  className="input w-20"
                  value={Number.isFinite(s.taskDays) ? s.taskDays : ""}
                  disabled={disabled || s.readOnly}
                  onChange={(e) => update(i, { taskDays: e.target.value === "" ? NaN : Number(e.target.value) })}
                />
                days
              </label>
              <div className="flex items-center gap-1 ml-auto">
                <button type="button" className="btn-ghost px-2 py-1.5" aria-label={`Move ${s.name} up`} disabled={!canMove(i, -1)} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="btn-ghost px-2 py-1.5" aria-label={`Move ${s.name} down`} disabled={!canMove(i, 1)} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1.5 text-risk-red"
                  aria-label={`Remove ${s.name}`}
                  disabled={disabled || Boolean(s.pinned)}
                  onClick={() => onChange(stages.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
            {(s.pinned || s.note) && (
              <p className="text-[0.8125rem] text-slate1 mt-2 pl-9">
                {[s.note, s.pinned].filter(Boolean).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="btn-ghost mt-3" disabled={disabled} onClick={add}>
        Add stage
      </button>
    </div>
  );
}
