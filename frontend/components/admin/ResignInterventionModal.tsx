"use client";

import { useState, useTransition } from "react";
import { cleanName } from "@/lib/playerName";
import {
  updateResignNegotiationAction,
  forceSignResignAction,
  forceWalkResignAction,
  resetResignAction,
  clearPlayerLowballAction,
} from "@/app/admin/agent/actions";

export type ResignPlayerData = {
  id: number;
  name: string;
  position: string | null;
  age: number | null;
  overall: number | null;
  capHit: number | null;
  contractYears: number | null;
  teamId: number | null;
  teamCode: string | null;
  teamName: string | null;
  resignStatus: string | null;
  resignRound: number;
  resignOfferSalary: number | null;
  resignOfferAt?: Date | string | null;
  resignCounterSalary: number | null;
  resignCounterYears: number | null;
  faDemandOverride: number | null;
  lowballBump: number;
  cbaStatus: "UFA" | "RFA";
  franchiseTag: boolean;
  rfaOsUsed: boolean;
  aiAskSalary: number | null;
  aiFloorSalary: number | null;
  aiMinYears: number | null;
  aiMaxYears: number | null;
  desiredRole: string | null;
};

const fmtM = (c: number | null | undefined) => {
  if (c == null || !Number.isFinite(c)) return "—";
  return `$${(c / 1e6).toFixed(2)}M`;
};

