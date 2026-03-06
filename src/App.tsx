import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Zap, Droplets, Car, Hospital, Activity, AlertTriangle, ShieldAlert, Users, Phone, Info, LayoutDashboard, TrendingUp, Share2, Settings, Globe } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

/**
 * CITYWATCH — INFRASTRUCTURE CAPACITY & UTILIZATION MONITOR
 * A hackathon-ready, single-file infrastructure simulation dashboard.
 */

// ════════════════════════════════════════
// 1. CONSTANTS & DATA
// ════════════════════════════════════════

const ZONE_NAMES = [
  "North West", "North Central", "North East",
  "Central West", "City Core", "Central East",
  "South West", "South Central", "South East"
];

const ZONE_POPS = [42000, 58000, 39000, 61000, 94000, 55000, 37000, 48000, 41000];
const ZONE_TYPES = [
  "Residential", "Residential", "Commercial",
  "Industrial", "City Core", "Industrial",
  "Residential", "Commercial", "Residential"
];

const ASSETS = ["roads", "power", "water", "healthcare"];

const ASSET_PROFILES = {
  Residential: { roads: [0.8, 1.2, 0.7, 1.1], power: [0.6, 1.1, 0.8, 1.3], water: [0.7, 1.3, 0.6, 1.2], healthcare: [0.9, 1.0, 1.0, 1.1] },
  Commercial: { roads: [0.5, 1.4, 1.5, 0.8], power: [0.4, 1.3, 1.4, 0.6], water: [0.5, 1.1, 1.2, 0.7], healthcare: [1.0, 1.2, 1.1, 1.0] },
  Industrial: { roads: [0.7, 1.1, 1.1, 0.9], power: [1.2, 1.3, 1.3, 1.2], water: [1.3, 1.4, 1.4, 1.3], healthcare: [0.8, 0.9, 0.9, 0.8] },
  "City Core": { roads: [0.6, 1.5, 1.6, 0.9], power: [0.7, 1.4, 1.5, 0.8], water: [0.8, 1.3, 1.4, 0.9], healthcare: [1.1, 1.3, 1.2, 1.1] }
};

const ASSET_META: Record<string, { label: string, icon: React.ReactNode, color: string }> = {
  roads: { label: "Roads", icon: <Car size={16} />, color: "#60A5FA" },
  power: { label: "Power Grid", icon: <Zap size={16} />, color: "#F59E0B" },
  water: { label: "Water Supply", icon: <Droplets size={16} />, color: "#3B82F6" },
  healthcare: { label: "Healthcare", icon: <Hospital size={16} />, color: "#EC4899" }
};

const VIEWS = [
  { id: "Dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { id: "Predictions", label: "Predictions", icon: <TrendingUp size={16} /> },
  { id: "Cascade Sim", label: "Cascade Sim", icon: <Share2 size={16} /> },
  { id: "What-If Engine", label: "What-If Engine", icon: <Settings size={16} /> },
  { id: "Public Portal", label: "Public Portal", icon: <Globe size={16} /> },
  { id: "cityassist", label: "CityAssist AI", icon: "🤖" }
];

const REMEDIATIONS = {
  roads: ["Deploy dynamic lane management", "Activate public transit subsidies", "Reroute heavy freight traffic"],
  power: ["Engage peak-shaving battery reserves", "Initiate industrial load shedding", "Activate emergency gas turbines"],
  water: ["Reduce non-potable pressure", "Activate secondary reservoir pumps", "Issue mandatory conservation alert"],
  healthcare: ["Redirect non-critical triage", "Activate mobile clinic units", "Recall off-duty medical staff"]
};

const EVENT_LOADS = {
  none: { roads: 0, power: 0, water: 0, healthcare: 0 },
  concert: { roads: 22, power: 15, water: 8, healthcare: 5 },
  disaster: { roads: 35, power: 40, water: 30, healthcare: 45 },
  peakhour: { roads: 28, power: 12, water: 5, healthcare: 2 },
  construction: { roads: 18, power: 5, water: 10, healthcare: 0 }
};

const COLORS = {
  bg: "#06060F",
  sidebar: "#09091A",
  card: "#0C0C1E",
  border: "#14142A",
  text: "#D4D4E8",
  dim: "#5A5A7A",
  critical: "#EF4444",
  warning: "#F59E0B",
  normal: "#10B981",
  accent: "#60A5FA",
  purple: "#A78BFA"
};

// ════════════════════════════════════════
// 2. HELPER FUNCTIONS
// ════════════════════════════════════════

interface Zone {
  id: number;
  name: string;
  type: string;
  population: number;
  assets: Record<string, number>;
  baseAssets: Record<string, number>;
  drift: Record<string, number>;
}

interface HistoryData {
  [key: number]: {
    [key: string]: number[];
  };
}

interface CascadeState {
  triggerZone: number | null;
  triggerAsset: string | null;
  affectedZones: number[];
}

const clamp = (val: number, min = 0, max = 100) => Math.max(min, Math.min(max, val));

const mkZones = (): Zone[] => ZONE_NAMES.map((name, i) => {
  const type = ZONE_TYPES[i];
  const baseAssets = {
    roads: 40 + Math.random() * 10 + (i === 4 ? 15 : 0),
    power: 45 + Math.random() * 10 + (i === 4 ? 15 : 0),
    water: 42 + Math.random() * 10 + (i === 4 ? 10 : 0),
    healthcare: 40 + Math.random() * 10 + (i === 4 ? 12 : 0)
  };
  return {
    id: i,
    name,
    type,
    population: ZONE_POPS[i],
    baseAssets,
    assets: { ...baseAssets },
    drift: { roads: 0, power: 0, water: 0, healthcare: 0 }
  };
});

const avgUtil = (assets: Record<string, number>) => {
  const vals = Object.values(assets);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

const statusColor = (val: number) => {
  if (val >= 90) return COLORS.critical;
  if (val >= 75) return COLORS.warning;
  return COLORS.normal;
};

const statusLabel = (val: number) => {
  if (val >= 90) return "CRITICAL";
  if (val >= 75) return "WARNING";
  return "NORMAL";
};

const getDiurnalFactor = (hour: number, asset: string, type: string) => {
  // Simple 4-point interpolation for diurnal cycles
  // 0: Night (0-6), 1: Morning (6-12), 2: Afternoon (12-18), 3: Evening (18-24)
  const profile = ASSET_PROFILES[type as keyof typeof ASSET_PROFILES][asset as keyof (typeof ASSET_PROFILES)["Residential"]];
  const segment = Math.floor(hour / 6) % 4;
  const nextSegment = (segment + 1) % 4;
  const t = (hour % 6) / 6;
  
  const startVal = profile[segment];
  const endVal = profile[nextSegment];
  
  return startVal + (endVal - startVal) * t;
};

const cityHealth = (zones: Zone[]) => {
  const totalPop = zones.reduce((acc, z) => acc + z.population, 0);
  let weightedScore = 0;
  zones.forEach(z => {
    const util = avgUtil(z.assets);
    // More aggressive penalty for high utilization
    let score = 100;
    if (util > 60) score -= (util - 60) * 1.5;
    if (util > 80) score -= (util - 80) * 2.5;
    if (util > 95) score -= (util - 95) * 5;
    
    weightedScore += Math.max(0, score) * (z.population / totalPop);
  });
  return weightedScore;
};

const linReg = (data: number[]) => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const breachIn = (data: number[]) => {
  const { slope, intercept } = linReg(data);
  if (slope <= 0) return null;
  const current = data[data.length - 1];
  if (current >= 90) return 0;
  const ticks = (90 - intercept) / slope - (data.length - 1);
  return ticks > 0 && ticks < 100 ? Math.round(ticks * 2) : null;
};

const adjZones = (id) => {
  const r = Math.floor(id / 3);
  const c = id % 3;
  const adj = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        adj.push(nr * 3 + nc);
      }
    }
  }
  return adj;
};

