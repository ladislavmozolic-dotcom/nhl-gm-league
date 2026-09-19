"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_CONFIG,
  DEFAULT_LIVE_CALC_WEIGHTS,
  LiveCalcConfigData,
} from "@/lib/live-calculator-config";
import {
  saveLiveCalculatorConfigAction,
  triggerLiveCalculatorRecomputeAction,
  triggerLiveCalculatorSyncAction,
} from "@/lib/live-calculator-actions";

export default function LiveCalculatorConfigModal({
  isOpen,
  onClose,
  initialConfig,
  isAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: LiveCalcConfigData;
  isAdmin: boolean;
}) {
  const [config, setConfig] = useState<LiveCalcConfigData>(initialConfig);
  const [activeTab, setActiveTab] = useState<"general" | "weights" | "ahl">("general");
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
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
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <span>🗓️</span> Váhy sezón
                  </h3>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Aktuálna sezóna váha (LatestWeight): {(config.latestWeight * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.latestWeight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setConfig({
                          ...config,
                          latestWeight: val,
                          previousWeight: parseFloat((1 - val).toFixed(2)),
                        });
                      }}
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Predošlá sezóna váha (PreviousWeight): {(config.previousWeight * 100).toFixed(0)}%
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={config.previousWeight}
                      readOnly
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-xs"
                    />
                  </div>
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
              </div>
            </div>
          )}

          {activeTab === "weights" && (
            <div className="space-y-6">
              {/* PA */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-sky-400 text-sm flex items-center justify-between">
                  <span>Passing (PA) Váhy</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Súčet: {((config.weights.pa.apg + config.weights.pa.a60All + config.weights.pa.a60_5v5) * 100).toFixed(0)}%
                  </span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">A/GP (Asistencie / zápas):</label>
                    <input
                      type="number"
                      step="0.05"
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
                      step="0.05"
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
                      step="0.05"
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
              </div>

              {/* SC */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="font-semibold text-emerald-400 text-sm flex items-center justify-between">
                  <span>Scoring (SC) Váhy</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Súčet: {(
                      (config.weights.sc.gpg +
                        config.weights.sc.g60 +
                        config.weights.sc.xg60 +
                        config.weights.sc.g_xg60) *
                      100
                    ).toFixed(0)}%
                  </span>
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">G/GP (Góly / zápas):</label>
                    <input
                      type="number"
                      step="0.05"
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
                      step="0.05"
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
                      step="0.05"
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
                      step="0.05"
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
              </div>

              {/* CK & DI */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h4 className="font-semibold text-rose-400 text-sm">Checking (CK) Váhy</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Hits/60:</label>
                      <input
                        type="number"
                        step="0.05"
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
                        step="0.05"
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
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                  <h4 className="font-semibold text-amber-400 text-sm">Discipline (DI) Váhy</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Penalty balance/60:</label>
                      <input
                        type="number"
                        step="0.05"
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
                        step="0.05"
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
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            disabled={!isAdmin || isPending}
            className="text-xs text-slate-400 hover:text-slate-200 underline transition disabled:opacity-50"
          >
            Obnoviť predvolené
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={!isAdmin || isPending}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "🔄"}</span>
              <span>Sync Live Dáta (MP + AHL)</span>
            </button>

            <button
              onClick={handleRecompute}
              disabled={!isAdmin || isPending}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <span>{isPending ? "⏳" : "⚡"}</span>
              <span>Prepočítať ratingy</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!isAdmin || isPending}
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
