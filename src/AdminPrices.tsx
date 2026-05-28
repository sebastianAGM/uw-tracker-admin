import AuthBanner from "./admin-prices/components/AuthBanner";
import PriceListsSidebar from "./admin-prices/components/PriceListsSidebar";
import PriceListCard from "./admin-prices/components/PriceListCard";

import React, { useEffect, useMemo, useState } from "react";

import {
  TASK_DEFS,
  TASK_INDEX,
  PRICE_TASK_SECTIONS,
  getVariantsForTask,
  normVariant,
  type TaskGroup,
  type TaskItem,
} from "@shared/taskCatalog";

import type {
  BackendPrice,
  ActiveList,
  PriceRow,
  PriceListSummary,
  PriceListDetails,
} from "./lib/priceTypes";

import {
  DELETE_PASSWORD,
  generateRowId,
  createEmptyRow,
  formatCurrency,
  formatCreatedDate,
  sortPriceLists,
  upper,
 getProjectNumberFromList,
  buildMetaPayload,
} from "./lib/priceHelpers";

import {
  isAuthError,
  clearAuthSession,
} from "./lib/priceAuth";

import {
  API_BASE,
  TOKEN_KEY,
  PRICE_LISTS_ENDPOINT,
  PRICES_ENDPOINT,
  PRICES_BULK_ENDPOINT,
  PRICE_LIST_DETAILS_ENDPOINT,
  getStoredToken,
  setStoredToken,
  tokenFetch,
} from "./lib/priceApi";

import {
  DollarSign,
  RefreshCw,
  Save,
  Plus,
  Info,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  LogOut,
  Copy,
} from "lucide-react";



// ================== CONFIG ==================