export default function ResignInterventionModal({
  player,
  onClose,
}: {
  player: ResignPlayerData;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"edit" | "sign" | "quick">("edit");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Tab State
  const [status, setStatus] = useState<string>(player.resignStatus ?? "open");
  const [round, setRound] = useState<number>(player.resignRound ?? 0);
  const [offerSalary, setOfferSalary] = useState<string>(
    player.resignOfferSalary ? String(player.resignOfferSalary) : ""
  );
  const [counterSalary, setCounterSalary] = useState<string>(
    player.resignCounterSalary ? String(player.resignCounterSalary) : ""
  );
  const [counterYears, setCounterYears] = useState<number>(
    player.resignCounterYears ?? 1
  );
  const [faDemandOverride, setFaDemandOverride] = useState<string>(
    player.faDemandOverride ? String(player.faDemandOverride) : ""
  );
  const [clearLowball, setClearLowball] = useState<boolean>(player.lowballBump > 1);

  // Force Sign Tab State
  const [signSalary, setSignSalary] = useState<string>(
    player.resignCounterSalary
      ? String(player.resignCounterSalary)
      : player.resignOfferSalary
      ? String(player.resignOfferSalary)
      : player.aiFloorSalary
      ? String(player.aiFloorSalary)
      : "1000000"
  );
  const [signYears, setSignYears] = useState<number>(
    player.resignCounterYears ?? player.aiMinYears ?? 2
  );
  const [twoWay, setTwoWay] = useState<boolean>(false);
  const [clause, setClause] = useState<string>("");
  const [mNtcBreadth, setMNtcBreadth] = useState<number>(12);

  const lowballPct = Math.round((player.lowballBump - 1) * 100);

  const handleSaveEdit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateResignNegotiationAction(player.id, {
        status: status === "null" ? null : status,
        round,
        offerSalary: offerSalary ? Number(offerSalary) : null,
        counterSalary: counterSalary ? Number(counterSalary) : null,
        counterYears: counterYears || null,
        faDemandOverride: faDemandOverride ? Number(faDemandOverride) : null,
        clearLowball,
      });
      if (!res.ok) {
        setError(res.error ?? "Nepodarilo sa uložiť zmeny.");
      } else {
        setSuccess("Vyjednávanie bolo úspešne upravené.");
        setTimeout(() => onClose(), 800);
      }
    });
  };

  const handleForceSign = () => {
    setError(null);
    setSuccess(null);
    const sal = Number(signSalary);
    if (!sal || sal < 775_000) {
      setError("Plat musí byť aspoň minimálny ligový plat ($775,000).");
      return;
    }
    if (!confirm(`Naozaj chcete vynútiť podpis predĺženia pre hráča ${cleanName(player.name)} za ${fmtM(sal)} na ${signYears} rokov?`)) {
      return;
    }

    startTransition(async () => {
      const res = await forceSignResignAction(player.id, {
        salary: sal,
        years: signYears,
        twoWay,
        clause: clause || null,
        mNtcBreadth: clause === "M_NTC" ? mNtcBreadth : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Nepodarilo sa podpísať zmluvu.");
      } else {
        setSuccess("Zmluva bola úspešne predĺžená a zapísaná.");
        setTimeout(() => onClose(), 800);
      }
    });
  };

  const handleReset = () => {
    if (!confirm(`Vymazať prebiehajúce rokovanie hráča ${cleanName(player.name)} a vrátiť GM na začiatok (kolo 0)?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await resetResignAction(player.id, true);
      if (!res.ok) {
        setError(res.error ?? "Chyba pri resete.");
      } else {
        setSuccess("Vyjednávanie bolo resetované.");
        setTimeout(() => onClose(), 800);
      }
    });
  };

  const handleForceWalk = (toUFA: boolean) => {
    const dest = toUFA ? "Trh voľných hráčov (UFA)" : "RFA Offer Sheets";
    if (!confirm(`Ukončiť rokovania a poslať hráča do stavu: ${dest}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await forceWalkResignAction(player.id, toUFA);
      if (!res.ok) {
        setError(res.error ?? "Chyba.");
      } else {
        setSuccess(`Hráč bol presunutý: ${dest}`);
        setTimeout(() => onClose(), 800);
      }
    });
  };

  const handleClearLowballOnly = () => {
    if (!player.teamId) return;
    setError(null);
    startTransition(async () => {
      const res = await clearPlayerLowballAction(player.id, player.teamId!);
      if (!res.ok) {
        setError(res.error ?? "Chyba pri mazaní lowballu.");
      } else {
        setSuccess("Urazenie z nízkej ponuky bolo zmazané.");
        setTimeout(() => onClose(), 800);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white tracking-wide">
                {cleanName(player.name)}
              </h2>
              {player.position && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                  {player.position}
                </span>
              )}
              {player.overall && (
                <span className="px-2 py-0.5 rounded text-xs font-black bg-blue-950/80 border border-blue-800/60 text-blue-300">
                  {player.overall} OVR
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  player.cbaStatus === "RFA"
                    ? "bg-amber-950/80 border border-amber-800/60 text-amber-300"
                    : "bg-slate-800 border border-slate-700 text-slate-300"
                }`}
              >
                {player.cbaStatus}
                {player.franchiseTag ? " · Franchise" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>
                Klub:{" "}
                <b className="text-slate-200">
                  {player.teamCode ?? player.teamName ?? "Bez klubu"}
                </b>
              </span>
              <span>•</span>
              <span>
                Aktuálna zmluva:{" "}
                <b className="text-slate-200">
                  {player.capHit ? fmtM(player.capHit) : "—"}
                </b>{" "}
                ({player.contractYears ?? 0}r zostáva)
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* AI Valuation & Morale Quick Bar */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/70 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="text-slate-500 font-medium">Interný AI odhad:</span>
            <span>
              Požiadavka:{" "}
              <b className="text-emerald-400 font-mono">
                {fmtM(player.aiAskSalary)}
              </b>
            </span>
            <span>
              Floor:{" "}
              <b className="text-sky-400 font-mono">
                {fmtM(player.aiFloorSalary)}
              </b>
            </span>
            {player.aiMinYears && (
              <span>
                Termín:{" "}
                <b className="text-slate-200">
                  {player.aiMinYears}–{player.aiMaxYears ?? player.aiMinYears}r
                </b>
              </span>
            )}
            {player.desiredRole && (
              <span className="text-slate-400">({player.desiredRole})</span>
            )}
          </div>
          {lowballPct > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-semibold flex items-center gap-1">
              😠 Urazený lowballom: +{lowballPct}%
            </span>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 pt-3 bg-slate-900/50 gap-4">
          <button
            onClick={() => setTab("edit")}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              tab === "edit"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            ✏️ Parametre vyjednávania
          </button>
          <button
            onClick={() => setTab("sign")}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              tab === "sign"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            ✍️ Vynútiť podpis (Override)
          </button>
          <button
            onClick={() => setTab("quick")}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              tab === "quick"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            ⚡ Rýchle zásahy
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs">
              {success}
            </div>
          )}

          {tab === "edit" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Stav vyjednávania
                  </span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="open">open (Otvorené rokovania)</option>
                    <option value="countered">countered (Hráč dal protinávrh)</option>
                    <option value="walkedToUFA">walkedToUFA (Odišiel na trh UFA)</option>
                    <option value="osEligible">osEligible (Čaká na Offer Sheets)</option>
                    <option value="null">null (Vynulovať stav)</option>
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Kolo vyjednávania
                  </span>
                  <select
                    value={round}
                    onChange={(e) => setRound(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value={0}>0 (Žiadna ponuka / štart)</option>
                    <option value={1}>1 (Po 1. ponuke klubu)</option>
                    <option value={2}>2 (Finálne 2. kolo)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Posledná ponuka klubu ($)
                    </span>
                    {offerSalary && (
                      <span className="text-xs font-mono text-sky-400 font-bold">
                        {fmtM(Number(offerSalary))}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="50000"
                    placeholder="napr. 5500000"
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Protinávrh ($)
                      </span>
                    </div>
                    <input
                      type="number"
                      step="50000"
                      placeholder="napr. 6000000"
                      value={counterSalary}
                      onChange={(e) => setCounterSalary(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Roky
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={counterYears}
                      onChange={(e) => setCounterYears(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <label className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Ručný FA Demand ($)
                    </span>
                    {faDemandOverride && (
                      <span className="text-xs font-mono text-purple-400 font-bold">
                        {fmtM(Number(faDemandOverride))}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="50000"
                    placeholder="Voliteľný manuálny strop ($)"
                    value={faDemandOverride}
                    onChange={(e) => setFaDemandOverride(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Prepíše automatický výpočet trhovej ceny hráča.
                  </p>
                </label>

                <div className="flex flex-col justify-center pt-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 hover:bg-slate-800 transition">
                    <input
                      type="checkbox"
                      checked={clearLowball}
                      onChange={(e) => setClearLowball(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">
                        Odpustiť lowball urazenie
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Odstráni pamäť o nízkej ponuke (+{lowballPct}% prirážka).
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "sign" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Ako komisár môžete okamžite schváliť a podpísať zmluvu pre klub{" "}
                <b className="text-slate-200">{player.teamCode}</b>. Ak je hráč v
                poslednom roku zmluvy a beží sezóna, predĺženie začne platiť od
                novej sezóny (deferred extension).
              </p>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Plat zmluvy (AAV $)
                    </span>
                    {signSalary && (
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        {fmtM(Number(signSalary))}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="50000"
                    value={signSalary}
                    onChange={(e) => setSignSalary(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Dĺžka zmluvy (roky)
                  </span>
                  <select
                    value={signYears}
                    onChange={(e) => setSignYears(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
                      <option key={y} value={y}>
                        {y} {y === 1 ? "rok" : y < 5 ? "roky" : "rokov"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Klauzula
                  </span>
                  <select
                    value={clause}
                    onChange={(e) => setClause(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Žiadna klauzula</option>
                    <option value="NTC">NTC (No-Trade Clause)</option>
                    <option value="NMC">NMC (No-Movement Clause)</option>
                    <option value="M_NTC">M-NTC (Modified No-Trade)</option>
                  </select>
                </label>

                {clause === "M_NTC" ? (
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Rozsah M-NTC (počet tímov)
                    </span>
                    <select
                      value={mNtcBreadth}
                      onChange={(e) => setMNtcBreadth(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={6}>6 tímov</option>
                      <option value={12}>12 tímov</option>
                      <option value={18}>18 tímov</option>
                      <option value={24}>24 tímov</option>
                    </select>
                  </label>
                ) : (
                  <div className="flex flex-col justify-center pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={twoWay}
                        onChange={(e) => setTwoWay(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span className="text-xs font-semibold text-slate-300">
                        Dvojcestná zmluva (Two-Way deal, $100k AHL)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "quick" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-2">
                Rýchle jednoklikové administratívne operácie pre toto vyjednávanie:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleReset}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition flex items-start gap-3"
                >
                  <span className="text-lg">🔄</span>
                  <div>
                    <div className="text-xs font-bold text-white">Resetovať vyjednávanie</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Vráti kolo na 0, vymaže protinávrhy a umožní GM začať znova.
                    </div>
                  </div>
                </button>

                {lowballPct > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleClearLowballOnly}
                    className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition flex items-start gap-3"
                  >
                    <span className="text-lg">🧹</span>
                    <div>
                      <div className="text-xs font-bold text-amber-300">Zmazať iba lowball urazenie</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Zmaže urazenie hráča bez zmeny rozpracovanej ponuky.
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleForceWalk(true)}
                  className="p-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/50 text-left transition flex items-start gap-3"
                >
                  <span className="text-lg">🚪</span>
                  <div>
                    <div className="text-xs font-bold text-rose-300">Poslať na voľný trh (walkedToUFA)</div>
                    <div className="text-[11px] text-rose-400/80 mt-0.5">
                      Ukončí rokovania a pošle hráča testovať otvorený trh UFA.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleForceWalk(false)}
                  className="p-3 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/50 text-left transition flex items-start gap-3"
                >
                  <span className="text-lg">📜</span>
                  <div>
                    <div className="text-xs font-bold text-purple-300">Otvoriť pre Offer Sheets (osEligible)</div>
                    <div className="text-[11px] text-purple-400/80 mt-0.5">
                      RFA hráč odmietol ponuku a bude dostupný pre súperov.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Zrušiť
          </button>

          {tab === "edit" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleSaveEdit}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-600/30 disabled:opacity-50 transition"
            >
              {pending ? "Ukladám…" : "Uložiť zmeny"}
            </button>
          )}

          {tab === "sign" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleForceSign}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition"
            >
              {pending ? "Podpisujem…" : "Vynútiť podpis predĺženia"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
