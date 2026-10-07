"use client";

import { useState, useEffect, useTransition } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_LIVE_CALC_WEIGHTS,
  DEFAULT_GOALIE_WEIGHTS,
  LiveCalcConfigData,
  CustomMetricConfig,
} from "@/lib/live-calculator-config";
import {
  CATALOG_METRICS,
  METRIC_SOURCES,
  METRIC_BY_KEY,
  GOALIE_CATALOG_METRICS,
  GOALIE_METRIC_BY_KEY,
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
  initialTab = "general",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: LiveCalcConfigData;
  isAdmin: boolean;
  canManage?: boolean;
  initialTab?: "general" | "weights" | "goalies" | "ahl" | "rookie" | "promotion";
}) {
  const isPermitted = isAdmin || canManage;
  const [config, setConfig] = useState<LiveCalcConfigData>(initialConfig);
  const [activeTab, setActiveTab] = useState<"general" | "weights" | "goalies" | "ahl" | "rookie" | "promotion">(initialTab);
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
    targetType: "skater" | "goalie";
  } | null>(null);

  const [newSource, setNewSource] = useState<MetricSource>("nhl");
  const [newMetricKey, setNewMetricKey] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newWeight, setNewWeight] = useState<number>(0.1);
  const [newInvert, setNewInvert] = useState<boolean>(false);

  const openAddModal = (groupKey: string, groupName: string, targetType: "skater" | "goalie" = "skater") => {
    const catalog = targetType === "goalie" ? GOALIE_CATALOG_METRICS : CATALOG_METRICS;
    const initialSource: MetricSource = targetType === "goalie" ? "moneypuck" : "nhl";
    const sourceMetrics = catalog.filter((m) => m.source === initialSource);
    const firstMetric = sourceMetrics[0] || catalog[0];

    setNewSource(firstMetric ? (firstMetric.source as MetricSource) : initialSource);
    setNewMetricKey(firstMetric ? firstMetric.key : "");
    setNewLabel(firstMetric ? firstMetric.label : "");
    setNewWeight(0.1);
    setNewInvert(firstMetric ? firstMetric.defaultInvert : false);
    setAddModal({ groupKey, groupName, targetType });
  };

  const handleSourceChange = (src: MetricSource) => {
    setNewSource(src);
    const catalog = addModal?.targetType === "goalie" ? GOALIE_CATALOG_METRICS : CATALOG_METRICS;
    const sourceMetrics = catalog.filter((m) => m.source === src);
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
    const dict = addModal?.targetType === "goalie" ? GOALIE_METRIC_BY_KEY : METRIC_BY_KEY;
    const def = dict[key];
    if (def) {
      setNewLabel(def.label);
      setNewInvert(def.defaultInvert);
    }
  };

  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addModal || !newMetricKey) return;

    const dict = addModal.targetType === "goalie" ? GOALIE_METRIC_BY_KEY : METRIC_BY_KEY;
    const def = dict[newMetricKey];
    const newMetric: CustomMetricConfig = {
      id: `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      metricKey: newMetricKey,
      label: newLabel.trim() || def?.label || newMetricKey,
      source: newSource,
      weight: Math.max(0, Number(newWeight) || 0.1),
      invert: newInvert,
    };

    const groupKey = addModal.groupKey;
    if (addModal.targetType === "goalie") {
      const currentList = config.goalieWeights?.customMetrics?.[groupKey] ?? [];
      setConfig({
        ...config,
        goalieWeights: {
          ...(config.goalieWeights ?? DEFAULT_GOALIE_WEIGHTS),
          customMetrics: {
            ...(config.goalieWeights?.customMetrics ?? {}),
            [groupKey]: [...currentList, newMetric],
          },
        },
      });
    } else {
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
    }

    setAddModal(null);
  };

  const handleCustomMetricWeightChange = (
    groupKey: string,
    id: string,
    val: number,
    targetType: "skater" | "goalie" = "skater"
  ) => {
    if (targetType === "goalie") {
      const currentList = config.goalieWeights?.customMetrics?.[groupKey] ?? [];
      const updatedList = currentList.map((cm) => (cm.id === id ? { ...cm, weight: val } : cm));
      setConfig({
        ...config,
        goalieWeights: {
          ...(config.goalieWeights ?? DEFAULT_GOALIE_WEIGHTS),
          customMetrics: {
            ...(config.goalieWeights?.customMetrics ?? {}),
            [groupKey]: updatedList,
          },
        },
      });
    } else {
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
    }
  };

  const handleRemoveCustomMetric = (
    groupKey: string,
    id: string,
    targetType: "skater" | "goalie" = "skater"
  ) => {
    if (targetType === "goalie") {
      const currentList = config.goalieWeights?.customMetrics?.[groupKey] ?? [];
      const updatedList = currentList.filter((cm) => cm.id !== id);
      setConfig({
        ...config,
        goalieWeights: {
          ...(config.goalieWeights ?? DEFAULT_GOALIE_WEIGHTS),
          customMetrics: {
            ...(config.goalieWeights?.customMetrics ?? {}),
            [groupKey]: updatedList,
          },
        },
      });
    } else {
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
    }
  };

  const renderCardHeader = (
    title: string,
    titleColor: string,
    groupKey: string,
    stdSum: number,
    targetType: "skater" | "goalie" = "skater"
  ) => {
    const customList =
      targetType === "goalie"
        ? config.goalieWeights?.customMetrics?.[groupKey] ?? []
        : config.weights?.customMetrics?.[groupKey] ?? [];
    const customSum = customList.reduce((acc, cm) => acc + (cm.weight || 0), 0);
    const totalSum = stdSum + customSum;

    return (
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold ${titleColor} text-sm`}>{title}</h4>
          {customList.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              +{customList.length} custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="text-xs text-slate-400 font-mono"
            title={`Standard: ${(stdSum * 100).toFixed(0)}% + Custom: ${(customSum * 100).toFixed(0)}%`}
          >
            Total: {(totalSum * 100).toFixed(0)}%
          </span>
          <button
            type="button"
            onClick={() => openAddModal(groupKey, title, targetType)}
            className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 hover:text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            title={
              targetType === "goalie"
                ? "Add a new goalie metric"
                : "Add a new metric from the NHL API, MoneyPuck, EDGE, AHL or Biometrics"
            }
          >
            <span className="text-sm leading-none font-bold">+</span>
            <span>Add metric</span>
          </button>
        </div>
      </div>
    );
  };

  const renderCustomMetricsSection = (groupKey: string, targetType: "skater" | "goalie" = "skater") => {
    const list =
      targetType === "goalie"
        ? config.goalieWeights?.customMetrics?.[groupKey] ?? []
        : config.weights?.customMetrics?.[groupKey] ?? [];
    if (list.length === 0) return null;

    const dict = targetType === "goalie" ? GOALIE_METRIC_BY_KEY : METRIC_BY_KEY;

    return (
      <div className="pt-3 mt-3 border-t border-slate-700/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span>✨</span> Custom added metrics ({list.length})
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            Normalized automatically into the overall percentile
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {list.map((cm) => {
            const sourceMeta = METRIC_SOURCES[cm.source as MetricSource];
            const def = dict[cm.metricKey];
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
                      {cm.invert ? "↓ lower = better" : "↑ higher = better"}
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
                    <label className="block text-[9px] text-slate-500 mb-0.5 font-mono">Weight:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={cm.weight}
                      onChange={(e) =>
                        handleCustomMetricWeightChange(groupKey, cm.id, parseFloat(e.target.value) || 0, targetType)
                      }
                      className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomMetric(groupKey, cm.id, targetType)}
                    className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 flex items-center justify-center text-xs transition"
                    title="Remove metric"
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
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (isAdmin) {
        loadPromoStatus();
        getAllTeamsForAssignmentAction()
          .then(setEligibleTeams)
          .catch((err) => console.error("Failed to load eligible teams:", err));
      }
    }
  }, [isOpen, isAdmin, initialTab]);

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
          setStatusMsg({ type: "success", text: "Settings saved successfully." });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Error saving settings." });
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
            text: `Recalculation complete! Processed ${res.totalProcessed} players (${res.nhlCount} NHL, ${res.ahlCount} AHL).`,
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Error during recalculation." });
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
            text: `Sync and recalculation complete! MoneyPuck matches: ${res.sync.moneyPuckMatched}, AHL matches: ${res.sync.ahlMatchedCur}.`,
          });
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Error during sync." });
      }
    });
  };

  const handleResetDefaults = () => {
    if (confirm("Do you really want to reset all weights and settings to the defaults?")) {
      setConfig({
        ...DEFAULT_CONFIG,
        lastCalculatedAt: config.lastCalculatedAt,
        lastSyncedAt: config.lastSyncedAt,
      });
      setStatusMsg({ type: "success", text: "Defaults restored (do not forget to click Save)." });
    }
  };

  const handlePromote = () => {
    if (
      !confirm(
        "Warning! You are about to apply the recalculated Live ratings to the official STHS player ratings.\n\n" +
          "• The system automatically creates a permanent backup of the original STHS ratings if one does not exist yet.\n" +
          "• You can restore them with one click at any time (Rollback).\n" +
          "• Players' morale (MO) stays unchanged.\n\n" +
          "Do you really want to apply the Live ratings to the league database?"
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
            text: `Live ratings were applied to STHS successfully! Updated ${res.updatedCount} players (backed up: ${res.backedUpCount}).`,
          });
          loadPromoStatus();
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Error applying the ratings." });
      }
    });
  };

  const handleRestore = () => {
    if (
      !confirm(
        "Do you really want to restore the original official STHS ratings from the backup?\n\n" +
          "All players get back their original parameters from before the Live calculator was applied."
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
            text: `The original STHS ratings were restored from the backup successfully (${res.restoredCount} players)!`,
          });
          loadPromoStatus();
        }
      } catch (err: any) {
        setStatusMsg({ type: "error", text: err.message || "Error restoring from the backup." });
      }
    });
  };

  const activeCatalog = addModal?.targetType === "goalie" ? GOALIE_CATALOG_METRICS : CATALOG_METRICS;
  const activeDict = addModal?.targetType === "goalie" ? GOALIE_METRIC_BY_KEY : METRIC_BY_KEY;
  const selectedMetricDef = activeDict[newMetricKey];
  const availableSources = Array.from(new Set(activeCatalog.map((m) => m.source))) as MetricSource[];

  const gw = config.goalieWeights ?? DEFAULT_GOALIE_WEIGHTS;
  const updateGw = (attr: string, field: string, val: number) => {
    setConfig({
      ...config,
      goalieWeights: {
        ...gw,
        [attr]: {
          ...((gw as any)[attr] ?? {}),
          [field]: val,
        },
      },
    });
  };

  const removeGoalieMetricBtn = (attr: string, field: string) => (
    <button
      type="button"
      onClick={() => updateGw(attr, field, 0)}
      className="w-5 h-5 shrink-0 rounded-md bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 flex items-center justify-center text-[10px] transition"
      title="Remove the metric from the calculation (weight = 0)"
    >
      ✕
    </button>
  );

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
                  <h3 className="font-bold text-white text-sm">
                    Add a new metric to the calculation {addModal.targetType === "goalie" ? "(Goalies)" : "(Skaters)"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Target parameter: <span className="text-sky-300 font-semibold">{addModal.groupName}</span>
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
                  1. Data server / value source:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableSources.map((src) => {
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
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block w-fit mb-1 ${meta?.color ?? ""}`}>
                          {meta?.badge ?? src}
                        </span>
                        <span className="text-xs font-medium line-clamp-1">{meta?.name ?? src}</span>
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
                  2. Select a metric / statistic:
                </label>
                <select
                  value={newMetricKey}
                  onChange={(e) => handleMetricKeyChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs focus:border-sky-400 outline-none"
                >
                  {activeCatalog.filter((m) => m.source === newSource).map((m) => (
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
                  3. Metric name (Label):
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
                      <div className="font-semibold text-xs">Higher = better</div>
                      <div className="text-[10px] text-slate-400">Points, speed, hits...</div>
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
                      <div className="font-semibold text-xs">Lower = better (Inverse)</div>
                      <div className="text-[10px] text-slate-400">xGA, GA, PIM, straty...</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 5: Initial Weight */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  5. Initial weight in the formula:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newMetricKey}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition disabled:opacity-50"
                >
                  Add to the calculation
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
                Configuration of season weights, MoneyPuck data, NHLe coefficients and recalculation formulas.
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
            General & Seasons (CONFIG_V8)
          </button>
          <button
            onClick={() => setActiveTab("weights")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "weights"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Skater weights (PA, SC, DF, CK, DI, PH)
          </button>
          <button
            onClick={() => setActiveTab("goalies")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "goalies"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🥅</span>
            <span>Goalie weights (SC, RT, HS, AG...)</span>
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
          <button
            onClick={() => setActiveTab("rookie")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "rookie"
                ? "border-sky-400 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>👶</span>
            <span>Rookies & Prospects</span>
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
              <span>Apply to STHS (Commissioner)</span>
              {promoStatus?.hasBackup && (
                <span
                  title="A backup exists"
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
                      <span>🗓️</span> Season weights
                    </h3>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 text-[11px] select-none">
                      <input
                        type="checkbox"
                        checked={autoBalanceSeasons}
                        onChange={(e) => setAutoBalanceSeasons(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500 focus:ring-sky-400 bg-slate-900 w-3.5 h-3.5"
                      />
                      <span>Auto-complete to 100%</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                        Current season (LatestWeight):
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
                        Previous season (PreviousWeight):
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
                      <span>Season ratio (slider):</span>
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
                        <span>Total: </span>
                        <strong className="font-mono">{((config.latestWeight + config.previousWeight) * 100).toFixed(1)}%</strong>
                        <span className="text-slate-400 ml-1">
                          (effective {((config.latestWeight / (config.latestWeight + config.previousWeight || 1)) * 100).toFixed(1)}% / {((config.previousWeight / (config.latestWeight + config.previousWeight || 1)) * 100).toFixed(1)}%)
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
                        Normalize to 100%
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>🏒</span> Classification thresholds (NHL vs AHL)
                  </h3>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Min. GP current season (NHL_GP_Latest_Min):
                    </label>
                    <input
                      type="number"
                      value={config.nhlGpLatestMin}
                      onChange={(e) => setConfig({ ...config, nhlGpLatestMin: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      A player with at least this many GP in the current season belongs to the NHL group.
                    </p>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Min. GP previous season (NHL_GP_Previous_MinExclusive):
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
                    <span>📁</span> MoneyPuck folders
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Current year (LatestMPYear):</label>
                      <input
                        type="number"
                        value={config.latestMpYear}
                        onChange={(e) => setConfig({ ...config, latestMpYear: parseInt(e.target.value) || 2025 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Previous year (PreviousMPYear):</label>
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
                    <span>ℹ️</span> Status information
                  </h3>
                  <div className="space-y-1.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Last recalculation:</span>
                      <span className="font-mono text-slate-200">
                        {config.lastCalculatedAt ? new Date(config.lastCalculatedAt).toLocaleString("en-GB") : "Not run yet"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last sync:</span>
                      <span className="font-mono text-slate-200">
                        {config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString("en-GB") : "Not run yet"}
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
                          <span>👥</span> Delegated GMs (Live Calculator management)
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Select the teams / GMs who will have access <strong>to this calculator only</strong> (editing weights, sync, recalculation), without administrator rights over the league.
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
                        {(config.managerTeamIds ?? []).length} delegated
                      </span>
                    </div>

                    {/* Team search input */}
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Filter by team, code or GM name..."
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
                          Loading the team list...
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
                  "Passing (PA) Weights",
                  "text-sky-400",
                  "pa",
                  (config.weights?.pa?.apg ?? 0.45) +
                    (config.weights?.pa?.a60All ?? 0.3) +
                    (config.weights?.pa?.a60_5v5 ?? 0.25)
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">A/GP (Assists / game):</label>
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
                    <label className="block text-slate-400 mb-1">A/60 All (All game situations):</label>
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
                    <label className="block text-slate-400 mb-1">A/60 5v5 (Even strength):</label>
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
                  "Scoring (SC) Weights",
                  "text-emerald-400",
                  "sc",
                  (config.weights?.sc?.gpg ?? 0.45) +
                    (config.weights?.sc?.g60 ?? 0.25) +
                    (config.weights?.sc?.xg60 ?? 0.2) +
                    (config.weights?.sc?.g_xg60 ?? 0.1)
                )}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">G/GP (Goals / game):</label>
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
                    <label className="block text-slate-400 mb-1">G/60 (Goals / 60 min):</label>
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
                    <label className="block text-slate-400 mb-1">xG/60 (Expected goals):</label>
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
                  "Defense (DF) Weights — Defensemen (D)",
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
                    <label className="block text-slate-400 mb-1">xGF% (Expected goals %):</label>
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
                  "Defense (DF) Weights — Forwards (F)",
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
                    <label className="block text-slate-400 mb-1">xGF% (Expected goals %):</label>
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
                    "Checking (CK) Weights",
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
                    "Discipline (DI) Weights",
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

              {/* PH — position-specific like DF */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Puck Handling (PH) Weights — Forwards (F)",
                  "text-cyan-400",
                  "phF",
                  (config.weights?.phF?.turnoverProtection ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.turnoverProtection) +
                    (config.weights?.phF?.offensiveZoneTime ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.offensiveZoneTime) +
                    (config.weights?.phF?.takeaways60 ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.takeaways60)
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Ochrana puku (inv. giveaways / puck actions):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.phF?.turnoverProtection ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.turnoverProtection}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            phF: { ...(config.weights?.phF ?? DEFAULT_LIVE_CALC_WEIGHTS.phF), turnoverProtection: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">NHL EDGE 5v5 offensive-zone puck time:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.phF?.offensiveZoneTime ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.offensiveZoneTime}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            phF: { ...(config.weights?.phF ?? DEFAULT_LIVE_CALC_WEIGHTS.phF), offensiveZoneTime: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Takeaways / 60:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.weights?.phF?.takeaways60 ?? DEFAULT_LIVE_CALC_WEIGHTS.phF.takeaways60}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            phF: { ...(config.weights?.phF ?? DEFAULT_LIVE_CALC_WEIGHTS.phF), takeaways60: parseFloat(e.target.value) || 0 },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">NHL EDGE measures where the puck is while the player is on the ice. The controlled-entry feed is not publicly available; this 5v5 figure is its tracking possession proxy.</p>
                {renderCustomMetricsSection("phF")}
              </div>
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Puck Handling (PH) Weights — Defensemen (D)",
                  "text-blue-400",
                  "phD",
                  (config.weights?.phD?.turnoverProtection ?? DEFAULT_LIVE_CALC_WEIGHTS.phD.turnoverProtection) +
                    (config.weights?.phD?.offensiveZoneTime ?? DEFAULT_LIVE_CALC_WEIGHTS.phD.offensiveZoneTime) +
                    (config.weights?.phD?.takeaways60 ?? DEFAULT_LIVE_CALC_WEIGHTS.phD.takeaways60)
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    ["turnoverProtection", "Ochrana puku (inv. giveaways / puck actions):"],
                    ["offensiveZoneTime", "NHL EDGE 5v5 offensive-zone puck time:"],
                    ["takeaways60", "Takeaways / 60:"],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-slate-400 mb-1">{label}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={config.weights?.phD?.[key] ?? DEFAULT_LIVE_CALC_WEIGHTS.phD[key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weights: {
                              ...config.weights,
                              phD: { ...(config.weights?.phD ?? DEFAULT_LIVE_CALC_WEIGHTS.phD), [key]: parseFloat(e.target.value) || 0 },
                            },
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">For D, offensive-zone puck time is only 10% — this figure describes the pair's deployment and the team offense more than individual puck handling. More weight goes to puck protection.</p>
                {renderCustomMetricsSection("phD")}
              </div>
              </div>

              {/* SK, ST & EX */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Skating (SK) Weights",
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
                    <p className="text-[10px] text-slate-500 mt-1">Frequency of speed bursts &gt; 32 km/h per 60 minutes.</p>
                  </div>
                  {renderCustomMetricsSection("sk")}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Strength (ST) Weights",
                    "text-orange-400",
                    "st",
                    config.weights?.st?.weightPct ?? DEFAULT_LIVE_CALC_WEIGHTS.st.weightPct
                  )}
                  <div>
                    <label className="block text-slate-400 mb-1">Player weight (Weight %):</label>
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
                    <p className="text-[10px] text-slate-500 mt-1">Weight percentile within the league (physical strength).</p>
                  </div>
                  {renderCustomMetricsSection("st")}
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  {renderCardHeader(
                    "Experience (EX) Weights",
                    "text-violet-400",
                    "ex",
                    (config.weights?.ex?.careerRegGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerRegGP) +
                      (config.weights?.ex?.careerPoGP ?? DEFAULT_LIVE_CALC_WEIGHTS.ex.careerPoGP)
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Career reg. GP:</label>
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
                      <label className="block text-slate-400 mb-1">Career playoff GP:</label>
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
                  <p className="text-[10px] text-slate-500">Experience based on NHL games played.</p>
                  {renderCustomMetricsSection("ex")}
                </div>
              </div>
            </div>
          )}

          {activeTab === "goalies" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>🥅</span> Goalie attribute weights (STHS Goalie Ratings)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Goalie recalculation from MoneyPuck advanced metrics, NHL stats and biometrics. Each card lets you adjust the base weights and, via "Add metric", attach SV%, GAA, GSAx, danger splits, rebounds, freezes or workload. Morale (MO) stays protected and untouched.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    13 parametrov
                  </span>
                </div>
              </div>

              {/* SC */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Style Control (SC) – Pokrytie striel a priestoru",
                  "text-sky-400",
                  "sc",
                  (gw.sc?.ldSv ?? 0.4) + (gw.sc?.mdSv ?? 0.35) + (gw.sc?.gsax60 ?? 0.25),
                  "goalie"
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">Low-Danger SV% (Long-range shots):</label>
                      {removeGoalieMetricBtn("sc", "ldSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.sc?.ldSv ?? 0.4}
                      onChange={(e) => updateGw("sc", "ldSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">Medium-Danger SV% (Mid-range):</label>
                      {removeGoalieMetricBtn("sc", "mdSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.sc?.mdSv ?? 0.35}
                      onChange={(e) => updateGw("sc", "mdSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">GSAx / 60 min (Goals saved above expected):</label>
                      {removeGoalieMetricBtn("sc", "gsax60")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.sc?.gsax60 ?? 0.25}
                      onChange={(e) => updateGw("sc", "gsax60", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("sc", "goalie")}
              </div>

              {/* RT */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Reaction Time (RT) – Lightning reactions and sure goals",
                  "text-emerald-400",
                  "rt",
                  (gw.rt?.hdSv ?? 0.6) + (gw.rt?.hdGsax ?? 0.4),
                  "goalie"
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">High-Danger SV% (Save % on sure goals):</label>
                      {removeGoalieMetricBtn("rt", "hdSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.rt?.hdSv ?? 0.6}
                      onChange={(e) => updateGw("rt", "hdSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">HD GSAx (Goals saved from sure goals):</label>
                      {removeGoalieMetricBtn("rt", "hdGsax")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.rt?.hdGsax ?? 0.4}
                      onChange={(e) => updateGw("rt", "hdGsax", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("rt", "goalie")}
              </div>

              {/* HS */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Hand Speed (HS) – Hand speed (Glove & Blocker)",
                  "text-amber-400",
                  "hs",
                  (gw.hs?.hdSv ?? 0.5) + (gw.hs?.gsax60 ?? 0.5),
                  "goalie"
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">High-Danger SV%:</label>
                      {removeGoalieMetricBtn("hs", "hdSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.hs?.hdSv ?? 0.5}
                      onChange={(e) => updateGw("hs", "hdSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">GSAx / 60 min:</label>
                      {removeGoalieMetricBtn("hs", "gsax60")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.hs?.gsax60 ?? 0.5}
                      onChange={(e) => updateGw("hs", "gsax60", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("hs", "goalie")}
              </div>

              {/* AG */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Agility (AG) – Mobility in the crease",
                  "text-teal-400",
                  "ag",
                  (gw.ag?.mdSv ?? 0.5) + (gw.ag?.hdSv ?? 0.5),
                  "goalie"
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">Medium-Danger SV%:</label>
                      {removeGoalieMetricBtn("ag", "mdSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.ag?.mdSv ?? 0.5}
                      onChange={(e) => updateGw("ag", "mdSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-teal-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">High-Danger SV%:</label>
                      {removeGoalieMetricBtn("ag", "hdSv")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.ag?.hdSv ?? 0.5}
                      onChange={(e) => updateGw("ag", "hdSv", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-teal-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("ag", "goalie")}
              </div>

              {/* RB */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Rebound Control (RB) – Rebound control",
                  "text-indigo-400",
                  "rb",
                  gw.rb?.rebCtrl ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">
                    Rebound Control (xRebounds − Rebounds allowed):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.rb?.rebCtrl ?? 1.0}
                    onChange={(e) => updateGw("rb", "rebCtrl", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-indigo-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("rb", "goalie")}
              </div>

              {/* EN */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Endurance (EN) – Physical endurance & workload",
                  "text-orange-400",
                  "en",
                  gw.en?.icetime ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">
                    Ice Time (Total time in net, in minutes):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.en?.icetime ?? 1.0}
                    onChange={(e) => updateGw("en", "icetime", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-orange-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("en", "goalie")}
              </div>

              {/* SZ */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Size (SZ) – Physical size and height",
                  "text-blue-400",
                  "sz",
                  gw.sz?.sz ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Goalie height (Height cm):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.sz?.sz ?? 1.0}
                    onChange={(e) => updateGw("sz", "sz", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-blue-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("sz", "goalie")}
              </div>

              {/* EX */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Experience (EX) – Career NHL experience",
                  "text-purple-400",
                  "ex",
                  (gw.ex?.careerRegGP ?? 0.7) + (gw.ex?.careerPoGP ?? 0.3),
                  "goalie"
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">Career regular-season games (Reg GP):</label>
                      {removeGoalieMetricBtn("ex", "careerRegGP")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.ex?.careerRegGP ?? 0.7}
                      onChange={(e) => updateGw("ex", "careerRegGP", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-slate-400">Career playoff games (PO GP):</label>
                      {removeGoalieMetricBtn("ex", "careerPoGP")}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={gw.ex?.careerPoGP ?? 0.3}
                      onChange={(e) => updateGw("ex", "careerPoGP", parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-400 outline-none"
                    />
                  </div>
                </div>
                {renderCustomMetricsSection("ex", "goalie")}
              </div>

              {/* DU */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Durability (DU) – Durability and starting stability",
                  "text-pink-400",
                  "du",
                  gw.du?.availability ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Availability / Games started in the season:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.du?.availability ?? 1.0}
                    onChange={(e) => updateGw("du", "availability", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-pink-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("du", "goalie")}
              </div>

              {/* PH */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Puck Handling & Freeze (PH) – Puck handling and freezing",
                  "text-cyan-400",
                  "ph",
                  gw.ph?.freezePct ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Freeze % (Share of pucks frozen):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.ph?.freezePct ?? 1.0}
                    onChange={(e) => updateGw("ph", "freezePct", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("ph", "goalie")}
              </div>

              {/* SK */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Skating (SK) – Skating and mobility",
                  "text-lime-400",
                  "sk",
                  gw.sk?.agility ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Mobility in the crease:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.sk?.agility ?? 1.0}
                    onChange={(e) => updateGw("sk", "agility", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-lime-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("sk", "goalie")}
              </div>

              {/* PS */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Penalty Shot (PS) – Shootouts and clean breakaways",
                  "text-rose-400",
                  "ps",
                  gw.ps?.hdSv ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">High-Danger SV%:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.ps?.hdSv ?? 1.0}
                    onChange={(e) => updateGw("ps", "hdSv", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-rose-400 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("ps", "goalie")}
              </div>

              {/* LD */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                {renderCardHeader(
                  "Leadership (LD) – Leadership and respect",
                  "text-amber-300",
                  "ld",
                  gw.ld?.experience ?? 1.0,
                  "goalie"
                )}
                <div>
                  <label className="block text-slate-400 mb-1">Experience & veteran status:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={gw.ld?.experience ?? 1.0}
                    onChange={(e) => updateGw("ld", "experience", parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-amber-300 outline-none"
                  />
                </div>
                {renderCustomMetricsSection("ld", "goalie")}
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
                      AHL NHLe current season (AHL_NHLe_Latest):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={config.ahlNhleLatest}
                      onChange={(e) => setConfig({ ...config, ahlNhleLatest: parseFloat(e.target.value) || 0.446 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-purple-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Conversion of AHL points/goals to the NHL level (the default 0.446 corresponds to ~45%).
                    </p>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      AHL NHLe previous season (AHL_NHLe_Previous):
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
                  V10 protection rules (AHL_PA_SC_BALANCE)
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  The system automatically protects players with verified NHL participation from reductions of the PA and SC parameters.
                  Players with at least 10 GP in the NHL in the 2025/26 season or at least 10 GP in the 2024/25 season, or players
                  without verified data (UNKNOWN_GP) keep their full original values without penalty (reduction 0, cap 99).
                </p>
              </div>
            </div>
          )}

          {activeTab === "rookie" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-sky-400 text-sm flex items-center gap-2">
                  <span>👶</span> Link with the live skater parameters
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  The Rookie calculator uses the <b>same live metrics and weights</b> as the regular player calculator.
                  If you change the weights for shooting (SC), passing (PA), defense (DF), hits (CK), discipline (DI),
                  skating (SK) or AHL conversion factors in the <i>Skater weights</i> and <i>AHL &amp; NHLe</i> tabs,
                  these changes are applied directly to the rookie and prospect calculation as well.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-amber-400 text-sm flex items-center gap-2">
                  <span>🎯</span> Real-debutant scanner filter
                </h4>
                <p className="text-slate-400 text-xs">
                  Minimum number of real games played (NHL + AHL combined) for a player to be found by the scanner and created automatically:
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={config.weights.rookie?.minScanGp ?? 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setConfig({
                        ...config,
                        weights: {
                          ...config.weights,
                          rookie: {
                            ...(config.weights.rookie ?? { minScanGp: 1 }),
                            minScanGp: isNaN(val) ? 1 : val,
                          },
                        },
                      });
                    }}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:border-sky-400 outline-none"
                  />
                  <span className="text-xs text-slate-400">games (default: 1)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-emerald-400 text-sm flex items-center gap-2">
                  <span>🛡️</span> Ochrana pred malou vzorkou (Bayesian Sample Shrinkage)
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  For rookies with few games (1–10 GP), per-60 stats can artificially spike to extremes (e.g. 1 goal in 2 games would otherwise mean the 99th percentile and SC 92).
                  The engine therefore applies Bayesian regularization:
                </p>
                <div className="p-3 bg-slate-900/60 rounded-lg font-mono text-xs text-slate-300">
                  r = GP / (GP + 20) &nbsp;→&nbsp; P_final = r × P_live + (1 - r) × P_rookie
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  As the number of games grows, the influence of live data increases. The resulting Overall of young players without much history therefore realistically stays within <b>OV 46–56</b> instead of an unrealistic 65+.
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
                  <span>Official league rating management (Commissioner tool)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  This tool lets the commissioner transfer the calculated Live ratings to the official player database
                  (used in the simulation, rosters and player profiles). Before the first application the system automatically
                  creates a <b>permanent backup of the original STHS values</b> (<code className="text-amber-300 font-mono">sthsBackup</code>),
                  so you can return to the original state with one click at any time.
                </p>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    STHS backup status
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        promoStatus?.hasBackup ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm font-bold text-slate-100">
                      {promoStatus?.hasBackup
                        ? `${promoStatus.backupCount} players protected`
                        : "Not created yet"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {promoStatus?.hasBackup
                      ? "The original STHS values are safely stored."
                      : "The backup is created automatically on the 1st application."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Recalculated Live ratings
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {promoStatus?.calculatedSkaters ?? 0} / {promoStatus?.totalSkaters ?? 0} players
                  </div>
                  <p className="text-[10px] text-slate-500">
                    All skaters have projections ready to apply.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Last recalculated
                  </div>
                  <div className="text-sm font-bold text-slate-100">
                    {config.lastCalculatedAt
                      ? new Date(config.lastCalculatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Nikdy"}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Updated automatically after games are played or manually.
                  </p>
                </div>
              </div>

              {/* Action 1: Promote */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-amber-500/30 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>⚡</span>
                      <span>Apply Live Ratings to the official STHS database</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Overwrites the skater parameter values in the database (tables <code className="text-slate-300">Player</code> a <code className="text-slate-300">SkaterRating</code>)
                      with the values computed by the Live calculator:
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
                      <span>Players' morale (MO) is left out entirely and stays in its original state.</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePromote}
                    disabled={!isAdmin || isPending || !promoStatus?.calculatedSkaters}
                    className="shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{isPending ? "⏳" : "🚀"}</span>
                    <span>{isPending ? "Applying…" : "Apply to STHS"}</span>
                  </button>
                </div>
              </div>

              {/* Action 2: Rollback */}
              <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <span>↩️</span>
                      <span>Rollback — Restore the original STHS ratings from the backup</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      If you want to undo the applied Live ratings and return all players their original values from before the application,
                      click the restore button. The values are loaded immediately from the permanent STHS backup.
                    </p>
                    {!promoStatus?.hasBackup && (
                      <p className="text-[11px] text-amber-400/80 mt-1">
                        No backup has been created yet (it is created on the first application of Live ratings).
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
                    <span>{isPending ? "Restoring…" : "Restore from backup"}</span>
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
            Reset to defaults
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={!isPermitted || isPending}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "🔄"}</span>
              <span>Sync Live Data (MP + AHL)</span>
            </button>

            <button
              onClick={handleRecompute}
              disabled={!isPermitted || isPending}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "⚡"}</span>
              <span>Recalculate ratings</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!isPermitted || isPending}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition shadow-md shadow-sky-500/20 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