// ================== MAIN COMPONENT ==================
const PricesView: React.FC = () => {
  const [activeList, setActiveList] = useState<ActiveList | null>(null);

  const [listName, setListName] = useState("");
  const [customer, setCustomer] = useState("");
  const [projectManager, setProjectManager] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [city, setCity] = useState("");
  const [stateUS, setStateUS] = useState("");
  const [address, setAddress] = useState("");

  const [isMDU, setIsMDU] = useState(false);
  const [mduStartDate, setMduStartDate] = useState("");
  const [mduCloseOutBy, setMduCloseOutBy] = useState("");
  const [mduPoAmount, setMduPoAmount] = useState("");
  const [mduTotalAmount, setMduTotalAmount] = useState("");
  const [mduHourRate, setMduHourRate] = useState("");

  const [rows, setRows] = useState<PriceRow[]>([createEmptyRow()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  const [priceLists, setPriceLists] = useState<PriceListSummary[]>([]);
  const [missingVariants, setMissingVariants] = useState<any[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const [deletePasswordInput, setDeletePasswordInput] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  const [openListIds, setOpenListIds] = useState<Set<string>>(() => new Set());
  const [detailsById, setDetailsById] = useState<Record<string, PriceListDetails>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsError, setDetailsError] = useState<Record<string, string>>({});

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
 PRICE_TASK_SECTIONS.reduce<Record<string, boolean>>((acc, s) => {
    acc[s.id] = false;
    return acc;
  }, {})
);

  const [needsAuth, setNeedsAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState(() => getStoredToken() || "");
  const [authHint, setAuthHint] = useState<string | null>(null);

 function resetSectionsCollapsed() {
  setOpenSections(
    PRICE_TASK_SECTIONS.reduce<Record<string, boolean>>((acc, s) => {
      acc[s.id] = false;
      return acc;
    }, {})
  );
}

  useEffect(() => {
    loadPriceLists();
    loadMissingVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setActiveList(null);
    setListName("");
    setCustomer("");
    setProjectManager("");
    setProjectNumber("");
    setPoNumber("");
    setCity("");
    setStateUS("");
    setAddress("");

    setIsMDU(false);
    setMduStartDate("");
    setMduCloseOutBy("");
    setMduPoAmount("");
    setMduTotalAmount("");
    setMduHourRate("");

    setRows([createEmptyRow()]);
    setError(null);
    setSaved(false);
    setMetaSaved(false);
    resetSectionsCollapsed();
  }

  async function loadPriceLists() {
    try {
      setIsLoading(true);
      const res = await tokenFetch(PRICE_LISTS_ENDPOINT, { method: "GET" });
      const json: any = await res.json().catch(() => ({}));
      console.log("DEBUG price-lists GET =>", json);

      if (!res.ok || json.ok === false) {
        if (isAuthError(json, res.status)) {
          setNeedsAuth(true);
          setAuthHint(
            "Tu Worker está pidiendo sesión admin. En local, pega tu ADMIN_TOKEN y guarda (se usa como Bearer)."
          );
          setError("Sesión admin no válida (no_session).");
          setPriceLists([]);
          return;
        }
        throw new Error(json.error || `Error loading price lists (${res.status})`);
      }

      const lists: PriceListSummary[] = Array.isArray(json.lists)
        ? json.lists
        : Array.isArray(json)
        ? json
        : [];

      setNeedsAuth(false);
      setAuthHint(null);
      setPriceLists(sortPriceLists(lists));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMissingVariants() {
    try {
      const res = await tokenFetch(`${API_BASE}/api/admin/prices/missing`, { method: "GET" });
      if (!res.ok) {
        const j: any = await res.json().catch(() => ({}));
        if (isAuthError(j, res.status)) setNeedsAuth(true);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setMissingVariants((json as any).missing || []);
    } catch {
      // silencioso
    }
  }

  async function loadPricesForList(listId: string) {
    if (!listId) return;
    try {
      setIsLoading(true);
      setError(null);

      const resDetails = await tokenFetch(PRICE_LIST_DETAILS_ENDPOINT(listId), { method: "GET" });
      const raw = await resDetails.text();
      const json = raw ? JSON.parse(raw) : null;
      console.log("DEBUG price-lists/:id GET =>", json);

      if (!resDetails.ok || json?.ok === false) {
        if (isAuthError(json, resDetails.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(json?.error || `Error loading prices (${resDetails.status})`);
      }

      const prices: BackendPrice[] = Array.isArray(json.prices) ? json.prices : [];
      if (!prices.length) {
        setRows([createEmptyRow()]);
        return;
      }

      const mapped: PriceRow[] = prices.map((p) => {
        const def = TASK_INDEX[p.task_key] || ({} as TaskItem);
        return {
          rowId: generateRowId(),
          taskKey: String(p.task_key || "").trim().toUpperCase(),
          unit: p.unit || def.unit || "",
          variantCode: p.variant_code ? normVariant(p.variant_code) : "",
          pricePerUnit: typeof p.price_per_unit === "number" ? String(p.price_per_unit) : "",
        };
      });

      setRows(mapped.length ? mapped : [createEmptyRow()]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error loading prices");
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadListDetails(listId: string) {
    if (!listId) return;

    setDetailsLoading((p) => ({ ...p, [listId]: true }));
    setDetailsError((p) => ({ ...p, [listId]: "" }));

    try {
      const res = await tokenFetch(PRICE_LIST_DETAILS_ENDPOINT(listId), { method: "GET" });
      const raw = await res.text();
      const json = raw ? JSON.parse(raw) : null;

      if (!res.ok || json?.ok === false) {
        if (isAuthError(json, res.status)) {
          setNeedsAuth(true);
          setDetailsError((p) => ({ ...p, [listId]: "no_session (login again)" }));
          return;
        }
        throw new Error(json?.error || `Error loading list details (${res.status})`);
      }

      setDetailsById((p) => ({
        ...p,
        [listId]: {
          list: json.list,
          prices: Array.isArray(json.prices) ? json.prices : [],
        },
      }));
    } catch (e: any) {
      setDetailsError((p) => ({
        ...p,
        [listId]: e?.message || "Error loading list details",
      }));
    } finally {
      setDetailsLoading((p) => ({ ...p, [listId]: false }));
    }
  }

  async function ensureListDetailsLoaded(listId: string) {
    if (!listId) return;
    if (detailsById[listId] || detailsLoading[listId]) return;
    await reloadListDetails(listId);
  }

  function toggleManagerOpen(listId: string) {
    setOpenListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
    ensureListDetailsLoaded(listId);
  }

  async function handleCreateList() {
    try {
      setError(null);
      setSaved(false);
      setMetaSaved(false);

      if (!listName.trim()) {
        setError("Price list name is required to create a new list.");
        return;
      }

      const meta = buildMetaPayload({
        name: listName,
        customer,
        projectManager,
        projectNumber,
        poNumber,
        city,
        stateUS,
        address,
        isMDU,
        mduStartDate,
        mduCloseOutBy,
        mduPoAmount,
        mduTotalAmount,
        mduHourRate,
      });

      const res = await tokenFetch(PRICE_LISTS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          ...meta,
          activate: true,
        }),
      });

      const json: any = await res.json().catch(() => ({}));
      console.log("DEBUG price-lists POST =>", json);

      if (!res.ok || json.ok === false || !json.id) {
        if (isAuthError(json, res.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(json.error || `Error creating price list (${res.status})`);
      }

      const newList: ActiveList = { id: json.id, name: meta.name };

      await loadPriceLists();

      setActiveList(newList);
      setRows([createEmptyRow()]);
      resetSectionsCollapsed();

      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error creating price list");
    }
  }

  async function savePrices() {
    try {
      setIsSaving(true);
      setError(null);
      setSaved(false);

      if (!activeList?.id) {
        setError("Select or create a price list before saving prices.");
        return;
      }

      const listId = activeList.id;

      const baseRows = rows
        .filter((r) => r.taskKey && r.pricePerUnit !== "")
        .map((r) => {
          const taskKey = String(r.taskKey || "").trim().toUpperCase();
          const def = TASK_INDEX[taskKey] || ({} as TaskItem);
          const unit = (r.unit || def.unit || "").trim();
          const price = Number(r.pricePerUnit);

          const allowedVariants = getVariantsForTask(taskKey);
          let variant = normVariant(r.variantCode);
          if (allowedVariants.length === 0) variant = "";

          return {
            list_id: listId,
            task_key: taskKey,
            unit: unit || null,
            variant_code: variant ? variant : "",
            price_per_unit: Number.isFinite(price) ? price : 0,
          };
        });

      if (!baseRows.length) {
        setError("Nothing to save. Select at least one task and price.");
        return;
      }

      const seen = new Set<string>();
      for (const row of baseRows) {
        const key = `${row.task_key}::${normVariant(row.variant_code || "")}`;
        if (seen.has(key)) {
          setError(
            `Duplicate task in this price list: ${row.task_key}${
              row.variant_code ? " · " + row.variant_code : ""
            }. Use only one row per task/variant.`
          );
          return;
        }
        seen.add(key);
      }

      console.log("DEBUG savePrices payload =>", baseRows);

      const res = await tokenFetch(PRICES_BULK_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(baseRows),
      });

      const json: any = await res.json().catch(() => ({}));
      console.log("DEBUG prices/bulk response =>", json);

      if (!res.ok || json.ok === false) {
        if (isAuthError(json, res.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(json.error || `Error saving prices (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      await loadPriceLists();
      await reloadListDetails(listId);
      await loadPricesForList(listId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error saving prices");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveListMetadata() {
    if (!activeList?.id) return;

    try {
      setIsSavingMeta(true);
      setError(null);
      setMetaSaved(false);

      const meta = buildMetaPayload({
        name: listName,
        customer,
        projectManager,
        projectNumber,
        poNumber,
        city,
        stateUS,
        address,
        isMDU,
        mduStartDate,
        mduCloseOutBy,
        mduPoAmount,
        mduTotalAmount,
        mduHourRate,
      });

      const res = await tokenFetch(PRICE_LISTS_ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify({
          id: activeList.id,
          op: "update_metadata",
          ...meta,
        }),
      });

      const json: any = await res.json().catch(() => ({}));
      console.log("DEBUG price-lists PATCH update_metadata =>", json);

      if (!res.ok || json.ok === false) {
        if (isAuthError(json, res.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(json.error || `Error updating metadata (${res.status})`);
      }

      setActiveList({ id: activeList.id, name: meta.name });

      setPriceLists((prev) =>
        sortPriceLists(
          prev.map((pl) =>
            pl.id === activeList.id
              ? {
                  ...pl,
                  name: meta.name,
                  customer: meta.customer,
                  project_manager: meta.project_manager,
                  project_code: meta.project_code,
                  project_number: meta.project_number,
                  po_number: meta.po_number,
                  city: meta.city,
                  state: meta.state,
                  address: meta.address,
                  is_mdu: meta.is_mdu,
                  mdu_start_date: meta.mdu_start_date,
                  mdu_close_out_by: meta.mdu_close_out_by,
                  mdu_po_amount: meta.mdu_po_amount,
                  mdu_total_amount: meta.mdu_total_amount,
                  mdu_hour_rate: meta.mdu_hour_rate,
                }
              : pl
          )
        )
      );

      setDetailsById((prev) => {
        const current = prev[activeList.id];
        if (!current) return prev;
        return {
          ...prev,
          [activeList.id]: {
            ...current,
            list: {
              ...current.list,
              name: meta.name,
              customer: meta.customer,
              project_manager: meta.project_manager,
              project_code: meta.project_code,
              project_number: meta.project_number,
              po_number: meta.po_number,
              city: meta.city,
              state: meta.state,
              address: meta.address,
              is_mdu: meta.is_mdu,
              mdu_start_date: meta.mdu_start_date,
              mdu_close_out_by: meta.mdu_close_out_by,
              mdu_po_amount: meta.mdu_po_amount,
              mdu_total_amount: meta.mdu_total_amount,
              mdu_hour_rate: meta.mdu_hour_rate,
            },
          },
        };
      });

      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 1500);

      await loadPriceLists();
      await reloadListDetails(activeList.id);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error updating metadata");
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function duplicatePriceList(sourceListId: string) {
    try {
      setDuplicatingId(sourceListId);
      setError(null);

      const source = priceLists.find((pl) => pl.id === sourceListId);
      if (!source) {
        setError("Source price list not found.");
        return;
      }

      const resDetails = await tokenFetch(PRICE_LIST_DETAILS_ENDPOINT(sourceListId), {
        method: "GET",
      });

      const raw = await resDetails.text();
      const details = raw ? JSON.parse(raw) : null;

      if (!resDetails.ok || details?.ok === false) {
        if (isAuthError(details, resDetails.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(details?.error || `Error loading source list (${resDetails.status})`);
      }

      const sourcePrices: BackendPrice[] = Array.isArray(details?.prices) ? details.prices : [];
      const duplicateName = `${source.name || "PRICE LIST"} - COPY`;

      const meta = buildMetaPayload({
        name: duplicateName,
        customer: String(source.customer || ""),
        projectManager: String(source.project_manager || ""),
        projectNumber: getProjectNumberFromList(source),
        poNumber: String(source.po_number || ""),
        city: String(source.city || ""),
        stateUS: String(source.state || ""),
        address: String(source.address || ""),
        isMDU: !!source.is_mdu,
        mduStartDate: String(source.mdu_start_date || ""),
        mduCloseOutBy: String(source.mdu_close_out_by || ""),
        mduPoAmount:
          source.mdu_po_amount != null ? String(source.mdu_po_amount) : "",
        mduTotalAmount:
          source.mdu_total_amount != null ? String(source.mdu_total_amount) : "",
        mduHourRate:
          source.mdu_hour_rate != null ? String(source.mdu_hour_rate) : "",
      });

      const resCreate = await tokenFetch(PRICE_LISTS_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          ...meta,
          activate: true,
        }),
      });

      const created: any = await resCreate.json().catch(() => ({}));

      if (!resCreate.ok || created?.ok === false || !created?.id) {
        if (isAuthError(created, resCreate.status)) {
          setNeedsAuth(true);
          setError("Sesión admin no válida (no_session).");
          return;
        }
        throw new Error(created?.error || `Error creating duplicate list (${resCreate.status})`);
      }

      const newListId = created.id;

      if (sourcePrices.length) {
        const duplicatedRows = sourcePrices.map((p) => ({
          list_id: newListId,
          task_key: String(p.task_key || "").trim().toUpperCase(),
          unit: p.unit || null,
          variant_code: p.variant_code ? normVariant(p.variant_code) : "",
          price_per_unit:
            typeof p.price_per_unit === "number" && Number.isFinite(p.price_per_unit)
              ? p.price_per_unit
              : 0,
        }));

        const resBulk = await tokenFetch(PRICES_BULK_ENDPOINT, {
          method: "POST",
          body: JSON.stringify(duplicatedRows),
        });

        const bulkJson: any = await resBulk.json().catch(() => ({}));

        if (!resBulk.ok || bulkJson?.ok === false) {
          throw new Error(bulkJson?.error || `Error copying prices (${resBulk.status})`);
        }
      }

      await loadPriceLists();

      setActiveList({ id: newListId, name: duplicateName });
      setListName(meta.name);
      setCustomer(String(meta.customer || ""));
      setProjectManager(String(meta.project_manager || ""));
      setProjectNumber(String(meta.project_number || ""));
      setPoNumber(String(meta.po_number || ""));
      setCity(String(meta.city || ""));
      setStateUS(String(meta.state || ""));
      setAddress(String(meta.address || ""));
      setIsMDU(!!meta.is_mdu);
      setMduStartDate(String(meta.mdu_start_date || ""));
      setMduCloseOutBy(String(meta.mdu_close_out_by || ""));
      setMduPoAmount(
        meta.mdu_po_amount !== null && meta.mdu_po_amount !== undefined
          ? String(meta.mdu_po_amount)
          : ""
      );
      setMduTotalAmount(
        meta.mdu_total_amount !== null && meta.mdu_total_amount !== undefined
          ? String(meta.mdu_total_amount)
          : ""
      );
      setMduHourRate(
        meta.mdu_hour_rate !== null && meta.mdu_hour_rate !== undefined
          ? String(meta.mdu_hour_rate)
          : ""
      );

      await loadPricesForList(newListId);
      await reloadListDetails(newListId);

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Error duplicating price list");
    } finally {
      setDuplicatingId(null);
    }
  }

  function updateRow(rowId: string, patch: Partial<PriceRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function onTaskChange(rowId: string, newTaskKey: string) {
    const tk = String(newTaskKey || "").trim().toUpperCase();
    const def = TASK_INDEX[tk] || ({} as TaskItem);
    const variants = getVariantsForTask(tk);

    updateRow(rowId, {
      taskKey: tk,
      unit: def.unit || "",
      variantCode: variants.length ? variants[0] : "",
    });
  }

  function deleteRow(rowId: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.rowId !== rowId);
      return next.length ? next : [createEmptyRow()];
    });
  }

  function addRowForGroup(groupName: string) {
  setRows((prev) => [
    ...prev,
    {
      ...createEmptyRow(),
      taskKey: "",
      unit: "",
      variantCode: "",
    },
  ]);

  const groupDef = TASK_DEFS.find((g) => g.group === groupName);
  const firstItem = groupDef?.items[0];

  const tk = String(firstItem?.key || "").trim().toUpperCase();
  const variants = getVariantsForTask(tk);

  setRows((prev) => [
    ...prev,
    {
      ...createEmptyRow(),
      taskKey: tk,
      unit: firstItem?.unit || "",
      variantCode: variants.length ? variants[0] : "",
    },
  ]);
}

function addAllVariantRowsForTask(taskKey: string) {
  const tk = String(taskKey || "").trim().toUpperCase();
  const def = TASK_INDEX[tk] || ({} as TaskItem);
  const variants = getVariantsForTask(tk);

  if (!tk) return;

  setRows((prev) => {
    const existing = new Set(
      prev.map((r) => `${r.taskKey}::${normVariant(r.variantCode || "")}`)
    );

    const rowsToAdd =
      variants.length > 0
        ? variants
            .filter((v) => !existing.has(`${tk}::${normVariant(v)}`))
            .map((v) => ({
              ...createEmptyRow(),
              taskKey: tk,
              unit: def.unit || "",
              variantCode: normVariant(v),
            }))
        : existing.has(`${tk}::`)
        ? []
        : [
            {
              ...createEmptyRow(),
              taskKey: tk,
              unit: def.unit || "",
              variantCode: "",
            },
          ];

    return [...prev, ...rowsToAdd];
  });
}

  const stats = useMemo(() => {
    const prices = rows
      .map((r) => Number(r.pricePerUnit))
      .filter((n) => !isNaN(n) && n > 0);
    if (!prices.length) return { count: 0, avg: 0, min: 0, max: 0 };
    const count = prices.length;
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { count, avg, min, max };
  }, [rows]);

  function patchList(id: string, patch: Partial<PriceListSummary>) {
    setPriceLists((prev) =>
      sortPriceLists(prev.map((pl) => (pl.id === id ? { ...pl, ...patch } : pl)))
    );
  }

  function removeList(id: string) {
    setPriceLists((prev) => sortPriceLists(prev.filter((pl) => pl.id !== id)));
  }

  function handleEditList(id: string) {
    const list = priceLists.find((pl) => pl.id === id);
    if (!list) return;

    setPriceLists((prev) =>
      sortPriceLists(
        prev.map((pl) => (pl.id === id ? { ...pl, is_active: true } : { ...pl, is_active: false }))
      )
    );

    const metaName = list.name || "";
    setActiveList({ id: list.id, name: metaName });
    setListName(metaName);
    setCustomer(String(list.customer || ""));
    setProjectManager(String(list.project_manager || ""));
    setProjectNumber(getProjectNumberFromList(list));
    setPoNumber(String(list.po_number || ""));
    setCity(String(list.city || ""));
    setStateUS(String(list.state || ""));
    setAddress(String(list.address || ""));
    setIsMDU(!!list.is_mdu);
    setMduStartDate(String(list.mdu_start_date || ""));
    setMduCloseOutBy(String(list.mdu_close_out_by || ""));
    setMduPoAmount(
      list.mdu_po_amount !== null && list.mdu_po_amount !== undefined
        ? String(list.mdu_po_amount)
        : ""
    );
    setMduTotalAmount(
      list.mdu_total_amount !== null && list.mdu_total_amount !== undefined
        ? String(list.mdu_total_amount)
        : ""
    );
    setMduHourRate(
      list.mdu_hour_rate !== null && list.mdu_hour_rate !== undefined
        ? String(list.mdu_hour_rate)
        : ""
    );
    setMetaSaved(false);

    setOpenSections(
      PRICE_TASK_SECTIONS.reduce((acc, s) => {
        acc[s.id] = false;
        return acc;
      }, {} as Record<string, boolean>)
    );

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    loadPricesForList(list.id);
    reloadListDetails(list.id);

    (async () => {
      try {
        await tokenFetch(PRICE_LISTS_ENDPOINT, {
          method: "PATCH",
          body: JSON.stringify({ id, op: "activate" }),
        });
      } catch (err) {
        console.error("Error activating list", err);
      }
    })();
  }

  function handleDeleteList(id: string) {
    setPendingDeleteId(null);
    setPendingCompleteId(null);
    setDeletePasswordInput("");
    setDeletePasswordError(null);
    removeList(id);

    if (activeList?.id === id) resetForm();

    (async () => {
      try {
        const res = await tokenFetch(PRICE_LISTS_ENDPOINT, {
          method: "DELETE",
          body: JSON.stringify({ id }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || (json as any).ok === false) {
          throw new Error((json as any).error || `Error deleting list (${res.status})`);
        }

        await loadPriceLists();
      } catch (err) {
        console.error("Error deleting list", err);
      }
    })();
  }

  function handleMarkCompleted(id: string) {
    patchList(id, { status: "completed" });
    setPendingCompleteId(null);
    setPendingDeleteId(null);
    setDeletePasswordInput("");
    setDeletePasswordError(null);

    (async () => {
      try {
        const res = await tokenFetch(PRICE_LISTS_ENDPOINT, {
          method: "PATCH",
          body: JSON.stringify({ id, op: "complete" }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || (json as any).ok === false) {
          throw new Error((json as any).error || `Error completing list (${res.status})`);
        }

        await loadPriceLists();
      } catch (err) {
        console.error("Error marking list completed", err);
      }
    })();
  }

  function toggleSection(sectionId: string) {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  function saveDevTokenAndRetry() {
    const t = String(tokenInput || "").trim();
    if (!t) {
      setAuthHint("Pega tu ADMIN_TOKEN (ej: 3amigos) para enviar Bearer en local.");
      return;
    }
    setStoredToken(t);
    setNeedsAuth(false);
    setAuthHint("Token guardado. Reintentando cargar listas…");
    loadPriceLists();
    loadMissingVariants();
  }

  function clearDevToken() {
  clearAuthSession();
  setTokenInput("");
  setNeedsAuth(true);
  setAuthHint(
    "Token borrado. Vuelve a pegarlo si estás en modo ADMIN_TOKEN."
  );
  setPriceLists([]);
}

  return (
    <div className="space-y-4 relative">
      {needsAuth && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 rounded-xl bg-white border border-amber-200 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-amber-700" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-amber-900">
                  Admin session required (local/dev)
                </div>
                <div className="text-[10px] text-amber-900/70">
                  El Worker respondió <b>401 no_session</b>. En local normalmente estás en modo
                  <b> ADMIN_TOKEN</b> → debes enviar <b>Authorization: Bearer</b>.
                </div>
                <div className="text-[10px] text-amber-900/70">
                  Origin actual:{" "}
                  <span className="font-semibold">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={clearDevToken}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 active:scale-95"
              title="Clear stored token"
            >
              <LogOut className="w-3 h-3" />
              Clear token
            </button>
          </div>

          <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste ADMIN_TOKEN (ex: 3amigos)"
              className="w-full rounded-lg bg-white border border-amber-200 px-2 py-2 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <button
              type="button"
              onClick={saveDevTokenAndRetry}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-600 bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white active:scale-95 hover:bg-amber-700"
            >
              Save token & retry
            </button>
          </div>

          {authHint && <div className="mt-2 text-[10px] text-amber-900/80">{authHint}</div>}
        </div>
      )}

      {(pendingCompleteId || pendingDeleteId) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] flex flex-col items-center text-center gap-2 shadow-xl max-w-md w-[90%]">
            {(() => {
              const targetId = pendingCompleteId || pendingDeleteId;
              const target = priceLists.find((pl) => pl.id === targetId);

              const name = target?.name || "(no name)";
              const code = getProjectNumberFromList(target) || "PRJ-XXX";
              const cust = target?.customer || "Customer";

              const isCompleteAction = !!pendingCompleteId;

              return (
                <>
                  <div className="text-[11px] font-semibold text-slate-700 tracking-wide uppercase flex items-center gap-1">
                    {isCompleteAction ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-rose-500" />
                    )}
                    {isCompleteAction ? "Confirm mark as COMPLETED" : "Confirm delete price list"}
                  </div>

                  <div className="text-slate-700">
                    <span className="font-medium">{name}</span>{" "}
                    <span className="text-slate-500">· {code} · {cust}</span>
                  </div>

                  <div className="max-w-xl text-slate-600">
                    {isCompleteAction ? (
                      <>
                        This will mark this price list as{" "}
                        <span className="font-bold text-emerald-600">COMPLETED</span> and move it to
                        the bottom of the panel.
                      </>
                    ) : (
                      <>
                        This will{" "}
                        <span className="font-bold text-rose-600">permanently delete</span> this
                        price list and its prices. This action cannot be undone.
                      </>
                    )}
                  </div>

                  {!isCompleteAction && (
                    <div className="w-full max-w-sm text-left">
                      <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                        Delete password
                      </label>
                      <input
                        type="password"
                        value={deletePasswordInput}
                        onChange={(e) => {
                          setDeletePasswordInput(e.target.value);
                          if (deletePasswordError) setDeletePasswordError(null);
                        }}
                        placeholder="Enter password"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                      />
                      {deletePasswordError && (
                        <div className="mt-1 text-[10px] text-rose-600">{deletePasswordError}</div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold active:scale-95 ${
                        isCompleteAction
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-rose-600 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                      onClick={() => {
                        if (pendingCompleteId) {
                          handleMarkCompleted(pendingCompleteId);
                          return;
                        }

                        if (pendingDeleteId) {
                          if (deletePasswordInput !== DELETE_PASSWORD) {
                            setDeletePasswordError("Incorrect delete password.");
                            return;
                          }
                          handleDeleteList(pendingDeleteId);
                        }
                      }}
                    >
                      {isCompleteAction ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Confirm
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Confirm delete
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-[10px] text-slate-600 bg-white hover:bg-slate-50 active:scale-95"
                      onClick={() => {
                        setPendingCompleteId(null);
                        setPendingDeleteId(null);
                        setDeletePasswordInput("");
                        setDeletePasswordError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-800">Admin — Price Lists</span>
              <span className="text-[10px] text-slate-500">
                Create a price list card and then edit its prices by sections.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95"
            >
              <Plus className="w-3 h-3" />
              New / Clear
            </button>
            <button
              type="button"
              onClick={loadPriceLists}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-95"
            >
              <RefreshCw className="w-3 h-3" />
              Reload
            </button>
          </div>
        </div>

        <div className="mb-3 text-[10px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-slate-700 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-500" />
              Price list name
            </label>
            {activeList && (
              <span className="px-2 py-0.5 rounded-full border border-emerald-200 text-[9px] text-emerald-700 bg-emerald-50">
                Editing: {activeList.name}
              </span>
            )}
          </div>
          <input
            className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            value={listName}
            onChange={(e) => setListName(upper(e.target.value))}
            placeholder=""
          />
        </div>

        <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
          <div className="space-y-1">
            <label className="text-slate-700">Customer</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={customer}
              onChange={(e) => setCustomer(upper(e.target.value))}
              placeholder=""
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-700">Project Manager</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={projectManager}
              onChange={(e) => setProjectManager(upper(e.target.value))}
              placeholder=""
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-700">Project Number</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={projectNumber}
              onChange={(e) => setProjectNumber(upper(e.target.value))}
              placeholder=""
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
          <div className="space-y-1">
            <label className="text-slate-700">PO Number</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={poNumber}
              onChange={(e) => setPoNumber(upper(e.target.value))}
              placeholder=""
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-700">City</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={city}
              onChange={(e) => setCity(upper(e.target.value))}
              placeholder=""
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-700">State</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={stateUS}
              onChange={(e) => setStateUS(upper(e.target.value))}
              placeholder="ID / UT / CO"
            />
          </div>
        </div>

        <div className="mb-3 text-[10px]">
          <div className="space-y-1">
            <label className="text-slate-700">Address</label>
            <input
              className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none uppercase focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              value={address}
              onChange={(e) => setAddress(upper(e.target.value))}
              placeholder=""
            />
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-[0.14em]">
                MDU Project
              </span>
              <span className="text-[10px] text-slate-500">
                Enable this if the request email includes MDU dates and contract values.
              </span>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[10px] font-medium text-slate-700">
                {isMDU ? "Enabled" : "Disabled"}
              </span>
              <input
                type="checkbox"
                checked={isMDU}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsMDU(checked);

                  if (!checked) {
                    setMduStartDate("");
                    setMduCloseOutBy("");
                    setMduPoAmount("");
                    setMduTotalAmount("");
                    setMduHourRate("");
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>

          {isMDU && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                <div className="space-y-1">
                  <label className="text-slate-700">Start Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={mduStartDate}
                    onChange={(e) => setMduStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700">Close Outs By</label>
                  <input
                    type="date"
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={mduCloseOutBy}
                    onChange={(e) => setMduCloseOutBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                <div className="space-y-1">
                  <label className="text-slate-700">PO Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={mduPoAmount}
                    onChange={(e) => setMduPoAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700">Contract Total</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={mduTotalAmount}
                    onChange={(e) => setMduTotalAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700">Hour Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={mduHourRate}
                    onChange={(e) => setMduHourRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3 flex justify-end gap-2">
          {!activeList ? (
            <button
              type="button"
              onClick={handleCreateList}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white active:scale-95 hover:bg-emerald-700"
            >
              <Plus className="w-3 h-3" />
              Create price list card
            </button>
          ) : (
            <>
              {metaSaved && (
                <span className="inline-flex items-center px-2 py-1 text-[10px] rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Metadata updated ✓
                </span>
              )}

              <button
                type="button"
                onClick={saveListMetadata}
                disabled={isSavingMeta}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 disabled:opacity-60"
              >
                <Save className="w-3 h-3" />
                {isSavingMeta ? "Saving..." : "Save metadata"}
              </button>
            </>
          )}
        </div>

        {activeList && (
          <>
            <div className="space-y-3">
              {PRICE_TASK_SECTIONS.map((section) => {
                const isOpen = !!openSections[section.id];

                const sectionHasRows = section.groups.some((groupName) => {
                  const groupDef = TASK_DEFS.find((g) => g.group === groupName);
                  if (!groupDef) return false;
                  const keys = new Set(groupDef.items.map((it) => it.key));
                  return rows.some((r) => keys.has(r.taskKey));
                });

                return (
                  <div
                    key={section.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left"
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-[0.18em]">
                          {section.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {sectionHasRows
                            ? "Review and adjust price per task group."
                            : section.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {stats.count > 0 && (
                          <span className="hidden sm:inline text-[10px] text-slate-500">
                            Avg: {formatCurrency(stats.avg)}
                          </span>
                        )}
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                          {isOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
                        {section.groups.map((groupName) => {
                          const groupDef = TASK_DEFS.find((g) => g.group === groupName);
                          if (!groupDef) return null;

                          const groupRows = rows.filter((r) =>
                            groupDef.items.some((it) => it.key === r.taskKey)
                          );
                          const hasRows = groupRows.length > 0;

                          return (
                            <div
                              key={groupName}
                              className="rounded-xl border border-slate-200 bg-white"
                            >
                              <div className="flex items-center justify-between px-3 py-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-semibold text-slate-800 uppercase">
                                    {groupDef.group}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {hasRows
                                      ? `${groupRows.length} price row${
                                          groupRows.length > 1 ? "s" : ""
                                        } configured`
                                      : "No prices yet for this group."}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addRowForGroup(groupName)}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-95"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add price
                                </button>
                              </div>
                              

                              {hasRows && (
                                <div className="border-t border-slate-200 max-h-52 overflow-auto">
                                  <div className="hidden md:grid md:grid-cols-[minmax(0,2.1fr)_1fr_0.95fr_56px] gap-x-2 text-[10px] px-3 py-1.5 bg-slate-50 text-slate-600">
                                    <div>Task</div>
                                    <div className="text-center border-l border-slate-200 pl-2">
                                      Variant / Type
                                    </div>
                                    <div className="text-right whitespace-nowrap border-l border-slate-200 pl-2">
                                      Price
                                    </div>
                                    <div className="text-right border-l border-slate-200 pl-2">
                                      Remove
                                    </div>
                                  </div>

                                  <div className="divide-y divide-slate-200">
                                    {groupRows.map((row) => {
                                      const def = TASK_INDEX[row.taskKey] || ({} as TaskItem);
                                      const variants = getVariantsForTask(row.taskKey);
                                      const hasVariantDropdown = variants.length > 0;

                                      return (
                                        <div key={row.rowId} className="px-3 py-2 bg-white">
                                          <div className="hidden md:grid md:grid-cols-[minmax(0,2.1fr)_1fr_0.95fr_56px] gap-x-2 text-[11px] items-center">
                                            <div className="pr-2">
                                              <div className="relative">
                                                <select
                                                  className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 pr-7 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none"
                                                  value={row.taskKey}
                                                  onChange={(e) =>
                                                    onTaskChange(row.rowId, e.target.value)
                                                  }
                                                >
                                                  <option value="">Select task…</option>
                                                  {groupDef.items.map((item) => (
                                                    <option key={item.key} value={item.key}>
                                                      {item.label} ({item.unit})
                                                    </option>
                                                  ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                              </div>
                                            </div>

                                            <div className="px-1 border-l border-slate-100 pl-2">
                                              {hasVariantDropdown ? (
                                                <div className="relative">
                                                  <select
                                                    className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 pr-7 text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none text-center"
                                                    value={row.variantCode || variants[0]}
                                                    onChange={(e) =>
                                                      updateRow(row.rowId, {
                                                        variantCode: normVariant(e.target.value),
                                                        unit: (def.unit || "").trim(),
                                                      })
                                                    }
                                                  >
                                                    {variants.map((v) => (
                                                      <option key={v} value={v}>
                                                        {v}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                </div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-[11px] text-slate-400 outline-none cursor-not-allowed text-center"
                                                  value={row.variantCode}
                                                  onChange={() => {}}
                                                  placeholder="—"
                                                  disabled
                                                />
                                              )}
                                            </div>

                                            <div className="px-1 border-l border-slate-100 pl-2">
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="w-full rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-right text-[11px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                                value={row.pricePerUnit}
                                                onChange={(e) =>
                                                  updateRow(row.rowId, {
                                                    pricePerUnit: e.target.value,
                                                    unit: (def.unit || "").trim(),
                                                  })
                                                }
                                                placeholder="0.00"
                                              />
                                            </div>

                                            <div className="flex justify-end border-l border-slate-100 pl-2">
                                              <button
                                                type="button"
                                                onClick={() => deleteRow(row.rowId)}
                                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95"
                                                title="Remove row"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>

                                          <div className="md:hidden space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                            <div className="space-y-1">
                                              <label className="block text-[10px] font-medium text-slate-600">
                                                Task
                                              </label>
                                              <div className="relative">
                                                <select
                                                  className="w-full rounded-lg bg-white border border-slate-300 px-2 py-2 pr-7 text-[12px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none"
                                                  value={row.taskKey}
                                                  onChange={(e) =>
                                                    onTaskChange(row.rowId, e.target.value)
                                                  }
                                                >
                                                  <option value="">Select task…</option>
                                                  {groupDef.items.map((item) => (
                                                    <option key={item.key} value={item.key}>
                                                      {item.label} ({item.unit})
                                                    </option>
                                                  ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-[1fr_110px_44px] gap-2 items-end">
                                              <div className="space-y-1 min-w-0">
                                                <label className="block text-[10px] font-medium text-slate-600">
                                                  Variant
                                                </label>
                                                {hasVariantDropdown ? (
                                                  <div className="relative">
                                                    <select
                                                      className="w-full rounded-lg bg-white border border-slate-300 px-2 py-2 pr-7 text-[12px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 appearance-none"
                                                      value={row.variantCode || variants[0]}
                                                      onChange={(e) =>
                                                        updateRow(row.rowId, {
                                                          variantCode: normVariant(e.target.value),
                                                          unit: (def.unit || "").trim(),
                                                        })
                                                      }
                                                    >
                                                      {variants.map((v) => (
                                                        <option key={v} value={v}>
                                                          {v}
                                                        </option>
                                                      ))}
                                                    </select>
                                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                  </div>
                                                ) : (
                                                  <input
                                                    type="text"
                                                    className="w-full rounded-lg bg-slate-100 border border-slate-200 px-2 py-2 text-[12px] text-slate-400 outline-none cursor-not-allowed"
                                                    value="—"
                                                    disabled
                                                  />
                                                )}
                                              </div>

                                              <div className="space-y-1">
                                                <label className="block text-[10px] font-medium text-slate-600">
                                                  Price
                                                </label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  className="w-full rounded-lg bg-white border border-slate-300 px-2 py-2 text-right text-[12px] text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                                  value={row.pricePerUnit}
                                                  onChange={(e) =>
                                                    updateRow(row.rowId, {
                                                      pricePerUnit: e.target.value,
                                                      unit: (def.unit || "").trim(),
                                                    })
                                                  }
                                                  placeholder="0.00"
                                                />
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => deleteRow(row.rowId)}
                                                className="inline-flex items-center justify-center h-[38px] rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95"
                                                title="Remove row"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 space-y-1 text-[10px]">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
                  {error}
                </div>
              )}
              {saved && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                  Saved ✓
                </div>
              )}
              {isLoading && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                  Loading prices…
                </div>
              )}
              {!!missingVariants.length && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                  Missing variants detected: {missingVariants.length}
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={savePrices}
                disabled={isSaving}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white active:scale-95 disabled:opacity-60 hover:bg-emerald-700"
              >
                <Save className="w-3 h-3" />
                {isSaving ? "Saving…" : "Save prices"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3 mt-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-[12px] tracking-wide">
            Price lists manager
          </span>
          <span className="text-[11px] text-slate-500">{priceLists.length} lists</span>
        </div>
     
      <div className="flex flex-col gap-2.5">
      {priceLists.map((pl) => (
      <PriceListCard
      key={pl.id}
      pl={pl}
      isOpen={openListIds.has(pl.id)}
      det={detailsById[pl.id]}
      isDetLoading={!!detailsLoading[pl.id]}
      detErr={detailsError[pl.id]}
      duplicatingId={duplicatingId}
      toggleManagerOpen={toggleManagerOpen}
      handleEditList={handleEditList}
      duplicatePriceList={duplicatePriceList}
      setPendingDeleteId={setPendingDeleteId}
      setPendingCompleteId={setPendingCompleteId}
      setDeletePasswordInput={setDeletePasswordInput}
      setDeletePasswordError={setDeletePasswordError}
      formatCreatedDate={formatCreatedDate}
      formatCurrency={formatCurrency}
      getProjectNumberFromList={getProjectNumberFromList}
    />
  ))}
</div>

</section>
</div>
);
};

export default PricesView;