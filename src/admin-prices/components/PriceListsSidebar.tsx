import { ChevronDown, ChevronUp } from "lucide-react";

interface PriceListSummary {
  id: string;
  name: string;
  is_active?: boolean;
  status?: "draft" | "completed" | "archived";
  customer?: string | null;
  project_manager?: string | null;
  project_code?: string | null;
  project_number?: string | null;
  po_number?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  subtotal?: number;
  created_at?: string;
}

type Props = {
  priceLists: PriceListSummary[];
  selectedListId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export default function PriceListsSidebar({
  priceLists,
  selectedListId,
  onSelect,
  collapsed,
  onToggleCollapse,
}: Props) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Price Lists
          </h2>

          <p className="text-xs text-slate-500">
            {priceLists.length} lists
          </p>
        </div>

        {collapsed ? (
          <ChevronDown size={18} />
        ) : (
          <ChevronUp size={18} />
        )}
      </button>

      {!collapsed ? (
        <div className="max-h-[70vh] overflow-y-auto">
          {priceLists.map((list) => {
            const active = selectedListId === list.id;

            return (
              <button
                key={list.id}
                type="button"
                onClick={() => onSelect(list.id)}
                className={[
                  "w-full border-b border-slate-100 px-4 py-3 text-left transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {list.name}
                    </div>

                    {(list.customer || list.project_manager) && (
                      <div
                        className={[
                          "mt-1 text-xs",
                          active
                            ? "text-slate-300"
                            : "text-slate-500",
                        ].join(" ")}
                      >
                        {[list.customer, list.project_manager]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}

                    {list.project_number && (
                      <div
                        className={[
                          "mt-1 text-[11px]",
                          active
                            ? "text-slate-400"
                            : "text-slate-400",
                        ].join(" ")}
                      >
                        {list.project_number}
                      </div>
                    )}
                  </div>

                  {list.status ? (
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
                        active
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {list.status}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}