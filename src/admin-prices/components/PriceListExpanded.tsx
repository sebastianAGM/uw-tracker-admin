type Props = {
  det: any;
  isDetLoading: boolean;
  detErr: string | null;
  formatCurrency: (value: number) => string;
  getProjectNumberFromList: (list: any) => string;
};

export default function PriceListExpanded({
  det,
  isDetLoading,
  detErr,
  formatCurrency,
  getProjectNumberFromList,
}: Props) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700">
      {isDetLoading && <div>Loading prices…</div>}

      {detErr && (
        <div className="text-rose-600">
          Error: {detErr}
        </div>
      )}

      {det && !isDetLoading && !detErr && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 space-y-1">
              <div className="text-[10px] font-semibold text-slate-700 uppercase">
                List metadata
              </div>

              <div className="text-[10px] text-slate-600">
                <b>Customer:</b>{" "}
                {det.list.customer || "—"}
              </div>

              <div className="text-[10px] text-slate-600">
                <b>Project Manager:</b>{" "}
                {det.list.project_manager || "—"}
              </div>

              <div className="text-[10px] text-slate-600">
                <b>Project Number:</b>{" "}
                {getProjectNumberFromList(det.list) || "—"}
              </div>

              <div className="text-[10px] text-slate-600">
                <b>PO Number:</b>{" "}
                {det.list.po_number || "—"}
              </div>

              <div className="text-[10px] text-slate-600">
                <b>City:</b>{" "}
                {det.list.city || "—"}
              </div>

              <div className="text-[10px] text-slate-600">
                <b>State:</b>{" "}
                {det.list.state || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}