// ════════════════════════════════════════
// 3. ROOT APP COMPONENT
// ════════════════════════════════════════

export default function App() {
  const [zones, setZones] = useState(mkZones());
  const [view, setView] = useState("Dashboard");
  const [tick, setTick] = useState(0);
  const [simTime, setSimTime] = useState(8); // Start at 8 AM
  const [simHour, setSimHour] = useState(8);
  const [history, setHistory] = useState<HistoryData>({});
  const [cascade, setCascade] = useState<CascadeState>({ triggerZone: null, triggerAsset: null, affectedZones: [] });

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSimTime(prev => {
        const next = (prev + 0.2) % 24;
        setSimHour(Math.floor(next));
        return next;
      });
      setZones(prev => prev.map((z) => {
        const newDrift = { ...z.drift };
        const newAssets = { ...z.assets };
        
        ASSETS.forEach(a => {
          // 1. Update Drift (Random walk)
          const driftDelta = (Math.random() - 0.5) * 0.8;
          newDrift[a] = clamp(newDrift[a] + driftDelta, -15, 15);
          
          // 2. Calculate Diurnal Factor
          const diurnal = getDiurnalFactor(simTime, a, z.type);
          
          // 3. Combine: Base * Diurnal + Drift + Noise
          const noise = (Math.random() - 0.5) * 2;
          newAssets[a] = clamp(z.baseAssets[a] * diurnal + newDrift[a] + noise);
        });
        
        return { ...z, drift: newDrift, assets: newAssets };
      }));
      setTick(t => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [simTime]);

  // History Recording
  useEffect(() => {
    setHistory(prev => {
      const next = { ...prev };
      zones.forEach(z => {
        if (!next[z.id]) next[z.id] = { roads: [], power: [], water: [], healthcare: [] };
        ASSETS.forEach(a => {
          const h = [...next[z.id][a], z.assets[a]];
          next[z.id][a] = h.slice(-30);
        });
      });
      return next;
    });
  }, [tick]);

  const triggerCascade = (zoneId, assetKey) => {
    setZones(prev => {
      const next = [...prev];
      // Trigger zone
      const z = { ...next[zoneId] };
      z.assets = { ...z.assets };
      z.assets[assetKey] = 100;
      
      // Internal dependencies
      if (assetKey === "power") {
        z.assets.water = clamp(z.assets.water + 16);
        z.assets.healthcare = clamp(z.assets.healthcare + 16);
      } else if (assetKey === "water") {
        z.assets.healthcare = clamp(z.assets.healthcare + 16);
      } else if (assetKey === "roads") {
        z.assets.healthcare = clamp(z.assets.healthcare + 16);
      }
      next[zoneId] = z;

      // Adjacency spread
      const adj = adjZones(zoneId);
      adj.forEach(aid => {
        const az = { ...next[aid] };
        az.assets = { ...az.assets };
        ASSETS.forEach(a => az.assets[a] = clamp(az.assets[a] + 6));
        next[aid] = az;
      });

      setCascade({ triggerZone: zoneId, triggerAsset: assetKey, affectedZones: adj });
      return next;
    });
  };

  const resetSim = () => {
    setZones(mkZones());
    setCascade({ triggerZone: null, triggerAsset: null, affectedZones: [] });
  };

  const health = useMemo(() => cityHealth(zones), [zones]);

  return (
    <div style={{
      backgroundColor: COLORS.bg,
      color: COLORS.text,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex",
      height: "100vh",
      overflow: "hidden"
    }}>
      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #06060F; }
        ::-webkit-scrollbar-thumb { background: #1A1A30; border-radius: 10px; }
        .view-container { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>

      {/* SIDEBAR */}
      <div style={{
        width: "210px",
        backgroundColor: COLORS.sidebar,
        borderRight: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0
      }}>
        <div style={{ padding: "0 24px", marginBottom: "40px" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "1px", color: COLORS.accent, marginBottom: "4px" }}>CITYWATCH</div>
          <div style={{ fontSize: "14px", fontWeight: "300", color: COLORS.dim }}>InfraMonitor v2.4</div>
          <div style={{ 
            marginTop: "16px", 
            padding: "8px 12px", 
            backgroundColor: "rgba(255,255,255,0.03)", 
            borderRadius: "6px", 
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <Activity size={12} color={COLORS.accent} />
            <span style={{ fontSize: "12px", fontWeight: "bold", color: COLORS.text }}>
              {Math.floor(simTime).toString().padStart(2, '0')}:{Math.floor((simTime % 1) * 60).toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: "10px", color: COLORS.dim }}>SIM TIME</span>
          </div>
        </div>

        <div style={{ padding: "0 24px", marginBottom: "32px" }}>
          <div style={{ fontSize: "10px", color: COLORS.dim, letterSpacing: "1.5px", marginBottom: "8px" }}>CITY HEALTH</div>
          <div style={{ fontSize: "32px", fontWeight: "bold", color: statusColor(health) }}>{Math.round(health)}<span style={{ fontSize: "14px", color: COLORS.dim }}>/100</span></div>
          <div style={{ width: "100%", height: "4px", backgroundColor: "#1A1A30", borderRadius: "2px", marginTop: "12px", overflow: "hidden" }}>
            <div style={{ width: `${health}%`, height: "100%", backgroundColor: statusColor(health), transition: "width 1s ease" }} />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {VIEWS.map(v => (
            <div
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                padding: "12px 24px",
                cursor: "pointer",
                fontSize: "13px",
                color: view === v.id ? COLORS.text : COLORS.dim,
                backgroundColor: view === v.id ? "rgba(96, 165, 250, 0.05)" : "transparent",
                borderLeft: `3px solid ${view === v.id ? COLORS.accent : "transparent"}`,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <span style={{ fontSize: "16px", display: "flex", alignItems: "center" }}>
                {v.icon}
              </span>
              {v.label}
            </div>
          ))}
        </div>

        <div style={{ padding: "0 24px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981", animation: "pulse 2s infinite" }} />
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px" }}>LIVE FEED</div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, overflowY: "auto", padding: "40px" }} className="view-container" key={view}>
        {view === "Dashboard" && <DashboardView zones={zones} health={health} />}
        {view === "Predictions" && <PredictionsView zones={zones} history={history} />}
        {view === "Cascade Sim" && <CascadeView zones={zones} trigger={triggerCascade} reset={resetSim} cascade={cascade} />}
        {view === "What-If Engine" && <WhatIfView zones={zones} />}
        {view === "Public Portal" && <PublicView zones={zones} health={health} />}
        {view === "cityassist" && <CityAssistView zones={zones} simHour={simHour} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// 4. DASHBOARD VIEW
// ════════════════════════════════════════

function DashboardView({ zones, health }: { zones: Zone[], health: number }) {
  const criticalCount = zones.reduce((acc, z) => acc + Object.values(z.assets).filter(v => (v as number) >= 90).length, 0);
  const warningCount = zones.reduce((acc, z) => acc + Object.values(z.assets).filter(v => (v as number) >= 75 && (v as number) < 90).length, 0);
  const riskPop = zones.reduce((acc, z) => {
    const avg = avgUtil(z.assets);
    return acc + (avg >= 75 ? z.population : 0);
  }, 0);

  const triage = useMemo(() => {
    const list = [];
    zones.forEach(z => {
      ASSETS.forEach(a => {
        if (z.assets[a] >= 75) {
          list.push({ zone: z.name, type: a, val: z.assets[a], pop: z.population, score: z.assets[a] * z.population });
        }
      });
    });
    return list.sort((a, b) => b.score - a.score);
  }, [zones]);

  return (
    <div>
      <SectionTitle>System Overview</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "40px" }}>
        <KPICard label="City Health" value={`${Math.round(health)}%`} color={statusColor(health)} icon={<Activity size={20} />} />
        <KPICard label="Critical Assets" value={criticalCount} color={criticalCount > 0 ? COLORS.critical : COLORS.dim} icon={<ShieldAlert size={20} />} />
        <KPICard label="Warning Assets" value={warningCount} color={warningCount > 0 ? COLORS.warning : COLORS.dim} icon={<AlertTriangle size={20} />} />
        <KPICard label="At-Risk Population" value={`${(riskPop / 1000).toFixed(1)}k`} color={riskPop > 0 ? COLORS.critical : COLORS.dim} icon={<Users size={20} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "32px", marginBottom: "40px" }}>
        <div>
          <SectionTitle>Zone Heatmap</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {zones.map(z => {
              const avg = avgUtil(z.assets);
              const color = statusColor(avg);
              return (
                <div key={z.id} style={{
                  backgroundColor: COLORS.card,
                  border: `1px solid ${color}33`,
                  padding: "16px",
                  borderRadius: "8px",
                  transition: "all 0.5s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", color: COLORS.dim }}>{z.name}</div>
                    <div style={{ 
                      fontSize: "8px", 
                      padding: "2px 4px", 
                      backgroundColor: "rgba(255,255,255,0.05)", 
                      borderRadius: "3px", 
                      color: COLORS.dim,
                      border: `1px solid ${COLORS.border}`
                    }}>{z.type.toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color }}>{Math.round(avg)}%</div>
                  <div style={{ fontSize: "10px", color: COLORS.dim, marginTop: "4px" }}>{(z.population / 1000).toFixed(1)}k residents</div>
                  <div style={{ width: "100%", height: "3px", backgroundColor: "#1A1A30", marginTop: "12px", borderRadius: "2px" }}>
                    <div style={{ width: `${avg}%`, height: "100%", backgroundColor: color, transition: "width 0.8s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle>Priority Triage</SectionTitle>
          <div style={{ backgroundColor: COLORS.card, borderRadius: "12px", padding: "20px", border: `1px solid ${COLORS.border}`, maxHeight: "360px", overflowY: "auto" }}>
            {triage.length === 0 ? (
              <div style={{ color: COLORS.dim, textAlign: "center", padding: "40px" }}>All systems nominal.</div>
            ) : (
              triage.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: i === triage.length - 1 ? "none" : `1px solid ${COLORS.border}` }}>
                  <div style={{ color: ASSET_META[item.type].color }}>{ASSET_META[item.type].icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: "bold" }}>{item.zone} · {ASSET_META[item.type].label}</div>
                    <div style={{ fontSize: "11px", color: COLORS.dim }}>{REMEDIATIONS[item.type][0]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: statusColor(item.val) }}>{Math.round(item.val)}%</div>
                    <div style={{ fontSize: "9px", color: statusColor(item.val), fontWeight: "bold" }}>{statusLabel(item.val)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SectionTitle>Full Asset Breakdown</SectionTitle>
      <div style={{ backgroundColor: COLORS.card, borderRadius: "12px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
              <th style={{ padding: "16px", color: COLORS.dim, fontWeight: "normal" }}>ZONE</th>
              {ASSETS.map(a => <th key={a} style={{ padding: "16px", color: COLORS.dim, fontWeight: "normal" }}>{ASSET_META[a].label.toUpperCase()}</th>)}
              <th style={{ padding: "16px", color: COLORS.dim, fontWeight: "normal" }}>AVG</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(z => {
              const avg = avgUtil(z.assets);
              return (
                <tr key={z.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontWeight: "bold" }}>{z.name}</div>
                    <div style={{ fontSize: "10px", color: COLORS.dim }}>{z.type}</div>
                  </td>
                  {ASSETS.map(a => (
                    <td key={a} style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: `${statusColor(z.assets[a])}22`,
                        color: statusColor(z.assets[a]),
                        fontSize: "11px",
                        fontWeight: "bold"
                      }}>{Math.round(z.assets[a])}%</span>
                    </td>
                  ))}
                  <td style={{ padding: "16px", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <span style={{ fontWeight: "bold", color: statusColor(avg) }}>{Math.round(avg)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// 5. PREDICTIONS VIEW
// ════════════════════════════════════════

function PredictionsView({ zones, history }: { zones: Zone[], history: HistoryData }) {
  const [selZone, setSelZone] = useState(0);
  const zone = zones[selZone];
  const zHistory = history[selZone] || {};

  return (
    <div>
      <SectionTitle>Breach Forecasting</SectionTitle>
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px", flexWrap: "wrap" }}>
        {zones.map(z => (
          <div
            key={z.id}
            onClick={() => setSelZone(z.id)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              backgroundColor: selZone === z.id ? COLORS.accent : COLORS.card,
              color: selZone === z.id ? COLORS.bg : COLORS.text,
              cursor: "pointer",
              fontSize: "12px",
              border: `1px solid ${selZone === z.id ? COLORS.accent : COLORS.border}`,
              transition: "all 0.2s"
            }}
          >
            {z.name} <span style={{ opacity: 0.7, marginLeft: "4px" }}>{Math.round(avgUtil(z.assets))}%</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "40px" }}>
        {ASSETS.map(a => {
          const data = zHistory[a] || [];
          const { slope, intercept } = linReg(data);
          const breach = breachIn(data);
          
          const chartData: { tick: number; val?: number; projection?: number }[] = data.map((v, i) => ({ tick: i, val: v }));
          const lastTick = data.length - 1;
          for (let i = 1; i <= 12; i++) {
            chartData.push({ tick: lastTick + i, projection: clamp(intercept + slope * (lastTick + i)) });
          }

          return (
            <div key={a} style={{ backgroundColor: COLORS.card, borderRadius: "12px", padding: "24px", border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    {ASSET_META[a].icon} {ASSET_META[a].label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: statusColor(zone.assets[a]) }}>{Math.round(zone.assets[a])}%</div>
                </div>
                {breach !== null ? (
                  <div style={{ backgroundColor: `${COLORS.critical}22`, color: COLORS.critical, padding: "4px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>BREACH IN ~{breach}s</div>
                ) : (
                  <div style={{ backgroundColor: `${COLORS.normal}22`, color: COLORS.normal, padding: "4px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>STABLE</div>
                )}
              </div>

              <div style={{ height: "180px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A1A30" vertical={false} />
                    <XAxis dataKey="tick" hide />
                    <YAxis domain={[30, 105]} hide />
                    <ReferenceLine y={90} stroke={COLORS.critical} strokeDasharray="3 3" />
                    <ReferenceLine y={75} stroke={COLORS.warning} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="val" stroke={ASSET_META[a].color} strokeWidth={3} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="projection" stroke={ASSET_META[a].color} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: "10px", color: COLORS.dim, textAlign: "center", marginTop: "12px" }}>Solid = live · Dashed = projected (12 ticks)</div>
            </div>
          );
        })}
      </div>

      <SectionTitle>All-Zone Breach Forecast</SectionTitle>
      <div style={{ backgroundColor: COLORS.card, borderRadius: "12px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
              <th style={{ padding: "12px 16px", color: COLORS.dim }}>ZONE</th>
              {ASSETS.map(a => <th key={a} style={{ padding: "12px 16px", color: COLORS.dim }}>{ASSET_META[a].label.toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {zones.map(z => (
              <tr key={z.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: "bold" }}>{z.name}</div>
                  <div style={{ fontSize: "10px", color: COLORS.dim }}>{z.type}</div>
                </td>
                {ASSETS.map(a => {
                  const b = breachIn(history[z.id]?.[a] || []);
                  return (
                    <td key={a} style={{ padding: "12px 16px" }}>
                      {b !== null ? (
                        <span style={{ color: COLORS.critical, fontWeight: "bold" }}>~{b}s</span>
                      ) : (
                        <span style={{ color: COLORS.dim }}>stable</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// 6. CASCADE VIEW
// ════════════════════════════════════════

function CascadeView({ zones, trigger, reset, cascade }: { 
  zones: Zone[], 
  trigger: (zoneId: number, assetKey: string) => void, 
  reset: () => void, 
  cascade: CascadeState 
}) {
  const [selZone, setSelZone] = useState(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
      <div>
        <SectionTitle>Cascade Failure Simulator</SectionTitle>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "12px" }}>STEP 1: SELECT TARGET ZONE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {zones.map(z => {
              const isTrigger = cascade.triggerZone === z.id;
              const isAffected = cascade.affectedZones.includes(z.id);
              return (
                <div
                  key={z.id}
                  onClick={() => setSelZone(z.id)}
                  style={{
                    padding: "12px",
                    backgroundColor: selZone === z.id ? "rgba(96, 165, 250, 0.1)" : COLORS.card,
                    border: `1px solid ${isTrigger ? COLORS.critical : isAffected ? COLORS.warning : selZone === z.id ? COLORS.accent : COLORS.border}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "center",
                    position: "relative"
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: "bold" }}>{z.name}</div>
                  {isTrigger && <div style={{ fontSize: "8px", color: COLORS.critical, marginTop: "4px" }}>TRIGGER</div>}
                  {isAffected && <div style={{ fontSize: "8px", color: COLORS.warning, marginTop: "4px" }}>AFFECTED</div>}
                </div>
              );
            })}
          </div>
        </div>

        {selZone !== null && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ fontSize: "12px", color: COLORS.dim, marginBottom: "12px" }}>STEP 2: INITIATE FAILURE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
              {ASSETS.map(a => (
                <button
                  key={a}
                  onClick={() => trigger(selZone, a)}
                  style={{
                    padding: "16px",
                    backgroundColor: COLORS.card,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "8px",
                    color: COLORS.text,
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ fontSize: "10px", color: COLORS.dim }}>FAIL {ASSET_META[a].label.toUpperCase()}</div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "4px" }}>{Math.round(zones[selZone].assets[a])}% → 100%</div>
                </button>
              ))}
            </div>
            <button onClick={reset} style={{ width: "100%", padding: "12px", backgroundColor: "transparent", border: `1px solid ${COLORS.dim}`, color: COLORS.dim, borderRadius: "8px", cursor: "pointer", fontSize: "12px" }}>RESET SIMULATION</button>
          </div>
        )}

        {cascade.triggerZone !== null && (
          <div style={{ marginTop: "32px", padding: "20px", backgroundColor: `${COLORS.critical}11`, border: `1px solid ${COLORS.critical}33`, borderRadius: "12px" }}>
            <div style={{ color: COLORS.critical, fontWeight: "bold", fontSize: "14px", marginBottom: "8px" }}>CASCADE ALERT</div>
            <div style={{ fontSize: "13px", color: COLORS.text, lineHeight: "1.5" }}>
              Failure of <b>{ASSET_META[cascade.triggerAsset].label}</b> in <b>{zones[cascade.triggerZone].name}</b> has stressed {cascade.affectedZones.length} adjacent zones. 
              {cascade.triggerAsset === "power" && " Power outage has critically impacted Water and Healthcare systems locally."}
            </div>
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Dependency Graph</SectionTitle>
        <div style={{ backgroundColor: COLORS.card, borderRadius: "12px", border: `1px solid ${COLORS.border}`, padding: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="0 0 360 320" style={{ width: "100%", maxWidth: "360px" }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.dim} />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.critical} />
              </marker>
            </defs>

            {/* Edges */}
            <DependencyLine x1={90} y1={90} x2={260} y2={90} active={cascade.triggerAsset === 'power'} /> {/* Power -> Water */}
            <DependencyLine x1={90} y1={90} x2={260} y2={230} active={cascade.triggerAsset === 'power'} /> {/* Power -> Healthcare */}
            <DependencyLine x1={260} y1={90} x2={260} y2={230} active={cascade.triggerAsset === 'water'} /> {/* Water -> Healthcare */}
            <DependencyLine x1={90} y1={230} x2={260} y2={230} active={cascade.triggerAsset === 'roads'} /> {/* Roads -> Healthcare */}

            {/* Nodes */}
            <DependencyNode x={90} y={90} label="Power" icon="⚡" status={cascade.triggerAsset === 'power' ? 'failed' : cascade.triggerAsset ? 'stressed' : 'ok'} />
            <DependencyNode x={260} y={90} label="Water" icon="💧" status={cascade.triggerAsset === 'water' ? 'failed' : cascade.triggerAsset === 'power' ? 'stressed' : 'ok'} />
            <DependencyNode x={90} y={230} label="Roads" icon="🚗" status={cascade.triggerAsset === 'roads' ? 'failed' : 'ok'} />
            <DependencyNode x={260} y={230} label="Health" icon="🏥" status={cascade.triggerAsset === 'healthcare' ? 'failed' : cascade.triggerAsset ? 'stressed' : 'ok'} />
          </svg>

          <div style={{ marginTop: "24px", width: "100%" }}>
            <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "12px", letterSpacing: "1px" }}>REMEDIATION PROTOCOL</div>
            {cascade.triggerAsset ? (
              <div style={{ fontSize: "12px", color: COLORS.text }}>
                {REMEDIATIONS[cascade.triggerAsset].map((r, i) => (
                  <div key={i} style={{ marginBottom: "8px", display: "flex", gap: "8px" }}>
                    <span style={{ color: COLORS.critical }}>•</span> {r}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: COLORS.dim, fontStyle: "italic" }}>Select a failure scenario to view protocols.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DependencyNode({ x, y, label, icon, status }: { x: number, y: number, label: string, icon: string, status: 'failed' | 'stressed' | 'ok' }) {
  const isFailed = status === 'failed';
  const isStressed = status === 'stressed';
  return (
    <g>
      {isFailed && (
        <circle cx={x} cy={y} r={38} fill="none" stroke={COLORS.critical} strokeWidth="1" strokeDasharray="4 4">
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="10s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r={32} fill={COLORS.card} stroke={isFailed ? COLORS.critical : isStressed ? COLORS.warning : COLORS.border} strokeWidth="2" />
      <text x={x} y={y - 2} textAnchor="middle" fontSize="16" dy=".3em">{icon}</text>
      <text x={x} y={y + 45} textAnchor="middle" fontSize="10" fill={isFailed ? COLORS.critical : COLORS.text} fontWeight="bold">{label.toUpperCase()}</text>
      {isFailed && <text x={x} y={y + 58} textAnchor="middle" fontSize="8" fill={COLORS.critical} fontWeight="bold">⚡ FAILED</text>}
      {isStressed && <text x={x} y={y + 58} textAnchor="middle" fontSize="8" fill={COLORS.warning} fontWeight="bold">⚠ STRESSED</text>}
    </g>
  );
}

function DependencyLine({ x1, y1, x2, y2, active }: { x1: number, y1: number, x2: number, y2: number, active: boolean }) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? COLORS.critical : "#1A1A30"} strokeWidth={active ? 2 : 1} markerEnd={active ? "url(#arrow-red)" : "url(#arrow)"} />
  );
}

// ════════════════════════════════════════
// 7. WHAT-IF VIEW
// ════════════════════════════════════════

function WhatIfView({ zones }: { zones: Zone[] }) {
  const [selZone, setSelZone] = useState(4);
  const [addPop, setAddPop] = useState(0);
  const [event, setEvent] = useState("none");

  const zone = zones[selZone];
  
  const projections = useMemo(() => {
    const results = {};
    ASSETS.forEach(a => {
      const popLoad = (addPop / zone.population) * 32;
      const eventLoad = EVENT_LOADS[event][a];
      results[a] = {
        before: zone.assets[a],
        after: clamp(zone.assets[a] + popLoad + eventLoad),
        delta: popLoad + eventLoad
      };
    });
    return results;
  }, [zone, addPop, event]);

  const firstFailure = useMemo(() => {
    const failures = ASSETS.filter(a => projections[a].after >= 90);
    if (failures.length === 0) return null;
    return failures.sort((a, b) => projections[b].after - projections[a].after)[0];
  }, [projections]);

  return (
    <div style={{ display: "flex", gap: "40px" }}>
      <div style={{ width: "300px", flexShrink: 0 }}>
        <SectionTitle>Simulation Controls</SectionTitle>
        
        <ControlBox title="TARGET ZONE">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {zones.map(z => (
              <div
                key={z.id}
                onClick={() => setSelZone(z.id)}
                style={{
                  padding: "8px",
                  backgroundColor: selZone === z.id ? COLORS.accent : COLORS.card,
                  color: selZone === z.id ? COLORS.bg : COLORS.text,
                  border: `1px solid ${selZone === z.id ? COLORS.accent : COLORS.border}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "10px",
                  textAlign: "center"
                }}
              >
                {z.name.split(' ').map(s => s[0]).join('')}
              </div>
            ))}
          </div>
        </ControlBox>

        <ControlBox title="ADD POPULATION">
          <input
            type="range"
            min="0"
            max="60000"
            step="1000"
            value={addPop}
            onChange={(e) => setAddPop(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: COLORS.accent }}
          />
          <div style={{ fontSize: "14px", fontWeight: "bold", marginTop: "8px", color: COLORS.accent }}>+{(addPop / 1000).toFixed(0)}k residents</div>
        </ControlBox>

        <ControlBox title="SIMULATE EVENT">
          {Object.keys(EVENT_LOADS).map(e => (
            <div
              key={e}
              onClick={() => setEvent(e)}
              style={{
                padding: "10px 12px",
                marginBottom: "6px",
                backgroundColor: event === e ? "rgba(96, 165, 250, 0.1)" : "transparent",
                border: `1px solid ${event === e ? COLORS.accent : COLORS.border}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{e}</span>
              <span>{e === 'concert' ? '🎵' : e === 'disaster' ? '🌪️' : e === 'peakhour' ? '🚗' : e === 'construction' ? '🏗️' : ''}</span>
            </div>
          ))}
        </ControlBox>
      </div>

      <div style={{ flex: 1 }}>
        <SectionTitle>Projected Impact: {zone.name}</SectionTitle>
        
        {firstFailure && (
          <div style={{ padding: "20px", backgroundColor: `${COLORS.critical}22`, border: `1px solid ${COLORS.critical}44`, borderRadius: "12px", marginBottom: "32px", animation: "fadeIn 0.4s ease-out" }}>
            <div style={{ color: COLORS.critical, fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>CRITICAL FAILURE PREDICTED</div>
            <div style={{ fontSize: "13px" }}><b>{ASSET_META[firstFailure].label}</b> will breach capacity thresholds. Recommendation: {REMEDIATIONS[firstFailure][0]}.</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {ASSETS.map(a => {
            const p = projections[a];
            return (
              <div key={a} style={{ backgroundColor: COLORS.card, borderRadius: "12px", padding: "24px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: COLORS.dim, display: "flex", alignItems: "center", gap: "6px" }}>
                    {ASSET_META[a].icon} {ASSET_META[a].label.toUpperCase()}
                  </div>
                  {p.delta > 0 && <div style={{ color: COLORS.critical, fontSize: "11px", fontWeight: "bold" }}>+{Math.round(p.delta)}% LOAD</div>}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ fontSize: "14px", color: COLORS.dim }}>{Math.round(p.before)}%</div>
                  <div style={{ fontSize: "20px", color: COLORS.dim }}>→</div>
                  <div style={{ fontSize: "32px", fontWeight: "bold", color: statusColor(p.after) }}>{Math.round(p.after)}%</div>
                </div>
                
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "9px", color: COLORS.dim, marginBottom: "4px" }}>CURRENT</div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#1A1A30", borderRadius: "3px" }}>
                    <div style={{ width: `${p.before}%`, height: "100%", backgroundColor: COLORS.dim, borderRadius: "3px" }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: COLORS.dim, marginBottom: "4px" }}>PROJECTED</div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#1A1A30", borderRadius: "3px" }}>
                    <div style={{ width: `${p.after}%`, height: "100%", backgroundColor: statusColor(p.after), borderRadius: "3px", transition: "width 0.8s ease" }} />
                  </div>
                </div>

                {p.after >= 90 && (
                  <div style={{ marginTop: "20px", fontSize: "11px", color: COLORS.critical, borderTop: `1px solid ${COLORS.border}`, paddingTop: "12px" }}>
                    <b>PROTOCOL:</b> {REMEDIATIONS[a][1]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// 8. PUBLIC PORTAL VIEW
// ════════════════════════════════════════

function PublicView({ zones, health }: { zones: Zone[], health: number }) {
  const status = health > 85 ? "Good" : health > 70 ? "Under Pressure" : "Critical Alert";
  const message = health > 85 
    ? "City infrastructure is operating within normal parameters. No major disruptions reported."
    : health > 70 
    ? "High demand detected across central zones. Minor delays in public transit and healthcare triage."
    : "CRITICAL: Infrastructure systems are at capacity. Emergency protocols active. Avoid non-essential travel.";

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: "12px", letterSpacing: "3px", color: COLORS.dim, marginBottom: "24px" }}>CITY INFRASTRUCTURE · PUBLIC PORTAL</div>
      
      <div style={{ marginBottom: "60px" }}>
        <div style={{ 
          fontSize: "120px", 
          fontWeight: "900", 
          color: statusColor(health), 
          lineHeight: 1,
          textShadow: `0 0 40px ${statusColor(health)}33`
        }}>{Math.round(health)}</div>
        <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "16px", color: statusColor(health) }}>{status}</div>
        <div style={{ fontSize: "16px", color: COLORS.dim, marginTop: "16px", lineHeight: "1.6", maxWidth: "500px", margin: "16px auto 0" }}>{message}</div>
        <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "32px" }}>🟢 Live · Updates every 2 seconds</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "60px" }}>
        {zones.map(z => {
          const avg = avgUtil(z.assets);
          return (
            <div key={z.id} style={{ backgroundColor: COLORS.card, padding: "20px", borderRadius: "16px", border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor(avg) }} />
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>{z.name}</div>
              </div>
              <div style={{ fontSize: "9px", color: COLORS.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{z.type}</div>
              <div style={{ fontSize: "11px", color: COLORS.dim }}>{Math.round(avg)}% utilised</div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "left", backgroundColor: COLORS.card, padding: "32px", borderRadius: "24px", border: `1px solid ${COLORS.border}`, marginBottom: "40px" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "20px" }}>What does this mean?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <PublicLegendItem color={COLORS.normal} label="Normal" desc="Systems are stable. All services available." />
          <PublicLegendItem color={COLORS.warning} label="Warning" desc="High demand. Expect minor service delays." />
          <PublicLegendItem color={COLORS.critical} label="Critical" desc="System overload. Emergency measures in effect." />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <ContactCard label="City Helpline" phone="311-CITY-INFO" icon={<Info size={14} />} />
        <ContactCard label="Power Emergency" phone="800-GRID-FAIL" icon={<Zap size={14} />} />
        <ContactCard label="Water Authority" phone="888-H2O-FLOW" icon={<Droplets size={14} />} />
        <ContactCard label="Traffic Control" phone="511-ROAD-STAT" icon={<Car size={14} />} />
      </div>
    </div>
  );
}

function PublicLegendItem({ color, label, desc }: { color: string, label: string, desc: string }) {
  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: color }} />
      <div>
        <span style={{ fontWeight: "bold", color, marginRight: "8px" }}>{label}:</span>
        <span style={{ color: COLORS.dim, fontSize: "13px" }}>{desc}</span>
      </div>
    </div>
  );
}

function ContactCard({ label, phone, icon }: { label: string, phone: string, icon: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: COLORS.card, padding: "16px", borderRadius: "12px", border: `1px solid ${COLORS.border}`, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "4px" }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: "14px", fontWeight: "bold", color: COLORS.accent }}>{phone}</div>
      </div>
      <div style={{ color: COLORS.dim }}>{icon}</div>
    </div>
  );
}

// ════════════════════════════════════════
// 9. SHARED COMPONENTS
// ════════════════════════════════════════

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
      <div style={{ width: "14px", height: "1px", backgroundColor: COLORS.dim }} />
      <div style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "2.5px", color: COLORS.dim, textTransform: "uppercase" }}>{children}</div>
    </div>
  );
}

function KPICard({ label, value, color, icon }: { label: string, value: string | number, color: string, icon: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: COLORS.card, padding: "24px", borderRadius: "12px", border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: "11px", color: COLORS.dim, marginBottom: "8px", letterSpacing: "1px" }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: "32px", fontWeight: "bold", color }}>{value}</div>
      </div>
      <div style={{ color: `${color}66` }}>{icon}</div>
    </div>
  );
}

// ════════════════════════════════════════
// 10. CITYASSIST AI HELPDESK
// ════════════════════════════════════════

async function callGemini(apiKey: string, systemPrompt: string, chatHistory: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: chatHistory.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text 
    || "Sorry, I couldn't get a response. Please try again.";
}

function buildCityContext(zones: Zone[], simHour: number) {
  const ASSET_LABELS: Record<string, string> = {
    roads: "Roads", power: "Power Grid",
    water: "Water Supply", healthcare: "Healthcare"
  };
  const statusOf = (u: number) => u >= 90 ? "CRITICAL" : u >= 75 ? "WARNING" : "NORMAL";
  const getAvgUtil = (z: Zone) => {
    const vals = Object.values(z.assets);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  let ctx = `Simulated time: ${String(simHour).padStart(2,"0")}:00\n\nLIVE CITY STATUS:\n`;
  zones.forEach(z => {
    const avg = getAvgUtil(z);
    ctx += `\n${z.name} (Pop: ${Math.round(z.population/1000)}k) — ${statusOf(avg)} (${Math.round(avg)}% avg)\n`;
    Object.entries(z.assets).forEach(([k, val]) => {
      ctx += `  ${ASSET_LABELS[k]}: ${Math.round(val)}% — ${statusOf(val)}\n`;
    });
  });
  return ctx;
}

function CityAssistView({ zones, simHour }: { zones: Zone[], simHour: number }) {
  const [messages, setMessages] = React.useState<any[]>([
    { 
      role: "assistant", 
      content: "👋 Hi! I'm CityAssist — your AI helpdesk for city infrastructure. I have live access to all 9 zone statuses right now. Ask me anything — power cuts, water issues, road problems, or just 'is my area safe?' — I'll give you a real answer.", 
      time: new Date() 
    }
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [showKeyInput, setShowKeyInput] = React.useState(true);
  
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const systemPrompt = useMemo(() => `You are CityAssist, an AI citizen helpdesk for a smart city infrastructure platform.

YOUR ROLE: Help ordinary citizens understand infrastructure issues in their city 
and tell them exactly what to do. You are NOT talking to engineers or officials.

LIVE DATA YOU HAVE RIGHT NOW:
${buildCityContext(zones, simHour)}

STATUS THRESHOLDS:
- NORMAL (0-74%): All good, no action needed
- WARNING (75-89%): Elevated stress, be cautious
- CRITICAL (90%+): Serious issue, take immediate action

EMERGENCY CONTACTS:
- City Helpline: 1800-CITY-HELP
- Power Emergency: 1800-PWR-ALERT  
- Water Authority: 1800-WATER-911
- Traffic Control: 1800-TRAF-CTRL
- Medical Emergency: 102

WHEN A CITIZEN REPORTS A PROBLEM:
1. Show empathy first (1 sentence)
2. Tell them the ACTUAL current status from the live data above
3. Give exactly 2-3 practical steps they can do RIGHT NOW
4. Give the relevant emergency contact number
5. Total response: max 5 sentences

WHEN ASKED ABOUT A ZONE STATUS:
- Give a plain-English summary using the live data
- Highlight any WARNING or CRITICAL services  
- Suggest what citizens should do or avoid

TONE RULES — STRICTLY FOLLOW:
✓ Simple everyday language, no technical terms
✓ Calm and reassuring, never alarmist
✓ Use relevant emojis to feel warm and approachable
✓ Be concise — citizens want quick answers
✗ NEVER say "utilization percentage" or any engineering term
✗ NEVER mention that the data is simulated
✗ NEVER give medical diagnosis
✗ NEVER mention "linear regression" or "mean reversion"`, [zones, simHour]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key above to use CityAssist.");
      return;
    }
    setError(null);
    setInput("");
    const userMsg = { role: "user", content: trimmed, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg];
      const reply = await callGemini(apiKey, systemPrompt, history);
      setMessages(prev => [...prev, { role: "assistant", content: reply, time: new Date() }]);
    } catch (e: any) {
      setError(e.message);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Connection issue. Please check your API key or call 1800-CITY-HELP directly.",
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickReplies = [
    "Is my area safe right now?",
    "No water supply — what do I do?",
    "Power outage — need help",
    "Which zones are critical?",
    "Road blocked near me",
    "Give me emergency numbers",
    "What to do during power cut?",
    "How bad is City Core right now?"
  ];

  const criticalZonesCount = zones.filter(z => avgUtil(z.assets) >= 90).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", animation: "fadeIn 0.5s ease-out" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🤖</span>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>CityAssist</h2>
          </div>
          <div style={{ fontSize: "12px", color: COLORS.dim, marginTop: "4px" }}>Powered by Gemini 2.0 Flash · Citizen AI Helpdesk</div>
        </div>
        {criticalZonesCount > 0 && (
          <div style={{ backgroundColor: `${COLORS.critical}22`, color: COLORS.critical, padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={14} /> {criticalZonesCount} ZONE{criticalZonesCount > 1 ? 'S' : ''} UNDER CRITICAL STRESS
          </div>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, gap: "24px", overflow: "hidden" }}>
        {/* LEFT SIDEBAR */}
        <div style={{ width: "240px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", paddingRight: "8px" }}>
          <div style={{ fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", fontWeight: "bold" }}>LIVE ZONE STATUS</div>
          {zones.map(z => {
            const avg = avgUtil(z.assets);
            const color = statusColor(avg);
            return (
              <div 
                key={z.id} 
                onClick={() => setInput(`What is the status of ${z.name}?`)}
                style={{ 
                  backgroundColor: COLORS.card, 
                  padding: "12px", 
                  borderRadius: "8px", 
                  border: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold" }}>{z.name}</div>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color }} />
                </div>
                <div style={{ fontSize: "10px", color: COLORS.dim }}>{Math.round(avg)}% avg utilization</div>
              </div>
            );
          })}

          <div style={{ marginTop: "10px", fontSize: "10px", color: COLORS.dim, letterSpacing: "1px", fontWeight: "bold" }}>EMERGENCY CONTACTS</div>
          <div style={{ backgroundColor: COLORS.card, padding: "12px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "11px" }}>
            <div style={{ marginBottom: "8px" }}><span style={{ color: COLORS.accent }}>Helpline:</span> 1800-CITY-HELP</div>
            <div style={{ marginBottom: "8px" }}><span style={{ color: COLORS.accent }}>Power:</span> 1800-PWR-ALERT</div>
            <div style={{ marginBottom: "8px" }}><span style={{ color: COLORS.accent }}>Water:</span> 1800-WATER-911</div>
            <div><span style={{ color: COLORS.accent }}>Medical:</span> 102</div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: COLORS.card, borderRadius: "16px", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          {/* MESSAGES */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "assistant" ? "flex-start" : "flex-end" }}>
                <div style={{ display: "flex", gap: "12px", maxWidth: "80%", flexDirection: m.role === "assistant" ? "row" : "row-reverse" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: COLORS.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                    {m.role === "assistant" ? "🏙️" : "👤"}
                  </div>
                  <div style={{ 
                    padding: "12px 16px", 
                    borderRadius: "16px", 
                    backgroundColor: m.role === "assistant" ? COLORS.sidebar : "rgba(96, 165, 250, 0.1)",
                    border: `1px solid ${m.role === "assistant" ? COLORS.border : "rgba(96, 165, 250, 0.2)"}`,
                    color: COLORS.text,
                    fontSize: "14px",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap"
                  }}>
                    {m.content.split(/(\*\*.*?\*\*)/).map((part, idx) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={idx}>{part.slice(2, -2)}</strong>;
                      }
                      return part;
                    })}
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: COLORS.dim, marginTop: "4px", marginLeft: m.role === "assistant" ? "44px" : "0", marginRight: m.role === "assistant" ? "0" : "44px" }}>
                  {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: COLORS.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🏙️</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: "6px", height: "6px", backgroundColor: COLORS.dim, borderRadius: "50%", animation: "pulse 1.5s infinite", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* QUICK REPLIES */}
          <div style={{ padding: "12px 24px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>
            {quickReplies.map((r, i) => (
              <button 
                key={i} 
                onClick={() => handleSend(r)}
                style={{ 
                  padding: "6px 12px", 
                  borderRadius: "20px", 
                  backgroundColor: "transparent", 
                  border: `1px solid ${COLORS.border}`, 
                  color: COLORS.dim, 
                  fontSize: "11px", 
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.text; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.dim; }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* INPUT AREA */}
          <div style={{ padding: "24px", borderTop: `1px solid ${COLORS.border}` }}>
            {showKeyInput && (
              <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center" }}>
                <input 
                  type="password" 
                  placeholder="Enter Gemini API Key..." 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ 
                    flex: 1, 
                    backgroundColor: COLORS.sidebar, 
                    border: `1px solid ${COLORS.border}`, 
                    borderRadius: "6px", 
                    padding: "8px 12px", 
                    color: COLORS.text, 
                    fontSize: "12px" 
                  }}
                />
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: COLORS.accent, textDecoration: "none" }}>Get API Key →</a>
                <button onClick={() => setShowKeyInput(false)} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer", fontSize: "11px" }}>Hide</button>
              </div>
            )}
            
            {error && <div style={{ color: COLORS.critical, fontSize: "12px", marginBottom: "12px", padding: "8px", backgroundColor: `${COLORS.critical}11`, borderRadius: "4px", border: `1px solid ${COLORS.critical}33` }}>{error}</div>}

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <textarea 
                ref={textareaRef}
                rows={1}
                placeholder="Ask CityAssist about infrastructure..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
                style={{ 
                  flex: 1, 
                  backgroundColor: COLORS.sidebar, 
                  border: `1px solid ${COLORS.border}`, 
                  borderRadius: "8px", 
                  padding: "12px", 
                  color: COLORS.text, 
                  fontSize: "14px",
                  resize: "none",
                  maxHeight: "120px"
                }}
              />
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                style={{ 
                  width: "44px", 
                  height: "44px", 
                  borderRadius: "8px", 
                  backgroundColor: COLORS.accent, 
                  border: "none", 
                  color: COLORS.bg, 
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: loading || !input.trim() ? 0.5 : 1
                }}
              >
                <TrendingUp size={20} style={{ transform: "rotate(90deg)" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBox({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "24px", padding: "20px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "12px", border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: "10px", color: COLORS.dim, marginBottom: "16px", letterSpacing: "1px" }}>{title}</div>
      {children}
    </div>
  );
}
