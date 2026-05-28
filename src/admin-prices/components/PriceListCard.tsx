import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Copy,
  Trash2,
  CheckCircle2,
} from "lucide-react";

import PriceListExpanded from "./PriceListExpanded";

type Props = {
  pl: any;
  isOpen: boolean;

  det: any;
  isDetLoading: boolean;
  detErr: string | null;

  duplicatingId: string | null;

  toggleManagerOpen: (id: string) => void;
  handleEditList: (id: string) => void;
  duplicatePriceList: (id: string) => void;

  setPendingDeleteId: (id: string | null) => void;
  setPendingCompleteId: (id: string | null) => void;

  setDeletePasswordInput: (v: string) => void;
  setDeletePasswordError: (v: string | null) => void;

  formatCreatedDate: (value: string) => string;
  formatCurrency: (value: number) => string;
  getProjectNumberFromList: (list: any) => string;
};

export default function PriceListCard({
  pl,
  isOpen,

  det,
  isDetLoading,
  detErr,

  duplicatingId,

  toggleManagerOpen,
  handleEditList,
  duplicatePriceList,

  setPendingDeleteId,
  setPendingCompleteId,

  setDeletePasswordInput,
  setDeletePasswordError,

  formatCreatedDate,
  formatCurrency,
  getProjectNumberFromList,
}: Props) {
  const isCompleted =
    pl.status === "completed";

  const badgeText = isCompleted
    ? "Completed"
    : "Active";

  const created = formatCreatedDate(
    pl.created_at
  );

  const subtotal =
    typeof pl.subtotal === "number" &&
    !isNaN(pl.subtotal)
      ? pl.subtotal
      : null;

  const projectDisplay =
    getProjectNumberFromList(pl);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-900 uppercase tracking-[0.15em]">
              {pl.name || "(NO NAME)"}
            </span>

            {!!pl.is_mdu && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-700">
                MDU
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="font-medium text-slate-700">
              {projectDisplay || "PRJ-XXX"}
            </span>

            {created && (
              <>
                <span className="opacity-60">
                  ·
                </span>

                <span>
                  Created {created}
                </span>
              </>
            )}

            {subtotal !== null && (
              <>
                <span className="opacity-60">
                  ·
                </span>

                <span>
                  {formatCurrency(subtotal)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold border shadow-sm ${
                isCompleted
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }`}
            >
              {badgeText}
            </span>

            <button
              type="button"
              onClick={() =>
                toggleManagerOpen(pl.id)
              }
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] text-slate-700"
            >
              {isOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() =>
                handleEditList(pl.id)
              }
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] text-emerald-700"
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </button>

            <button
              type="button"
              onClick={() =>
                duplicatePriceList(pl.id)
              }
              disabled={duplicatingId === pl.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px]"
            >
              <Copy className="w-3 h-3" />

              {duplicatingId === pl.id
                ? "Duplicating..."
                : "Duplicate"}
            </button>

            {!isCompleted && (
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteId(null);
                  setPendingCompleteId(
                    pl.id
                  );
                  setDeletePasswordInput("");
                  setDeletePasswordError(
                    null
                  );
                }}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px]"
              >
                <CheckCircle2 className="w-3 h-3" />
                Done
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPendingCompleteId(null);
                setPendingDeleteId(pl.id);
                setDeletePasswordInput("");
                setDeletePasswordError(null);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px]"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <PriceListExpanded
          det={det}
          isDetLoading={isDetLoading}
          detErr={detErr}
          formatCurrency={formatCurrency}
          getProjectNumberFromList={
            getProjectNumberFromList
          }
        />
      )}
    </div>
  );
}