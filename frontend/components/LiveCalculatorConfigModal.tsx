"use client";

import { useState, useEffect, useTransition } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_LIVE_CALC_WEIGHTS,
  LiveCalcConfigData,
  CustomMetricConfig,
} from "@/lib/live-calculator-config";
import {
  CATALOG_METRICS,
  METRIC_SOURCES,
  METRIC_BY_KEY,
  MetricSource,
} from "@/lib/live-calculator-catalog";
import {
  saveLiveCalculatorConfigAction,
  triggerLiveCalculatorRecomputeAction,
  triggerLiveCalculatorSyncAction,
  getPromotionStatusAction,
  promoteLiveCalculatorRatingsAction,
  restoreSthsBackupAction,
  getAllTeamsForAssignmentAction,
  TeamAssignmentItem,
  PromotionStatus,
} from "@/lib/live-calculator-actions";

export default function LiveCalculatorConfigModal({
  isOpen,
  onClose,
  initialConfig,
  isAdmin,
  canManage = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: LiveCalcConfigData;
  isAdmin: boolean;
  canManage?: boolean;
}) {
  const isPermitted = isAdmin || canManage;
  const [config, setConfig] = useState<LiveCalcConfigData>(initialConfig);
  const [activeTab, setActiveTab] = useState<"general" | "weights" | "ahl" | "promotion">("general");
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [promoStatus, setPromoStatus] = useState<PromotionStatus | null>(null);
  const [eligibleTeams, setEligibleTeams] = useState<TeamAssignmentItem[]>([]);
  const [teamFilter, setTeamFilter] = useState("");
  const [autoBalanceSeasons, setAutoBalanceSeasons] = useState<boolean>(true);

  // Add Custom Metric Modal State
  const [addModal, setAddModal] = useState<{
    groupKey: string;
    groupName: string;
  } | null>(null);

  const [newSource, setNewSource] = useState<MetricSource>("nhl");
  const [newMetricKey, setNewMetricKey] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newWeight, setNewWeight] = useState<number>(0.1);
  const [newInvert, setNewInvert] = useState<boolean>(false);

  const openAddModal = (groupKey: string, groupName: string) => {
    const initialSource: MetricSource = "nhl";
    const sourceMetrics = CATALOG_METRICS.filter((m) => m.source === initialSource);
    const firstMetric = sourceMetrics[0];

    setNewSource(initialSource);
    setNewMetricKey(firstMetric ? firstMetric.key : "");
    setNewLabel(firstMetric ? firstMetric.label : "");
    setNewWeight(0.1);
    setNewInvert(firstMetric ? firstMetric.defaultInvert : false);
    setAddModal({ groupKey, groupName });
  };

  const handleSourceChange = (src: MetricSource) => {
    setNewSource(src);
    const sourceMetrics = CATALOG_METRICS.filter((m) => m.source === src);
    const firstMetric = sourceMetrics[0];
    if (firstMetric) {
      setNewMetricKey(firstMetric.key);
      setNewLabel(firstMetric.label);
      setNewInvert(firstMetric.defaultInvert);
    } else {
      setNewMetricKey("");
      setNewLabel("");
    }
  };

  const handleMetricKeyChange = (key: string) => {
    setNewMetricKey(key);
    const def = METRIC_BY_KEY[key];
    if (def) {
      setNewLabel(def.label);
      setNewInvert(def.defaultInvert);
    }
  };

  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addModal || !newMetricKey) return;

    const def = METRIC_BY_KEY[newMetricKey];
    const newMetric: CustomMetricConfig = {
      id: `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      metricKey: newMetricKey,
      label: newLabel.trim() || def?.label || newMetricKey,
      source: newSource,
      weight: Math.max(0, Number(newWeight) || 0.1),
      invert: newInvert,
    };

    const groupKey = addModal.groupKey;
    const currentList = config.weights?.customMetrics?.[groupKey] ?? [];
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        customMetrics: {
          ...(config.weights?.customMetrics ?? {}),
          [groupKey]: [...currentList, newMetric],
        },
      },
    });

    setAddModal(null);
  };

  const handleCustomMetricWeightChange = (groupKey: string, id: string, val: number) => {
    const currentList = config.weights?.customMetrics?.[groupKey] ?? [];
    const updatedList = currentList.map((cm) => (cm.id === id ? { ...cm, weight: val } : cm));
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        customMetrics: {
          ...(config.weights?.customMetrics ?? {}),
          [groupKey]: updatedList,
        },
      },
    });
  };

  const handleRemoveCustomMetric = (groupKey: string, id: string) => {
    const currentList = config.weights?.customMetrics?.[groupKey] ?? [];
    const updatedList = currentList.filter((cm) => cm.id !== id);
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        customMetrics: {
          ...(config.weights?.customMetrics ?? {}),
          [groupKey]: updatedList,
        },
      },
    });
  };

  const renderCardHeader = (
    title: string,
    titleColor: string,
    groupKey: string,
    stdSum: number
  ) => {
    const customList = config.weights?.customMetrics?.[groupKey] ?? [];
    const customSum = customList.reduce((acc, cm) => acc + (cm.weight || 0), 0);
    const totalSum = stdSum + customSum;

    return (
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold ${titleColor} text-sm`}>{title}</h4>
          {customList.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              +{customList.length} vlastn{customList.length === 1 ? "á" : "é"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="text-xs text-slate-400 font-mono"
            title={`Štandardné: ${(stdSum * 100).toFixed(0)}% + Vlastné: ${(customSum * 100).toFixed(0)}%`}
          >
            Súčet: {(totalSum * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={() => openAddModal(groupKey, title)}
            className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            title="Pridať novú metriku z NHL API, MoneyPuck, EDGE, AHL alebo Biometrie"
          >
            <span className="text-sm leading-none font-bold">+</span>
            <span>Pridať metriku</span>
          </button>
        </div>
      </div>
    );
  };

  const renderCustomMetricsSection = (groupKey: string) => {
    const list = config.weights?.customMetrics?.[groupKey] ?? [];
    if (list.length === 0) return null;

    return (
      <div className="pt-3 mt-3 border-t border-slate-700/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span>✨</span> Vlastné pridané metriky ({list.length})
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            Normalizuje sa automaticky do celkového percentilu
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {list.map((cm) => {
            const sourceMeta = METRIC_SOURCES[cm.source as MetricSource];
            const def = METRIC_BY_KEY[cm.metricKey];
            return (
              <div
                key={cm.id}
                className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm hover:border-slate-600 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        sourceMeta?.color ?? "text-slate-400 bg-slate-800 border-slate-700"
                      }`}
                    >
                      {sourceMeta?.badge ?? cm.source}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {cm.invert ? "↓ nižšie = lepšie" : "↑ vyššie = lepšie"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 truncate" title={cm.label}>
                    {cm.label}
                  </div>
                  {def?.description && (
                    <div className="text-[10px] text-slate-400 truncate mt-0.5" title={def.description}>
                      {def.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div>
                    <label className="block text-[9px] text-slate-500 mb-0.5 font-mono">Váha:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={cm.weight}
                      onChange={(e) =>
                        handleCustomMetricWeightChange(groupKey, cm.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomMetric(groupKey, cm.id)}
                    className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 flex items-center justify-center text-xs transition"
                    title="Odstrániť metriku"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const loadPromoStatus = () => {
    getPromotionStatusAction()
      .then(setPromoStatus)
      .catch((err) => console.error("Failed to fetch promotion status:", err));
  };

  useEffect(() => {
    if (isOpen) {
      if (isAdmin) {
        loadPromoStatus();
        getAllTeamsForAssignmentAction()
          .then(setEligibleTeams)
          .catch((err) => console.error("Failed to load eligible teams:", err));
      }
    }
  }, [isOpen, isAdmin]);

  const handleToggleManagerTeam = (teamId: number) => {
    const current = config.managerTeamIds ?? [];
    const next = current.includes(teamId)
      ? current.filter((id) => id !== teamId)
      : [...current, teamId];
    setConfig({ ...config, managerTeamIds: next });
  };

  if (!isOpen) return null;

  const handleSave = () => {
    setStatusMsg(null);
    startTransition(async () => {
      try {
        const res = await saveLiveCalculatorConfigAction(config);
        if (res.success) {
          setStatusMsg({ type: "success", text: "Nastavenia boli úspešne uložené." });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Chyba pri ukladaní nastavení." });
      }
    });
  };

  const handleRecompute = () => {
    setStatusMsg(null);
    startTransition(async () => {
      try {
        const res = await triggerLiveCalculatorRecomputeAction();
        if (res.success) {
          setStatusMsg({
            type: "success",
            text: `Prepočet dokončený! Spracovaných ${res.totalProcessed} hráčov (${res.nhlCount} NHL, ${res.ahlCount} AHL).`,
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Chyba pri prepočte." });
      }
    });
  };

  const handleSync = () => {
    setStatusMsg(null);
    startTransition(async () => {
      try {
        const res = await triggerLiveCalculatorSyncAction();
        if (res.success) {
          setStatusMsg({
            type: "success",
            text: `Synchronizácia a prepočet dokončené! MoneyPuck zhod: ${res.sync.moneyPuckMatched}, AHL zhod: ${res.sync.ahlMatchedCur}.`,
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Chyba pri synchronizácii." });
      }
    });
  };

  const handleResetDefaults = () => {
    if (confirm("Naozaj chcete obnoviť všetky váhy a nastavenia na predvolené hodnoty?")) {
      setConfig({
        ...DEFAULT_CONFIG,
        lastCalculatedAt: config.lastCalculatedAt,
        lastSyncedAt: config.lastSyncedAt,
      });
      setStatusMsg({ type: "success", text: "Obnovené predvolené hodnoty (nezabudnite kliknúť Uložiť)." });
    }
  };

  const handlePromote = () => {
    if (
      !confirm(
        "Pozor! Chystáte sa aplikovať prepočítané Live ratingy do oficiálnych STHS ratingov hráčov.\n\n" +
          "• Systém automaticky vytvorí trvalú zálohu pôvodných STHS ratingov, ak ešte neexistuje.\n" +
          "• Kedykoľvek ich budete môcť jedným klikom vrátiť späť (Rollback).\n" +
          "• Morálka (MO) hráčov zostáva nezmenená.\n\n" +
          "Naozaj chcete aplikovať Live ratingy do ligovej databázy?"
      )
    ) {
      return;
    }

    setStatusMsg(null);
    startTransition(async () => {
      try {
        const res = await promoteLiveCalculatorRatingsAction();
        if (res.success) {
          setStatusMsg({
            type: "success",
            text: `Live ratingy boli úspešne aplikované do STHS! Aktualizovaných ${res.updatedCount} hráčov (zálohovaných: ${res.backedUpCount}).`,
          });
          loadPromoStatus();
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Chyba pri aplikovaní ratingov." });
      }
    });
  };

  const handleRestore = () => {
    if (
      !confirm(
        "Naozaj chcete obnoviť pôvodné oficiálne STHS ratingy zo zálohy?\n\n" +
          "Všetkým hráčom sa vrátia pôvodné parametre spred aplikovania Live kalkulátora."
      )
    ) {
      return;
    }

    setStatusMsg(null);
    startTransition(async () => {
      try {
        const res = await restoreSthsBackupAction();
        if (res.success) {
          setStatusMsg({
            type: "success",
            text: `Pôvodné STHS ratingy boli úspešne obnovené zo zálohy (${res.restoredCount} hráčov)!`,
          });
          loadPromoStatus();
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Chyba pri obnove zo zálohy." });
      }
    });
  };

  const selectedMetricDef = METRIC_BY_KEY[newMetricKey];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Add Custom Metric Modal Overlay */}
      {addModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-sm">
                  +
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Pridať novú metriku do výpočtu</h3>
                  <p className="text-[11px] text-slate-400">
                    Cieľový parameter: <span className="text-sky-300 font-semibold">{addModal.groupName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModal(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              {/* Step 1: Server */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  1. Dátový server / zdroj hodnôt:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(METRIC_SOURCES) as MetricSource[]).map((src) => {
                    const meta = METRIC_SOURCES[src];
                    const isSelected = newSource === src;
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => handleSourceChange(src)}
                        className={`p-2 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-sky-500/15 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/50"
                            : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block w-fit mb-1 ${meta.color}`}>
                          {meta.badge}
                        </span>
                        <span className="text-xs font-medium line-clamp-1">{meta.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {METRIC_SOURCES[newSource]?.description}
                </p>
              </div>

              {/* Step 2: Metric */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  2. Vyberte metriku / štatistiku:
                </label>
                <select
                  value={newMetricKey}
                  onChange={(e) => handleMetricKeyChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs focus:border-sky-400 outline-none"
                >
                  {CATALOG_METRICS.filter((m) => m.source === newSource).map((m) => (
                    <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                      {m.label} {m.unit ? `(${m.unit})` : ""}
                    </option>
                  ))}
                </select>
                {selectedMetricDef && (
                  <p className="text-[11px] text-slate-400 mt-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    💡 {selectedMetricDef.description}
                  </p>
                )}
              </div>

              {/* Step 3: Custom Name / Label */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  3. Názov metriky (Label):
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Napr. Team PK TOI/GP"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-medium text-xs focus:border-sky-400 outline-none"
                />
              </div>

              {/* Step 4: Direction */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  4. Vyhodnotenie (Smer percentilu):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewInvert(false)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                      !newInvert
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-base">📈</span>
                    <div>
                      <div className="font-semibold text-xs">Vyššia = lepšie</div>
                      <div className="text-[10px] text-slate-400">Body, rýchlosť, hity...</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewInvert(true)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                      newInvert
                        ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <span className="text-base">📉</span>
                    <div>
                      <div className="font-semibold text-xs">Nižšia = lepšie (Inverzné)</div>
                      <div className="text-[10px] text-slate-400">xGA, GA, PIM, straty...</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 5: Initial Weight */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  5. Počiatočná váha vo vzorci:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    max="1"
                    value={newWeight}
                    onChange={(e) => setNewWeight(parseFloat(e.target.value) || 0.1)}
                    className="w-28 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                  />
                  <span className="text-slate-400 text-xs font-mono">
                    = {(newWeight * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
                >
                  Zrušiť
                </button>
                <button
                  type="submit"
                  disabled={!newMetricKey}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition disabled:opacity-50"
                >
                  Pridať do výpočtu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Live Calculator — Nastavenia & Tuning
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  V10 Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Konfigurácia váh sezón, MoneyPuck dát, NHLe koeficientov a prepočtových vzorcov.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Status banner */}
        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
              statusMsg.type === "success"
                ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                : "bg-rose-950/60 border-rose-800/60 text-rose-300"
            }`}
          >
            <span>{statusMsg.type === "success" ? "✓" : "⚠️"}</span>
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-800 flex gap-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab("general")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "general"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Všeobecné & Sezóny (CONFIG_V8)
          </button>
          <button
            onClick={() => setActiveTab("weights")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "weights"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Váhy komponentov (PA, SC, DF, CK, DI)
          </button>
          <button
            onClick={() => setActiveTab("ahl")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "ahl"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            AHL & NHLe (V10 Ochrana)
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab("promotion");
                loadPromoStatus();
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "promotion"
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>👑</span>
              <span>Aplikovať do STHS (Komisár)</span>
              {promoStatus?.hasBackup && (
                <span
                  title="Záloha existuje"
                  className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 inline-block ml-0.5"
                />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                      <span>🗓️</span> Váhy sezón
                    </h3>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 text-[11px] select-none">
                      <input
                        type="checkbox"
                        checked={autoBalanceSeasons}
                        onChange={(e) => setAutoBalanceSeasons(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500 focus:ring-sky-400 bg-slate-900 w-3.5 h-3.5"
                      />
                      <span>Dopočítavať do 100%</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                        Aktuálna sezóna (LatestWeight):
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={parseFloat((config.latestWeight * 100).toFixed(2))}
                          onChange={(e) => {
                            const pct = parseFloat(e.target.value);
                            const val = isNaN(pct) ? 0 : pct / 100;
                            if (autoBalanceSeasons) {
                              const prevPct = Math.max(0, 100 - (isNaN(pct) ? 0 : pct));
                              setConfig({
                                ...config,
                                latestWeight: val,
                                previousWeight: parseFloat((prevPct / 100).toFixed(4)),
                              });
                            } else {
                              setConfig({
                                ...config,
                                latestWeight: val,
                              });
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                        />
                        <span className="absolute right-3 text-slate-400 text-xs font-mono select-none">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        Koeficient: {config.latestWeight.toFixed(3)}
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                        Predošlá sezóna (PreviousWeight):
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={parseFloat((config.previousWeight * 100).toFixed(2))}
                          onChange={(e) => {
                            const pct = parseFloat(e.target.value);
                            const val = isNaN(pct) ? 0 : pct / 100;
                            if (autoBalanceSeasons) {
                              const latestPct = Math.max(0, 100 - (isNaN(pct) ? 0 : pct));
                              setConfig({
                                ...config,
                                previousWeight: val,
                                latestWeight: parseFloat((latestPct / 100).toFixed(4)),
                              });
                            } else {
                              setConfig({
                                ...config,
                                previousWeight: val,
                              });
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                        />
                        <span className="absolute right-3 text-slate-400 text-xs font-mono select-none">
                          %
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        Koeficient: {config.previousWeight.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Pomer sezón (posuvník):</span>
                      <span className="font-mono text-slate-200">
                        {(config.latestWeight * 100).toFixed(1).replace(/\.0$/, "")}% : {(config.previousWeight * 100).toFixed(1).replace(/\.0$/, "")}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.001"
                      value={
                        config.latestWeight + config.previousWeight > 0
                          ? config.latestWeight / (config.latestWeight + config.previousWeight)
                          : 0.5
                      }
                      onChange={(e) => {
                        const ratio = parseFloat(e.target.value);
                        const total = autoBalanceSeasons ? 1 : (config.latestWeight + config.previousWeight || 1);
                        setConfig({
                          ...config,
                          latestWeight: parseFloat((ratio * total).toFixed(4)),
                          previousWeight: parseFloat(((1 - ratio) * total).toFixed(4)),
                        });
                      }}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  {Math.abs(config.latestWeight + config.previousWeight - 1) > 0.001 && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-1.5 text-[11px]">
                      <div className="text-amber-300">
                        <span>Súčet: </span>
                        <strong className="font-mono">{((config.latestWeight + config.previousWeight) * 100).toFixed(1)}%</strong>
                        <span className="text-slate-400 ml-1">
                          (efektívne {((config.latestWeight / (config.latestWeight + config.previousWeight || 1)) * 100).toFixed(1)}% / {((config.previousWeight / (config.latestWeight + config.previousWeight || 1)) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const sum = config.latestWeight + config.previousWeight;
                          if (sum > 0) {
                            setConfig({
                              ...config,
                              latestWeight: parseFloat((config.latestWeight / sum).toFixed(4)),
                              previousWeight: parseFloat((config.previousWeight / sum).toFixed(4)),
                            });
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-semibold border border-amber-500/30 transition"
                      >
                        Normalizovať na 100%
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>🏒</span> Klasifikačné prahy (NHL vs AHL)
                  </h3>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Min. GP aktuálna sezóna (NHL_GP_Latest_Min):
                    </label>
                    <input
                      type="number"
                      value={config.nhlGpLatestMin}
                      onChange={(e) => setConfig({ ...config, nhlGpLatestMin: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Hráč s aspoň toľkoto GP v aktuálnej sezóne patrí do NHL skupiny.
                    </p>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Min. GP predošlá sezóna (NHL_GP_Previous_MinExclusive):
                    </label>
                    <input
                      type="number"
                      value={config.nhlGpPrevMin}
                      onChange={(e) => setConfig({ ...config, nhlGpPrevMin: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>📁</span> MoneyPuck priečinky
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Aktuálny rok (LatestMPYear):</label>
                      <input
                        type="number"
                        value={config.latestMpYear}
                        onChange={(e) => setConfig({ ...config, latestMpYear: parseInt(e.target.value) || 2025 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Predošlý rok (PreviousMPYear):</label>
                      <input
                        type="number"
                        value={config.previousMpYear}
                        onChange={(e) => setConfig({ ...config, previousMpYear: parseInt(e.target.value) || 2024 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>ℹ️</span> Informácie o stave
                  </h3>
                  <div className="space-y-1.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Posledný prepočet:</span>
                      <span className="font-mono text-slate-200">
                        {config.lastCalculatedAt ? new Date(config.lastCalculatedAt).toLocaleString("sk-SK") : "Zatiaľ neprebehol"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Posledná synchronizácia:</span>
                      <span className="font-mono text-slate-200">
                        {config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString("sk-SK") : "Zatiaľ neprebehla"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Admin GM Delegation for Live Calculator */}
                {isAdmin && (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                          <span>👥</span> Poverení GMovia (Správa Live Kalkulátora)
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Označte tímy / GM, ktorí budú mať prístup <strong>výhradne k tomuto kalkulátoru</strong> (úprava váh, sync, prepočet), bez administrátorských práv nad ligou.
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
                        {(config.managerTeamIds ?? []).length} poverených
                      </span>
                    </div>

                    {/* Team search input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Filtrovať podľa tímu, kódu alebo mena GM..."
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:border-sky-400 outline-none"
                      />
                    </div>

                    {/* Teams grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 border border-slate-800 rounded-lg p-2.5 bg-slate-950/40">
                      {eligibleTeams
                        .filter((t) => {
                          if (!teamFilter) return true;
                          const q = teamFilter.toLowerCase();
                          return (
                            t.name.toLowerCase().includes(q) ||
                            (t.code && t.code.toLowerCase().includes(q)) ||
                            t.gmName.toLowerCase().includes(q)
                          );
                        })
                        .map((team) => {
                          const isAssigned = (config.managerTeamIds ?? []).includes(team.id);
                          return (
                            <label
                              key={team.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                                isAssigned
                                  ? "bg-indigo-950/50 border-indigo-500/60 text-white"
                                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => handleToggleManagerTeam(team.id)}
                                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                              />
                              <div className="min-w-0 flex-1 leading-tight">
                                <div className="text-xs font-semibold truncate flex items-center justify-between gap-1">
                                  <span>{team.name}</span>
                                  {team.code && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {team.code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  GM: <span className={isAssigned ? "text-indigo-300 font-medium" : "text-slate-300"}>{team.gmName}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      {eligibleTeams.length === 0 && (
                        <div className="col-span-full text-center py-4 text-slate-500 text-xs">
                          Načítavam zoznam tímov...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "weights" && (
            <div className="space-y-6">
              {/* PA */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Passing (PA) Váhy",
                  "text-sky-400",
                  "pa",
                  (config.weights?.pa?.apg ?? 0.45) +
                    (config.weights?.pa?.a60All ?? 0.3) +
                    (config.weights?.pa?.a60_5v5 ?? 0.25)
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">A/GP (Asistencie / zápas):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.pa.apg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            pa: { ...config.weights.pa, apg: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">A/60 All (Všetky herné situácie):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.pa.a60All}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            pa: { ...config.weights.pa, a60All: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">A/60 5v5 (Rovnovážny stav):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.pa.a60_5v5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            pa: { ...config.weights.pa, a60_5v5: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("pa")}
              </div>

              {/* SC */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Scoring (SC) Váhy",
                  "text-emerald-400",
                  "sc",
                  (config.weights?.sc?.gpg ?? 0.45) +
                    (config.weights?.sc?.g60 ?? 0.25) +
                    (config.weights?.sc?.xg60 ?? 0.2) +
                    (config.weights?.sc?.g_xg60 ?? 0.1)
                )}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">G/GP (Góly / zápas):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.sc.gpg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            sc: { ...config.weights.sc, gpg: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">G/60 (Góly / 60 min):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.sc.g60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            sc: { ...config.weights.sc, g60: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">xG/60 (Očakávané góly):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.sc.xg60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            sc: { ...config.weights.sc, xg60: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">(G - xG)/60 (Finishing):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights.sc.g_xg60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            sc: { ...config.weights.sc, g_xg60: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("sc")}
              </div>

              {/* DF - Defensemen */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Defense (DF) Váhy — Obrancovia (D)",
                  "text-cyan-400",
                  "dfD",
                  (config.weights?.dfD?.pkToiPg ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.pkToiPg) +
                    (config.weights?.dfD?.xga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.xga5) +
                    (config.weights?.dfD?.relXga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.relXga5) +
                    (config.weights?.dfD?.ga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.ga5) +
                    (config.weights?.dfD?.relXgaPk ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.relXgaPk) +
                    (config.weights?.dfD?.blk60 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.blk60) +
                    (config.weights?.dfD?.xgfPct ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.xgfPct)
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">PK TOI/GP (Oslabenia):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.pkToiPg ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.pkToiPg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              pkToiPg: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv xGA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.xga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.xga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              xga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv Rel xGA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.relXga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.relXga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              relXga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv GA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.ga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.ga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              ga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv Rel xGA PK:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.relXgaPk ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.relXgaPk}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              relXgaPk: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Blocks/60 (Bloky):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.blk60 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.blk60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              blk60: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">xGF% (Očakávané góly %):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfD?.xgfPct ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD.xgfPct}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfD: {
                              ...(config.weights?.dfD ?? DEFAULT_LIVE_CALC_WEIGHTS.dfD),
                              xgfPct: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("dfD")}
              </div>

              {/* DF - Forwards */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Defense (DF) Váhy — Útočníci (F)",
                  "text-blue-400",
                  "dfF",
                  (config.weights?.dfF?.pkToiPg ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.pkToiPg) +
                    (config.weights?.dfF?.relXgaPk ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.relXgaPk) +
                    (config.weights?.dfF?.relXga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.relXga5) +
                    (config.weights?.dfF?.xga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.xga5) +
                    (config.weights?.dfF?.ga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.ga5) +
                    (config.weights?.dfF?.xgfPct ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.xgfPct) +
                    (config.weights?.dfF?.blk60 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.blk60)
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">PK TOI/GP (Oslabenia):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.pkToiPg ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.pkToiPg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              pkToiPg: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv Rel xGA PK:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.relXgaPk ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.relXgaPk}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              relXgaPk: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv Rel xGA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.relXga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.relXga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              relXga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv xGA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.xga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.xga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              xga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">inv GA/60 5v5:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.ga5 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.ga5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              ga5: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">xGF% (Očakávané góly %):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.xgfPct ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.xgfPct}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              xgfPct: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Blocks/60 (Bloky):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.dfF?.blk60 ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF.blk60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            dfF: {
                              ...(config.weights?.dfF ?? DEFAULT_LIVE_CALC_WEIGHTS.dfF),
                              blk60: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("dfF")}
              </div>

              {/* CK & DI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Checking (CK) Váhy",
                    "text-rose-400",
                    "ck",
                    (config.weights?.ck?.hit60 ?? 0.6) + (config.weights?.ck?.hitPg ?? 0.4)
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Hits/60:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights.ck.hit60}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              ck: { ...config.weights.ck, hit60: parseFloat(e.target.value) || 0 },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Hits/GP:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights.ck.hitPg}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              ck: { ...config.weights.ck, hitPg: parseFloat(e.target.value) || 0 },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  {renderCustomMetricsSection("ck")}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Discipline (DI) Váhy",
                    "text-amber-400",
                    "di",
                    (config.weights?.di?.penaltyBalance ?? 0.6) + (config.weights?.di?.invPim60 ?? 0.4)
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Penalty balance/60:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights.di.penaltyBalance}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              di: { ...config.weights.di, penaltyBalance: parseFloat(e.target.value) || 0 },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-amber-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Inverse PIM/60:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights.di.invPim60}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              di: { ...config.weights.di, invPim60: parseFloat(e.target.value) || 0 },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>
                  {renderCustomMetricsSection("di")}
                </div>
              </div>

              {/* SK, ST & EX */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Skating (SK) Váhy",
                    "text-teal-400",
                    "sk",
                    config.weights?.sk?.edgeBursts20 ?? DEFAULT_LIVE_CALC_WEIGHTS.sk.edgeBursts20
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1">NHL EDGE Bursts &gt;20mph:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.sk?.edgeBursts20 ?? DEFAULT_LIVE_CALC_WEIGHTS.sk.edgeBursts20}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            sk: {
                              ...(config.weights?.sk ?? DEFAULT_LIVE_CALC_WEIGHTS.sk),
                              edgeBursts20: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-teal-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Frekvencia rýchlostných šprintov &gt; 32 km/h za 60 minút.</p>
                  </div>
                  {renderCustomMetricsSection("sk")}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Strength (ST) Váhy",
                    "text-orange-400",
                    "st",
                    config.weights?.st?.weightPct ?? DEFAULT_LIVE_CALC_WEIGHTS.st.weightPct
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1">Hmotnosť hráča (Weight %):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.st?.weightPct ?? DEFAULT_LIVE_CALC_WEIGHTS.st.weightPct}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            st: {
                              ...(config.weights?.st ?? DEFAULT_LIVE_CALC_WEIGHTS.st),
                              weightPct: parseFloat(e.target.value) || 0,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Percentil hmotnosti v rámci ligy (fyzická sila).</p>
                  </div>
                  {renderCustomMetricsSection("st")}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Experience (EX) Váhy",
                    "text-violet-400",
                    "ex",
                    (config.weights?.ex?.careerRegGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerRegGP) +
                      (config.weights?.ex?.careerPoGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerPoGP)
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Kariéra reg. GP:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights?.ex?.careerRegGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerRegGP}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              ex: {
                                ...(config.weights?.ex ?? DEFAULT_LIVE_CALC_WEIGHTS.ex),
                                careerRegGP: parseFloat(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-violet-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Kariéra play-off GP:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights?.ex?.careerPoGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerPoGP}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              ex: {
                                ...(config.weights?.ex ?? DEFAULT_LIVE_CALC_WEIGHTS.ex),
                                careerPoGP: parseFloat(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-violet-400 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">Skúsenosti na základe odohratých zápasov v NHL.</p>
                  {renderCustomMetricsSection("ex")}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ahl" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-purple-400 text-sm flex items-center gap-2">
                  <span>📊</span> NHL Equivalency (NHLe Faktory)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      AHL NHLe aktuálna sezóna (AHL_NHLe_Latest):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={config.ahlNhleLatest}
                      onChange={(e) => setConfig({ ...config, ahlNhleLatest: parseFloat(e.target.value) || 0.446 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Prepočet AHL bodov/gólov na úroveň NHL (default 0.446 zodpovedá ~45%).
                    </p>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      AHL NHLe predošlá sezóna (AHL_NHLe_Previous):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={config.ahlNhlePrevious}
                      onChange={(e) => setConfig({ ...config, ahlNhlePrevious: parseFloat(e.target.value) || 0.448 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-slate-200 text-sm">
                  Ochranné pravidlá V10 (AHL_PA_SC_BALANCE)
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Systém automaticky chráni hráčov s overenou účasťou v NHL pred znížením parametrov PA a SC.
                  Hráči s aspoň 10 GP v NHL v sezóne 2025/26 alebo aspoň 10 GP v sezóne 2024/25, prípadne hráči
                  bez overených dát (UNKNOWN_GP) si zachovávajú plné pôvodné hodnoty bez penalizácie (zníženie 0, strop 99).
                </p>
              </div>
            </div>
          )}

          {activeTab === "promotion" && isAdmin && (
            <div className="space-y-6">
              {/* Alert note */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <span>👑</span>
                  <span>Správa oficiálnych ligových ratingov (Nástroj komisára)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Tento nástroj umožňuje komisárovi preniesť vypočítané Live ratingy do oficiálnej databázy hráčov
                  (používanej v simulácii, súpiskách a profiloch hráčov). Pred prvým aplikovaním systém automaticky
                  vytvorí <b>trvalú zálohu pôvodných STHS hodnôt</b> (<code className="text-amber-300 font-mono">sthsBackup</code>),
                  vďaka čomu sa viete kedykoľvek jedným klikom vrátiť k pôvodnému stavu.
                </p>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Stav STHS zálohy
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        promoStatus?.hasBackup ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm font-bold text-slate-100">
                      {promoStatus?.hasBackup
                        ? `${promoStatus.backupCount} hráčov chránených`
                        : "Zatiaľ nevytvorená"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {promoStatus?.hasBackup
                      ? "Pôvodné STHS hodnoty sú bezpečne uložené."
                      : "Záloha sa vytvorí automaticky pri 1. aplikácii."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Prepočítané Live ratingy
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {promoStatus?.calculatedSkaters ?? 0} / {promoStatus?.totalSkaters ?? 0} hráčov
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Všetci korčuliari majú pripravené projekcie na aplikáciu.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Naposledy prepočítané
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {config.lastCalculatedAt
                      ? new Date(config.lastCalculatedAt).toLocaleDateString("sk-SK", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Nikdy"}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Aktualizuje sa automaticky po odohratých zápasoch alebo ručne.
                  </p>
                </div>
              </div>

              {/* Action 1: Promote */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-amber-500/30 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>⚡</span>
                      <span>Aplikovať Live Ratingy do oficiálnej STHS databázy</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Prepíše hodnoty parametrov korčuliarov v databáze (tabuľky <code className="text-slate-300">Player</code> a <code className="text-slate-300">SkaterRating</code>)
                      vypočítanými hodnotami z Live kalkulátora:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "Overall"].map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                      <span>✓</span>
                      <span>Morálka (MO) hráčov je úplne vynechaná a zostáva v pôvodnom stave.</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePromote}
                    disabled={!isAdmin || isPending || !promoStatus?.calculatedSkaters}
                    className="shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{isPending ? "⏳" : "🚀"}</span>
                    <span>{isPending ? "Aplikujem…" : "Aplikovať do STHS"}</span>
                  </button>
                </div>
              </div>

              {/* Action 2: Rollback */}
              <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span>↩️</span>
                      <span>Rollback — Obnoviť pôvodné STHS ratingy zo zálohy</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Ak chcete zrušiť aplikované Live ratingy a vrátiť všetkým hráčom ich pôvodné hodnoty pred aplikáciou,
                      kliknite na tlačidlo obnovy. Hodnoty sa okamžite načítajú z trvalej STHS zálohy.
                    </p>
                    {!promoStatus?.hasBackup && (
                      <p className="text-[11px] text-amber-400/80 mt-1">
                        Záloha zatiaľ nebola vytvorená (vytvorí sa pri prvej aplikácii Live ratingov).
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={!isAdmin || isPending || !promoStatus?.hasBackup}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{isPending ? "⏳" : "🔄"}</span>
                    <span>{isPending ? "Obnovujem…" : "Obnoviť zo zálohy"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            disabled={!isPermitted || isPending}
            className="text-xs text-slate-400 hover:text-slate-200 underline transition disabled:opacity-50"
          >
            Obnoviť predvolené
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={!isPermitted || isPending}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "🔄"}</span>
              <span>Sync Live Dáta (MP + AHL)</span>
            </button>

            <button
              onClick={handleRecompute}
              disabled={!isPermitted || isPending}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "⚡"}</span>
              <span>Prepočítať ratingy</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!isPermitted || isPending}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition shadow-md shadow-sky-500/20 disabled:opacity-50"
            >
              {isPending ? "Ukladám…" : "Uložiť nastavenia"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
