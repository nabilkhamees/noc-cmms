import React, { useState, useMemo, useRef, useEffect, useContext, createContext } from "react";
import {
  LayoutGrid, Server, Building2, ClipboardList, Users, ChevronRight, ChevronDown,
  Plus, Upload, FileText, X, Search, ShieldCheck, Wrench, Gauge, MapPin,
  Cpu, Boxes, CalendarClock, LogOut, CheckCircle2, AlertTriangle, Grid3x3,
  Trash2, Save, Layers, Zap, Calendar, ChevronLeft, Menu, Loader2, MoreVertical
} from "lucide-react";
import { fetchAll, dbAddSite, dbUpdateSite, dbDeleteSite, dbAddRoom, dbDeleteRoom, dbAddFloor, dbDeleteFloor, dbAddEquipment,
  dbUpdateEquipment, dbDeleteEquipment, dbAddWorkOrder, dbUpdateWorkOrder, dbAddUser, dbUpdateUser, dbDeleteUser,
  dbAddEquipmentType, dbSetUserSites, notifyAssignment, uploadReportFile } from "./db";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Responsive: single breakpoint, shared via context to avoid drilling */
/* ------------------------------------------------------------------ */
const MobileCtx = createContext(false);
function useIsMobile() { return useContext(MobileCtx); }
function useWindowIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false));
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/*  bg: pure white workspace / ink: near-black slate for text          */
/*  accent: signal-teal (network/status) + amber (alerts) + violet(PM) */
/* ------------------------------------------------------------------ */
const T = {
  ink: "#0F172A",
  sub: "#5B6472",
  line: "#E7EAEE",
  panel: "#F7F8FA",
  teal: "#0E9C8F",
  tealDeep: "#0B6F66",
  amber: "#D97706",
  violet: "#6D5DD3",
  red: "#DC4C4C",
  bg: "#FFFFFF",
};

const mono = { fontFamily: "'JetBrains Mono','SFMono-Regular',Consolas,monospace" };

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */
const ROLES = ["Admin", "Manager", "Technician"];
const BUILTIN_EQUIPMENT_TYPES = ["Generator", "UPS", "Cooling", "Rack PDU", "Switch", "Panel Board", "Rectifier", "Equipment"];

// Which sites a given user should see: Admins always see everything;
// everyone else sees only their assigned sites — but if they haven't
// been assigned to any yet, fall back to showing all (so a freshly
// added teammate isn't stuck looking at a blank screen).
function visibleSitesFor(user, sites) {
  if (!user || user.role === "Admin") return sites;
  if (user.siteIds && user.siteIds.length > 0) return sites.filter((s) => user.siteIds.includes(s.id));
  return sites;
}

function initialsOf(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

/* ------------------------------------------------------------------ */
/*  Small UI atoms                                                     */
/* ------------------------------------------------------------------ */
function Badge({ tone = "teal", children }) {
  const map = {
    teal: { bg: "#E4F5F3", fg: T.tealDeep },
    amber: { bg: "#FDF1DF", fg: "#93590B" },
    red: { bg: "#FBE7E7", fg: "#A8322F" },
    violet: { bg: "#EFECFB", fg: "#4C3EA6" },
    gray: { bg: T.panel, fg: T.sub },
  };
  const c = map[tone];
  return (
    <span style={{
      background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 700,
      padding: "3px 9px", borderRadius: 20, letterSpacing: 0.3,
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone = "teal" }) {
  const colors = { teal: T.teal, amber: T.amber, violet: T.violet, red: T.red };
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px",
      background: T.bg, display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.sub, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
        <Icon size={15} color={colors[tone]} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.sub }}>{sub}</div>}
    </div>
  );
}

function PermGate({ allow, role, children, fallback = null }) {
  return allow.includes(role) ? children : fallback;
}

/* ------------------------------------------------------------------ */
/*  Login / role select                                                */
/* ------------------------------------------------------------------ */
function Login({ onSignIn, error, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isMobile = useWindowIsMobile();

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    onSignIn(email.trim(), password);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "Inter,system-ui,sans-serif", padding: 16,
    }}>
      <form onSubmit={submit} style={{ width: isMobile ? "100%" : 380, maxWidth: 380, border: `1px solid ${T.line}`, borderRadius: 18, padding: isMobile ? 22 : 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Server size={17} color="#fff" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: T.ink }}>NOC/CMMS</div>
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>Datacenter maintenance & asset control</div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Email</div>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com" style={{ ...selStyle, width: "100%" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Password</div>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" style={{ ...selStyle, width: "100%" }} />
        </div>

        {error && (
          <div style={{ background: "#FBE7E7", color: "#A8322F", fontSize: 12.5, borderRadius: 9, padding: "9px 11px", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", background: T.ink, color: "#fff", border: "none", borderRadius: 10,
          padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
        }}>{loading ? "Signing in…" : "Sign in"}</button>

        <div style={{ marginTop: 14, fontSize: 11.5, color: T.sub, lineHeight: 1.5 }}>
          Don't have an account yet? Ask an Admin to create your login and link it to a profile in Users & Roles.
        </div>
      </form>
    </div>
  );
}

function NoProfileScreen({ email, onLogout }) {
  const isMobile = useWindowIsMobile();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,system-ui,sans-serif", padding: 16 }}>
      <div style={{ width: isMobile ? "100%" : 420, maxWidth: 420, textAlign: "center" }}>
        <AlertTriangle size={26} color={T.amber} style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 800, color: T.ink, marginBottom: 6, fontSize: 16 }}>You're signed in, but no profile is linked</div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16 }}>
          Signed in as <strong style={{ color: T.ink }}>{email}</strong>, but no user profile in Users & Roles has this
          email attached yet. Ask an Admin to add or edit a profile with this exact email address.
        </div>
        <button onClick={onLogout} style={smallBtn}>Sign out</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */
function Sidebar({ page, setPage, user, onLogout, mobileOpen, onCloseMobile, collapsed, onToggleCollapse }) {
  const isMobile = useIsMobile();
  const items = [
    { id: "dashboard", label: "Sites Dashboard", icon: LayoutGrid, allow: ROLES },
    { id: "calendar", label: "Maintenance Calendar", icon: Calendar, allow: ROLES },
    { id: "assets", label: "Assets", icon: Layers, allow: ROLES },
    { id: "workorders", label: "Work Orders", icon: ClipboardList, allow: ROLES },
    { id: "analytics", label: "Analytics", icon: Gauge, allow: ["Admin", "Manager"] },
    { id: "roomdesigner", label: "Room Designer", icon: Grid3x3, allow: ["Admin", "Manager"] },
    { id: "users", label: "Users & Roles", icon: Users, allow: ["Admin"] },
  ];
  const mini = !isMobile && collapsed;

  const panel = (
    <div style={{
      width: isMobile ? 250 : (mini ? 64 : 232), background: T.bg, borderRight: `1px solid ${T.line}`,
      minHeight: "100vh", height: isMobile ? "100vh" : undefined,
      display: "flex", flexDirection: "column", padding: mini ? "18px 8px" : "18px 12px", flexShrink: 0,
      position: isMobile ? "fixed" : "static", top: 0, left: 0, zIndex: 70,
      transform: isMobile ? `translateX(${mobileOpen ? "0" : "-100%"})` : "none",
      transition: "transform 0.2s ease, width 0.15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: mini ? "center" : "space-between", padding: mini ? 0 : "0 8px", marginBottom: 22 }}>
        {!mini && (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Server size={15} color="#fff" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink }}>NOC/CMMS</div>
          </div>
        )}
        {isMobile ? (
          <button onClick={onCloseMobile} style={iconBtn}><X size={16} /></button>
        ) : (
          <button onClick={onToggleCollapse} title={mini ? "Expand menu" : "Minimize menu"} style={iconBtn}>
            {mini ? <MoreVertical size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <PermGate key={it.id} allow={it.allow} role={user.role}>
            <button onClick={() => { setPage(it.id); if (isMobile) onCloseMobile(); }} title={mini ? it.label : undefined} style={{
              display: "flex", alignItems: "center", gap: 10, padding: mini ? "10px 0" : "10px 10px", borderRadius: 9,
              border: "none", background: page === it.id ? T.panel : "transparent",
              color: page === it.id ? T.ink : T.sub, fontWeight: page === it.id ? 700 : 600,
              fontSize: 13.6, cursor: "pointer", textAlign: "left", justifyContent: mini ? "center" : "flex-start",
            }}>
              <it.icon size={16} />{!mini && it.label}
            </button>
          </PermGate>
        ))}
      </div>
      <div style={{ marginTop: "auto", borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: mini ? "6px 0" : "6px 8px", justifyContent: mini ? "center" : "flex-start" }}>
          <div title={mini ? `${user.name} · ${user.role}` : undefined} style={{ width: 28, height: 28, borderRadius: "50%", background: T.teal, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{user.initials}</div>
          {!mini && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: T.sub }}>{user.role}</div>
            </div>
          )}
          <button onClick={onLogout} title="Log off" style={{ border: "none", background: "transparent", cursor: "pointer", color: T.sub }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  if (!isMobile) return panel;

  return (
    <>
      {mobileOpen && <div onClick={onCloseMobile} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 65 }} />}
      {panel}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sites Dashboard                                                     */
/* ------------------------------------------------------------------ */
function SitesDashboard({ sites, workOrders, setPage, setActiveSite, role, onAddSite, onUpdateSite, onDeleteSite }) {
  const isMobile = useIsMobile();
  const totalCap = sites.reduce((a, s) => a + s.cap, 0);
  const totalLoad = sites.reduce((a, s) => a + s.load, 0);
  const openWO = workOrders.filter((w) => w.status !== "Closed").length;
  const lateWO = workOrders.filter((w) => w.status === "Late").length;
  const canEdit = role === "Admin" || role === "Manager";

  const blank = { name: "", loc: "", cap: 500, load: 0, itLoad: 0, rackCount: 10 };
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [adding, setAdding] = useState(false);

  const startEdit = (s) => { setEditingId(s.id); setDraft({ name: s.name, loc: s.loc, cap: s.cap, load: s.load, itLoad: s.itLoad, rackCount: s.racks.length }); setAdding(false); };
  const startAdd = () => { setAdding(true); setEditingId(null); setDraft(blank); };
  const cancel = () => { setEditingId(null); setAdding(false); };
  const saveEdit = () => { onUpdateSite(editingId, draft); setEditingId(null); };
  const saveAdd = () => { if (!draft.name.trim()) return; onAddSite(draft); setAdding(false); setDraft(blank); };

  return (
    <div>
      <PageHeader title="Sites Dashboard" sub="All datacenter facilities, side by side"
        right={canEdit && <button onClick={startAdd} style={smallBtn}><Plus size={12} style={{ marginRight: 4 }} />Add site</button>} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 26 }}>
        <StatCard label="Facilities" value={sites.length} icon={Building2} tone="teal" />
        <StatCard label="Fleet load" value={`${totalLoad}kW`} sub={`of ${totalCap}kW capacity`} icon={Zap} tone="violet" />
        <StatCard label="Open work orders" value={openWO} icon={ClipboardList} tone="amber" />
        <StatCard label="Overdue" value={lateWO} icon={AlertTriangle} tone="red" />
      </div>

      {adding && (
        <SiteForm draft={draft} setDraft={setDraft} onSave={saveAdd} onCancel={cancel} title="New site" />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        {sites.map((s) => {
          if (editingId === s.id) {
            return <SiteForm key={s.id} draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={cancel} title="Edit site" />;
          }
          const pct = Math.round((s.load / s.cap) * 100);
          const tone = pct > 85 ? T.red : pct > 60 ? T.amber : T.teal;
          const siteWO = workOrders.filter((w) => w.siteId === s.id && w.status !== "Closed");
          return (
            <div key={s.id} onClick={() => { setActiveSite(s.id); setPage("assets"); }} style={{
              border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 14, background: T.bg, position: "relative",
            }}>
              {canEdit && (
                <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 4 }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} style={iconBtn} title="Edit site"><FileText size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (sites.length > 1) onDeleteSite(s.id); }} style={iconBtn} title="Delete site"><Trash2 size={13} color={T.red} /></button>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.ink }}>{s.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.sub, marginTop: 2 }}>
                    <MapPin size={12} />{s.loc}
                  </div>
                </div>
                <Badge tone={pct > 85 ? "red" : pct > 60 ? "amber" : "teal"}>{pct}% load</Badge>
              </div>

              <div style={{ height: 7, borderRadius: 5, background: T.panel, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: tone, borderRadius: 5 }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                <MiniStat icon={Zap} label="Capacity" value={`${s.cap}kW`} />
                <MiniStat icon={Boxes} label="Racks" value={s.racks.length} />
                <MiniStat icon={Cpu} label="Load" value={`${s.load}kW`} />
                <MiniStat icon={Server} label="IT load" value={`${s.itLoad}kW`} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.line}`, paddingTop: 10 }}>
                <span style={{ fontSize: 12, color: T.sub }}>{s.equipment.length} equipment · {s.rooms.length} rooms</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: siteWO.length ? T.amber : T.teal }}>{siteWO.length} open WO</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SiteForm({ draft, setDraft, onSave, onCancel, title }) {
  const f = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <div style={{ border: `1.5px solid ${T.ink}`, borderRadius: 16, padding: 18, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FieldRow label="Name" value={draft.name} onChange={(v) => f("name", v)} />
        <FieldRow label="Location" value={draft.loc} onChange={(v) => f("loc", v)} />
        <FieldRow label="Total capacity (kW)" value={draft.cap} onChange={(v) => f("cap", Number(v) || 0)} />
        <FieldRow label="Current load (kW)" value={draft.load} onChange={(v) => f("load", Number(v) || 0)} />
        <FieldRow label="Current IT load (kW)" value={draft.itLoad} onChange={(v) => f("itLoad", Number(v) || 0)} />
        <FieldRow label="Number of racks" value={draft.rackCount} onChange={(v) => f("rackCount", Number(v) || 0)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={smallBtn}><Save size={12} style={{ marginRight: 4 }} />Save</button>
        <button onClick={onCancel} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Cancel</button>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div style={{ background: T.panel, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.sub, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
        <Icon size={11} />{label}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginTop: 2, ...mono }}>{value}</div>
    </div>
  );
}

function PageHeader({ title, sub, right }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-end",
      marginBottom: 18, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0, flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 800, color: T.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: isMobile ? "100%" : "auto" }}>{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Asset Hierarchy (the "serial code graph")                          */
/* ------------------------------------------------------------------ */
function AssetTree({ sites, activeSite, setActiveSite, onOpenEquipment, role, onAddEquipment, onDeleteEquipment, onAddRoom, onDeleteRoom, onAddFloor, onDeleteFloor, equipmentTypes, onAddEquipmentType }) {
  const [open, setOpen] = useState({});
  const [view, setView] = useState("list"); // "list" | "tree"
  const [q, setQ] = useState("");
  const [step, setStep] = useState(null); // null | "room" | "equipment"
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const site = sites.find((s) => s.id === activeSite) || sites[0];
  const canEdit = role === "Admin" || role === "Manager";
  const isMobile = useIsMobile();
  const floors = site.floors || [];

  const statusColor = (st) => (st === "Online" ? T.teal : st === "Offline" ? T.red : T.amber);
  const blankEq = { name: "", type: "Equipment", roomId: site.rooms[0]?.id, status: "Online", installYear: new Date().getFullYear() };
  const [draft, setDraft] = useState(blankEq);
  const [roomName, setRoomName] = useState("");
  const [floorId, setFloorId] = useState(""); // "" = no floor, "__new__" = adding one
  const [newFloorName, setNewFloorName] = useState("");

  const startAdd = () => { setStep("room"); setRoomName(""); setFloorId(""); setNewFloorName(""); setDraft({ ...blankEq, roomId: site.rooms[0]?.id }); };
  const cancelAdd = () => setStep(null);
  const createRoomAndContinue = () => {
    let roomId = site.rooms[0]?.id;
    let resolvedFloorId = floorId && floorId !== "__new__" ? floorId : null;
    if (floorId === "__new__" && newFloorName.trim()) {
      resolvedFloorId = site.id + "-fl-" + Date.now();
      onAddFloor(site.id, { id: resolvedFloorId, name: newFloorName.trim() });
    }
    if (roomName.trim()) {
      roomId = site.id + "-r" + (site.rooms.length + 1) + "-" + Date.now();
      onAddRoom(site.id, { id: roomId, name: roomName.trim(), grid: { w: 8, h: 5 }, floorId: resolvedFloorId });
    }
    setDraft((d) => ({ ...d, roomId }));
    setStep("equipment");
  };
  const skipToEquipment = () => setStep("equipment");
  const saveEquipment = () => {
    if (!draft.name.trim()) return;
    onAddEquipment(site.id, draft);
    setStep(null);
  };

  const matchesQuery = (e) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (e.name + " " + e.code + " " + e.type + " " + (e.serial || "") + " " + (e.barcode || "")).toLowerCase().includes(needle);
  };
  const visibleList = site.equipment.filter(matchesQuery);
  const crossSiteMatches = q.trim() ? sites.flatMap((s) => s.equipment.filter(matchesQuery).map((e) => ({ ...e, siteId: s.id, siteName: s.name }))) : [];
  const crossSiteHits = crossSiteMatches.filter((e) => e.siteId !== site.id);

  // Group the list by classification (type), ordered to match the
  // equipmentTypes list (so it stays consistent with the Add-asset
  // dropdown order), with any leftover/unrecognized types appended last.
  const groupedByType = (() => {
    const byType = {};
    visibleList.forEach((e) => { const t = e.type || "Uncategorized"; (byType[t] = byType[t] || []).push(e); });
    const orderedKeys = [...(equipmentTypes || []), ...Object.keys(byType).filter((k) => !(equipmentTypes || []).includes(k))];
    return orderedKeys.filter((k) => byType[k]?.length).map((k) => [k, byType[k]]);
  })();
  return (
    <div>
      <PageHeader
        title="Assets"
        sub="Every equipment code traces Site → Room → Rack → Unit"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <div style={{ position: "relative", flex: isMobile ? "1 1 100%" : "none" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: T.sub }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code, or serial number…" style={{ ...selStyle, paddingLeft: 30, width: isMobile ? "100%" : 240 }} />
            </div>
            <select value={site.id} onChange={(e) => setActiveSite(e.target.value)} style={selStyle}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: "flex", border: `1px solid ${T.line}`, borderRadius: 9, overflow: "hidden" }}>
              <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 5, border: "none", padding: "7px 12px", background: view === "list" ? T.ink : "#fff", color: view === "list" ? "#fff" : T.sub, cursor: "pointer", fontSize: 12, fontWeight: 700 }}><ClipboardList size={13} />List</button>
              <button onClick={() => setView("tree")} style={{ display: "flex", alignItems: "center", gap: 5, border: "none", padding: "7px 12px", background: view === "tree" ? T.ink : "#fff", color: view === "tree" ? "#fff" : T.sub, cursor: "pointer", fontSize: 12, fontWeight: 700 }}><Layers size={13} />Rooms</button>
            </div>
            {canEdit && <button onClick={startAdd} style={smallBtn}><Plus size={12} style={{ marginRight: 4 }} />Add asset</button>}
          </div>
        }
      />

      {step && (
        <div style={{ border: `1.5px solid ${T.ink}`, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StepDot n={1} active={step === "room"} done={step === "equipment"} label="Add room" />
            <div style={{ width: 24, height: 1, background: T.line }} />
            <StepDot n={2} active={step === "equipment"} done={false} label="Add equipment" />
          </div>

          {step === "room" ? (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>Step 1 — Add a room in {site.name}</div>

              {(floors.length > 0 || floorId === "__new__") && (
                <div>
                  <div style={labelStyle}>Which floor? (only matters if this site has more than one)</div>
                  {floorId === "__new__" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input autoFocus value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)}
                        placeholder="e.g. Ground Floor" style={{ ...selStyle, width: "100%" }} />
                      <button type="button" onClick={() => setFloorId("")} style={iconBtn} title="Cancel new floor"><X size={14} /></button>
                    </div>
                  ) : (
                    <select value={floorId} onChange={(e) => setFloorId(e.target.value)} style={{ ...selStyle, width: "100%" }}>
                      <option value="">— No floor (single-floor site) —</option>
                      {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      <option value="__new__">+ Add a new floor…</option>
                    </select>
                  )}
                </div>
              )}
              {floors.length === 0 && floorId !== "__new__" && (
                <button type="button" onClick={() => setFloorId("__new__")} style={{ ...smallBtn, background: T.panel, color: T.ink, alignSelf: "flex-start" }}>
                  <Plus size={12} style={{ marginRight: 4 }} />This site has more than one floor
                </button>
              )}

              <FieldRow label="Room name (e.g. Cold Aisle B)" value={roomName} onChange={setRoomName} />
              <div style={{ fontSize: 11.5, color: T.sub }}>Leave blank to skip and place the equipment in an existing room instead.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={createRoomAndContinue} style={smallBtn}>Next: Add equipment<ChevronRight size={12} style={{ marginLeft: 4 }} /></button>
                {site.rooms.length > 0 && <button onClick={skipToEquipment} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Skip — use existing room</button>}
                <button onClick={cancelAdd} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>Step 2 — Add the equipment</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                <FieldRow label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
                <div>
                  <div style={labelStyle}>Type</div>
                  {addingType ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input autoFocus value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newTypeName.trim()) { onAddEquipmentType(newTypeName.trim()); setDraft((d) => ({ ...d, type: newTypeName.trim() })); }
                            setAddingType(false); setNewTypeName("");
                          }
                          if (e.key === "Escape") { setAddingType(false); setNewTypeName(""); }
                        }}
                        placeholder="e.g. Battery Bank" style={{ ...selStyle, width: "100%" }} />
                      <button type="button" onClick={() => {
                        if (newTypeName.trim()) { onAddEquipmentType(newTypeName.trim()); setDraft((d) => ({ ...d, type: newTypeName.trim() })); }
                        setAddingType(false); setNewTypeName("");
                      }} style={iconBtn} title="Save classification"><Save size={14} /></button>
                      <button type="button" onClick={() => { setAddingType(false); setNewTypeName(""); }} style={iconBtn} title="Cancel"><X size={14} /></button>
                    </div>
                  ) : (
                    <select value={draft.type} onChange={(e) => {
                      if (e.target.value === "__custom__") { setAddingType(true); return; }
                      setDraft((d) => ({ ...d, type: e.target.value }));
                    }} style={{ ...selStyle, width: "100%" }}>
                      {equipmentTypes.map((t) => <option key={t}>{t}</option>)}
                      <option value="__custom__">+ Add custom classification…</option>
                    </select>
                  )}
                </div>
                <div>
                  <div style={labelStyle}>Room</div>
                  <select value={draft.roomId} onChange={(e) => setDraft((d) => ({ ...d, roomId: e.target.value }))} style={{ ...selStyle, width: "100%" }}>
                    {site.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>Status</div>
                  <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} style={{ ...selStyle, width: "100%" }}>
                    {["Online", "Offline"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep("room")} style={{ ...smallBtn, background: T.panel, color: T.ink }}><ChevronLeft size={12} style={{ marginRight: 4 }} />Back</button>
                <button onClick={saveEquipment} style={smallBtn}><Save size={12} style={{ marginRight: 4 }} />Save equipment</button>
                <button onClick={cancelAdd} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {crossSiteHits.length > 0 && (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: T.panel }}>
          <Search size={13} color={T.sub} />
          <span style={{ fontSize: 12, color: T.sub }}>Also found in other sites:</span>
          {crossSiteHits.map((e) => (
            <button key={e.id} onClick={() => { setActiveSite(e.siteId); onOpenEquipment(e.id); }} style={{
              border: `1px solid ${T.line}`, borderRadius: 20, padding: "4px 10px", background: "#fff",
              fontSize: 11.5, fontWeight: 700, color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              {e.name} <span style={{ color: T.sub, fontWeight: 600 }}>· {e.siteName}</span>
            </button>
          ))}
        </div>
      )}


      {view === "list" ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {groupedByType.map(([typeName, items]) => (
              <div key={typeName}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: 0.4 }}>{typeName}</span>
                  <span style={{ fontSize: 11, color: T.sub, background: T.panel, borderRadius: 10, padding: "1px 8px", fontWeight: 700 }}>{items.length}</span>
                  <div style={{ flex: 1, height: 1, background: T.line }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {items.map((e) => {
                    const room = site.rooms.find((r) => r.id === e.roomId);
                    return (
                      <div key={e.id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <button onClick={() => onOpenEquipment(e.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{e.name}</div>
                            <div style={{ fontSize: 11, color: T.sub, ...mono, marginTop: 2 }}>{e.code}{e.serial ? ` · S/N ${e.serial}` : ""}</div>
                          </button>
                          {canEdit && <button onClick={() => onDeleteEquipment(site.id, e.id)} style={iconBtn} title="Delete"><Trash2 size={13} color={T.red} /></button>}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.ink }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(e.status) }} />{e.status}
                          </span>
                          <span style={{ fontSize: 11.5, color: T.sub, ...mono }}>{e.installYear}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.sub }}>{site.name} · {room?.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {visibleList.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 13 }}>No assets match.</div>}
          </div>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {groupedByType.map(([typeName, items]) => (
            <div key={typeName}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: 0.4 }}>{typeName}</span>
                <span style={{ fontSize: 11, color: T.sub, background: T.panel, borderRadius: 10, padding: "1px 8px", fontWeight: 700 }}>{items.length}</span>
                <div style={{ flex: 1, height: 1, background: T.line }} />
              </div>
              <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ ...assetRowGrid, background: T.panel, fontWeight: 800, fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  <div>Code</div><div>Description</div><div>Type</div><div>Location</div><div>Status</div><div>Install year</div><div></div>
                </div>
                {items.map((e) => {
                  const room = site.rooms.find((r) => r.id === e.roomId);
                  return (
                    <div key={e.id} style={assetRowGrid}>
                      <button onClick={() => onOpenEquipment(e.id)} style={{ ...mono, fontSize: 12, color: T.teal, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>{e.code}</button>
                      <button onClick={() => onOpenEquipment(e.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{e.name}</div>
                        {e.serial && <div style={{ fontSize: 10.5, color: T.sub, ...mono }}>S/N {e.serial}</div>}
                      </button>
                      <div><Badge tone={e.type === "Generator" ? "amber" : e.type === "Cooling" ? "violet" : "teal"}>{e.type}</Badge></div>
                      <div style={{ fontSize: 12, color: T.sub }}>{site.name} · {room?.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(e.status) }} />
                        <span style={{ fontSize: 12, color: T.ink }}>{e.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.ink, ...mono }}>{e.installYear}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        {canEdit && <button onClick={() => onDeleteEquipment(site.id, e.id)} style={iconBtn} title="Delete"><Trash2 size={13} color={T.red} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {visibleList.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 13 }}>No assets match.</div>}
        </div>
        )
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 16, padding: "20px 22px" }}>
          {/* Site node */}
          <TreeNode depth={0} icon={Building2} label={site.name} code={site.id.toUpperCase()} onClick={() => toggle("site")} openState={open.site !== false} last />
          {(open.site !== false) && (() => {
            const renderRoom = (room, depth) => {
              const roomEqAll = site.equipment.filter((e) => e.roomId === room.id);
              const roomEq = q.trim() ? roomEqAll.filter(matchesQuery) : roomEqAll;
              if (q.trim() && roomEq.length === 0) return null;
              const roomRacks = site.racks.filter((r) => r.roomId === room.id);
              const rk = "room-" + room.id;
              const isOpen = q.trim() ? true : open[rk];
              return (
                <div key={room.id} style={{ marginLeft: 22, borderLeft: `2px solid ${T.line}`, paddingLeft: 18 }}>
                  <TreeNode depth={depth} icon={LayoutGrid} label={room.name} code={room.id.toUpperCase()} onClick={() => toggle(rk)} openState={isOpen} sub={`${roomRacks.length} racks · ${roomEqAll.length} units`}
                    trailing={canEdit && <button onClick={() => onDeleteRoom(site.id, room.id)} style={iconBtn} title="Delete room"><Trash2 size={13} color={T.red} /></button>} />
                  {isOpen && (
                    <div style={{ marginLeft: 22, borderLeft: `2px solid ${T.line}`, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 8px 18px" }}>
                      {roomEq.length === 0 && <div style={{ fontSize: 12, color: T.sub, fontStyle: "italic" }}>No equipment placed yet</div>}
                      {roomEq.map((e) => (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 560 }}>
                          <button onClick={() => onOpenEquipment(e.id)} style={{
                            display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                            border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px",
                            background: "#fff", cursor: "pointer", width: "100%",
                          }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(e.status) }} />
                            <Cpu size={14} color={T.sub} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{e.name}</div>
                              <div style={{ fontSize: 11, color: T.sub, ...mono }}>{e.code}{e.serial ? ` · S/N ${e.serial}` : ""}</div>
                            </div>
                            <Badge tone={e.type === "Generator" ? "amber" : e.type === "Cooling" ? "violet" : "teal"}>{e.type}</Badge>
                          </button>
                          {canEdit && <button onClick={() => onDeleteEquipment(site.id, e.id)} style={iconBtn} title="Delete"><Trash2 size={13} color={T.red} /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            };

            if (floors.length === 0) {
              // No floors defined for this site — flat Site → Room → Equipment, unchanged.
              return site.rooms.map((room) => renderRoom(room, 1));
            }

            // Floors exist — group rooms under their floor; rooms with no
            // floor assigned still show directly under the site.
            const unassignedRooms = site.rooms.filter((r) => !r.floorId);
            return (
              <>
                {floors.map((floor) => {
                  const floorRooms = site.rooms.filter((r) => r.floorId === floor.id);
                  const fk = "floor-" + floor.id;
                  const isOpen = q.trim() ? true : open[fk] !== false;
                  return (
                    <div key={floor.id} style={{ marginLeft: 22, borderLeft: `2px solid ${T.line}`, paddingLeft: 18 }}>
                      <TreeNode depth={1} icon={Building2} label={floor.name} code={floor.id.toUpperCase()} onClick={() => toggle(fk)} openState={isOpen} sub={`${floorRooms.length} rooms`}
                        trailing={canEdit && <button onClick={() => onDeleteFloor(site.id, floor.id)} style={iconBtn} title="Delete floor"><Trash2 size={13} color={T.red} /></button>} />
                      {isOpen && floorRooms.map((room) => renderRoom(room, 2))}
                      {isOpen && floorRooms.length === 0 && <div style={{ marginLeft: 22, padding: "6px 0", fontSize: 12, color: T.sub, fontStyle: "italic" }}>No rooms on this floor yet</div>}
                    </div>
                  );
                })}
                {unassignedRooms.length > 0 && unassignedRooms.map((room) => renderRoom(room, 1))}
              </>
            );
          })()}
          {q.trim() && visibleList.length === 0 && (
            <div style={{ marginLeft: 22, padding: "12px 0", fontSize: 12.5, color: T.sub, fontStyle: "italic" }}>No assets in {site.name} match "{q}".</div>
          )}
        </div>
      )}
    </div>
  );
}
const assetRowGrid = { display: "grid", gridTemplateColumns: "150px 2fr 120px 1.4fr 100px 100px 40px", gap: 10, alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${T.line}` };

function StepDot({ n, active, done, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10.5, fontWeight: 800, background: active || done ? T.ink : T.panel, color: active || done ? "#fff" : T.sub,
        border: `1px solid ${active || done ? T.ink : T.line}`,
      }}>{done ? <CheckCircle2 size={12} /> : n}</div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? T.ink : T.sub }}>{label}</span>
    </div>
  );
}

function TreeNode({ depth, icon: Icon, label, code, sub, onClick, openState, last, trailing }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={onClick} style={{
        display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent",
        cursor: "pointer", padding: "8px 4px", flex: 1, minWidth: 0, textAlign: "left",
      }}>
        {openState ? <ChevronDown size={14} color={T.sub} /> : <ChevronRight size={14} color={T.sub} />}
        <Icon size={depth === 0 ? 17 : 15} color={depth === 0 ? T.ink : T.teal} />
        <span style={{ fontWeight: depth === 0 ? 800 : 700, fontSize: depth === 0 ? 15.5 : 13.5, color: T.ink }}>{label}</span>
        <span style={{ fontSize: 11, color: T.sub, ...mono }}>{code}</span>
        {sub && <span style={{ fontSize: 11.5, color: T.sub, marginLeft: "auto" }}>{sub}</span>}
      </button>
      {trailing}
    </div>
  );
}

const selStyle = { border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, color: T.ink, background: "#fff" };

/* ------------------------------------------------------------------ */
/*  Equipment detail modal                                             */
/* ------------------------------------------------------------------ */
function monthsLeft(installedDate, lifetimeMonths) {
  const d = new Date(installedDate);
  d.setMonth(d.getMonth() + lifetimeMonths);
  const diff = (d - new Date()) / (1000 * 60 * 60 * 24 * 30);
  return Math.round(diff);
}

const EQ_TABS = ["General", "Parts/BOM", "Personnel", "Custom", "Warranties", "Purchasing", "Files", "Log"];

function EquipmentModal({ equipment, users, onClose, onUploadReport, onSaveGeneral, onNewWorkOrder, role }) {
  const fileRef = useRef();
  const [tab, setTab] = useState("General");
  const [draft, setDraft] = useState(null);
  const isMobile = useIsMobile();
  React.useEffect(() => { setDraft(equipment ? { ...equipment } : null); setTab("General"); }, [equipment?.id]);
  if (!equipment || !draft) return null;
  const canEdit = role === "Admin" || role === "Manager";
  const field = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div style={isMobile ? mobileOverlayStyle() : overlayStyle} onClick={onClose}>
      <div style={isMobile ? mobileModalStyle({ ...modalStyle, padding: 0 }) : { ...modalStyle, maxWidth: 860, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* top bar, like the Fiix "Equipment:" header */}
        <div style={{ padding: "18px 26px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Equipment: <span style={{ color: T.ink }}>{equipment.name} ({equipment.code})</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && <button onClick={onNewWorkOrder} style={{ ...smallBtn, background: T.panel, color: T.ink }}><Plus size={12} style={{ marginRight: 4 }} />New work order</button>}
            {canEdit && <button onClick={() => onSaveGeneral(equipment.id, draft)} style={smallBtn}><Save size={12} style={{ marginRight: 4 }} />Save</button>}
            <button onClick={onClose} style={iconBtn}><X size={18} /></button>
          </div>
        </div>

        <div style={{ padding: isMobile ? "16px 16px 0" : "22px 26px 0" }}>
          <div style={{ display: "flex", gap: isMobile ? 12 : 20, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <div style={{ width: isMobile ? 64 : 96, height: isMobile ? 64 : 96, borderRadius: 12, background: T.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: `1px solid ${T.line}` }}>
              <Cpu size={isMobile ? 20 : 28} color={T.teal} />
              <Badge tone={equipment.status === "Online" ? "teal" : "red"}>{equipment.status}</Badge>
            </div>
            <div style={{ flex: 1, minWidth: isMobile ? 160 : "auto" }}>
              <input disabled={!canEdit} value={draft.name} onChange={(e) => field("name", e.target.value)}
                style={{ fontSize: isMobile ? 16 : 19, fontWeight: 800, color: T.ink, border: "none", outline: "none", width: "100%", padding: "2px 0", background: "transparent" }} />
              <div style={{ fontSize: 12, color: T.sub, ...mono, marginTop: 2 }}>{equipment.code}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Badge tone="gray">{equipment.type}</Badge>
                <Badge tone="violet">Installed {equipment.installYear}</Badge>
              </div>
            </div>
            {!isMobile && <div style={{ width: 68, height: 68, border: `1px solid ${T.line}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-conic-gradient(#0F172A 0% 25%, #fff 0% 50%) 0/8px 8px" }} title="QR code" />}
          </div>

          {/* tab bar */}
          <div style={{ display: "flex", gap: 2, marginTop: 20, borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
            {EQ_TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                border: "none", background: "transparent", padding: "9px 14px", fontSize: 12.5,
                fontWeight: 700, color: tab === t ? T.ink : T.sub, cursor: "pointer",
                borderBottom: tab === t ? `2px solid ${T.teal}` : "2px solid transparent", whiteSpace: "nowrap",
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: isMobile ? "14px 16px 100px" : "18px 26px 26px", maxHeight: isMobile ? "none" : "56vh", overflowY: "auto" }}>
          {tab === "General" && (
            <>
              <SectionLabel icon={MapPin}>Location of asset</SectionLabel>
              <FieldRow label="Located at" value={draft.location} onChange={(v) => field("location", v)} disabled={!canEdit} />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 4 }}>
                <FieldRow label="Code" value={equipment.code} disabled mono />
                <FieldRow label="Category" value={draft.category} onChange={(v) => field("category", v)} disabled={!canEdit} />
              </div>

              <SectionLabel icon={FileText}>General information</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <FieldRow label="Account" value={draft.account} onChange={(v) => field("account", v)} disabled={!canEdit} />
                <FieldRow label="Charge department" value={draft.chargeDept} onChange={(v) => field("chargeDept", v)} disabled={!canEdit} />
                <FieldRow label="Make" value={draft.make} onChange={(v) => field("make", v)} disabled={!canEdit} />
                <FieldRow label="Model" value={draft.model} onChange={(v) => field("model", v)} disabled={!canEdit} />
                <FieldRow label="Serial number" value={draft.serial} onChange={(v) => field("serial", v)} disabled={!canEdit} mono />
                <FieldRow label="Barcode" value={draft.barcode} onChange={(v) => field("barcode", v)} disabled={!canEdit} mono />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={labelStyle}>Notes</div>
                <textarea disabled={!canEdit} value={draft.notes} onChange={(e) => field("notes", e.target.value)} rows={3}
                  style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: T.ink, resize: "vertical", fontFamily: "inherit" }} />
              </div>
            </>
          )}

          {tab === "Parts/BOM" && (
            <>
              <SectionLabel icon={Boxes}>Parts & lifetime</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {equipment.parts.map((p) => {
                  const left = monthsLeft(p.installedDate, p.lifetimeMonths);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: T.sub }}>Installed {p.installedDate} · life {p.lifetimeMonths}mo</div>
                      </div>
                      <Badge tone={left < 2 ? "red" : left < 6 ? "amber" : "teal"}>{left <= 0 ? "Replace now" : `${left}mo left`}</Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "Personnel" && (
            <>
              <SectionLabel icon={CalendarClock}>Preventive maintenance & MOP</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {equipment.pm.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px" }}>
                    <CalendarClock size={14} color={T.sub} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{p.type} — {p.date}</div>
                      <div style={{ fontSize: 11.5, color: T.sub }}>MOP: {p.mop} · responsible: {users.find((u) => u.id === p.assignedTo)?.name}</div>
                    </div>
                    <Badge tone={p.status === "Late" ? "red" : "amber"}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          {(tab === "Warranties" || tab === "Purchasing") && (
            <div style={{ padding: "26px 0", textAlign: "center", color: T.sub, fontSize: 12.5 }}>No {tab.toLowerCase()} records yet.</div>
          )}

          {tab === "Custom" && (
            <CustomFieldsEditor fields={draft.customFields || []} canEdit={canEdit}
              onChange={(fields) => field("customFields", fields)} />
          )}

          {tab === "Files" && (
            <>
              <SectionLabel icon={Upload}>Field report</SectionLabel>
              <div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <FileText size={16} color={T.sub} />
                <div style={{ flex: 1, fontSize: 12.5, color: T.sub }}>
                  {equipment.report ? (
                    <>
                      {equipment.reportUrl ? (
                        <a href={equipment.reportUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.teal, fontWeight: 700, textDecoration: "none" }}>{equipment.report}</a>
                      ) : (
                        <span style={{ color: T.ink, fontWeight: 700 }}>{equipment.report}</span>
                      )}
                      {equipment.reportUploadedBy && <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Uploaded by {users.find((u) => u.id === equipment.reportUploadedBy)?.name || "—"}</div>}
                    </>
                  ) : "Technician uploads a completion report here (PDF or Word)"}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                  onChange={(e) => e.target.files[0] && onUploadReport(equipment.id, e.target.files[0])} />
                <button onClick={() => fileRef.current.click()} style={smallBtn}>Upload</button>
              </div>
            </>
          )}

          {tab === "Log" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {equipment.pm.map((p) => (
                <div key={p.id} style={{ fontSize: 12, color: T.sub, borderLeft: `2px solid ${T.line}`, paddingLeft: 10 }}>
                  {p.date} — {p.type} logged, status {p.status}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, onChange, disabled, mono: isMono }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input disabled={disabled} value={value || ""} onChange={(e) => onChange && onChange(e.target.value)}
        style={{
          width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5,
          color: T.ink, background: disabled ? T.panel : "#fff", ...(isMono ? mono : {}),
        }} />
    </div>
  );
}
const labelStyle = { fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 };

function SiteChips({ user, sites, onToggle }) {
  const assigned = user.siteIds || [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 0.3, marginRight: 2 }}>Sites:</span>
      {sites.map((s) => {
        const on = assigned.includes(s.id);
        return (
          <button key={s.id} onClick={() => onToggle(user, s.id)} style={{
            border: `1px solid ${on ? T.teal : T.line}`, background: on ? "#E4F5F3" : "#fff",
            color: on ? T.tealDeep : T.sub, borderRadius: 20, padding: "3px 10px", fontSize: 11,
            fontWeight: 700, cursor: "pointer",
          }}>{s.name}</button>
        );
      })}
      {assigned.length === 0 && <span style={{ fontSize: 10.5, color: T.sub, fontStyle: "italic" }}>none picked — sees all sites</span>}
    </div>
  );
}

function CustomFieldsEditor({ fields, canEdit, onChange }) {
  const [k, setK] = useState(""); const [v, setV] = useState("");
  const add = () => { if (!k.trim()) return; onChange([...fields, { id: "cf" + Date.now(), key: k.trim(), value: v }]); setK(""); setV(""); };
  const remove = (id) => onChange(fields.filter((f) => f.id !== id));
  const update = (id, val) => onChange(fields.map((f) => f.id === id ? { ...f, value: val } : f));
  return (
    <>
      <SectionLabel icon={Plus}>Custom fields</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {fields.length === 0 && <div style={{ fontSize: 12, color: T.sub, fontStyle: "italic" }}>No custom fields added yet.</div>}
        {fields.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 160, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{f.key}</div>
            <input disabled={!canEdit} value={f.value} onChange={(e) => update(f.id, e.target.value)}
              style={{ flex: 1, border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, color: T.ink }} />
            {canEdit && <button onClick={() => remove(f.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8 }}>
          <input value={k} onChange={(e) => setK(e.target.value)} placeholder="Field name (e.g. Rated kVA)" style={{ ...selStyle, flex: 1 }} />
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Value" style={{ ...selStyle, flex: 1 }} />
          <button onClick={add} style={smallBtn}><Plus size={12} style={{ marginRight: 4 }} />Add field</button>
        </div>
      )}
    </>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.4, margin: "14px 0 8px" }}>
      <Icon size={13} />{children}
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const modalStyle = { background: "#fff", borderRadius: 18, padding: 26, width: "100%", maxHeight: "88vh", overflowY: "auto" };
function mobileOverlayStyle() { return { ...overlayStyle, padding: 0 }; }
function mobileModalStyle(base) { return { ...base, borderRadius: 0, maxWidth: "100%", width: "100%", height: "100vh", maxHeight: "100vh" }; }
const iconBtn = { border: "none", background: T.panel, borderRadius: 8, padding: 6, cursor: "pointer", color: T.sub };
const smallBtn = { border: "none", background: T.ink, color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" };

/* ------------------------------------------------------------------ */
/*  Work Orders                                                        */
/* ------------------------------------------------------------------ */
function WorkOrders({ workOrders, users, user, onUploadReport, onStatusChange, onOpen, onNewWorkOrder }) {
  const [q, setQ] = useState("");
  const fileRefs = useRef({});
  const isMobile = useIsMobile();

  const visible = useMemo(() => {
    let list = workOrders;
    if (user.role === "Technician") list = list.filter((w) => w.assignedTo === user.id);
    if (q) list = list.filter((w) => (w.description + w.equipmentName + w.code).toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [workOrders, user, q]);

  const uploadBtn = (w) => (
    w.report ? (
      <div>
        {w.reportUrl ? (
          <a href={w.reportUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: T.teal, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}><FileText size={12} />{w.report}</a>
        ) : (
          <span style={{ fontSize: 11.5, color: T.teal, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><FileText size={12} />{w.report}</span>
        )}
        {w.reportUploadedBy && <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>by {users.find((u) => u.id === w.reportUploadedBy)?.name || "—"}</div>}
      </div>
    ) : (
      <>
        <input ref={(el) => (fileRefs.current[w.id] = el)} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && onUploadReport(w.id, e.target.files[0])} />
        <button onClick={() => fileRefs.current[w.id].click()} style={{ ...smallBtn, background: T.panel, color: T.ink }}>
          <Upload size={11} style={{ marginRight: 4 }} />Upload
        </button>
      </>
    )
  );

  return (
    <div>
      <PageHeader title="Work Orders" sub={user.role === "Technician" ? "Assigned to you" : "All facilities"}
        right={
          <>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: T.sub }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work orders…"
                style={{ ...selStyle, paddingLeft: 30, width: isMobile ? "100%" : 220 }} />
            </div>
            {(user.role === "Admin" || user.role === "Manager") && (
              <button onClick={onNewWorkOrder} style={smallBtn}><Plus size={12} style={{ marginRight: 4 }} />New work order</button>
            )}
          </>
        } />

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((w) => {
            const assignee = users.find((u) => u.id === w.assignedTo);
            return (
              <div key={w.id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <button onClick={() => onOpen(w.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{w.description}</div>
                    <div style={{ fontSize: 11, color: T.sub, ...mono, marginTop: 2 }}>#{w.code} · {w.equipmentId.toUpperCase()}</div>
                  </button>
                  <Badge tone={w.priority === "Highest" ? "red" : "amber"}>{w.priority}</Badge>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge tone={w.type === "Corrective" ? "amber" : "teal"}>{w.type}</Badge>
                  <span style={{ fontSize: 12, color: T.sub, alignSelf: "center" }}>{assignee?.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <select value={w.status} onChange={(e) => onStatusChange(w.id, e.target.value)} style={{ ...selStyle, padding: "6px 8px", fontSize: 12, flex: 1 }}>
                    {["Open", "In Progress", "Late", "Closed"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {uploadBtn(w)}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 13 }}>No work orders match.</div>}
        </div>
      ) : (
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ ...rowGrid, background: T.panel, fontWeight: 800, fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>
            <div>Code</div><div>Description</div><div>Type</div><div>Assigned</div><div>Priority</div><div>Status</div><div>Report</div>
          </div>
          {visible.map((w) => {
            const assignee = users.find((u) => u.id === w.assignedTo);
            return (
              <div key={w.id} style={rowGrid}>
                <button onClick={() => onOpen(w.id)} style={{ ...mono, fontSize: 12.5, color: T.teal, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>#{w.code}</button>
                <button onClick={() => onOpen(w.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{w.description}</div>
                  <div style={{ fontSize: 11, color: T.sub, ...mono }}>{w.equipmentId.toUpperCase()}</div>
                </button>
                <div><Badge tone={w.type === "Corrective" ? "amber" : "teal"}>{w.type}</Badge></div>
                <div style={{ fontSize: 12.5, color: T.ink }}>{assignee?.name}</div>
                <div><Badge tone={w.priority === "Highest" ? "red" : "amber"}>{w.priority}</Badge></div>
                <div>
                  <select value={w.status} onChange={(e) => onStatusChange(w.id, e.target.value)} style={{ ...selStyle, padding: "5px 8px", fontSize: 11.5 }}>
                    {["Open", "In Progress", "Late", "Closed"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>{uploadBtn(w)}</div>
              </div>
            );
          })}
          {visible.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 13 }}>No work orders match.</div>}
        </div>
      )}
    </div>
  );
}
const rowGrid = { display: "grid", gridTemplateColumns: "70px 2fr 100px 130px 90px 130px 130px", gap: 10, alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${T.line}` };

/* ------------------------------------------------------------------ */
/*  Work Order Administration modal — mirrors the Fiix WO screen       */
/* ------------------------------------------------------------------ */
function NewWorkOrderModal({ open, preset, sites, users, onClose, onCreate }) {
  const isMobile = useIsMobile();
  const [siteId, setSiteId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Corrective");
  const [priority, setPriority] = useState("High");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estLabor, setEstLabor] = useState("1.0h");

  useEffect(() => {
    if (!open) return;
    setSiteId(preset?.siteId || sites[0]?.id || "");
    setEquipmentId(preset?.equipmentId || "");
    setDescription("");
    setType("Corrective");
    setPriority("High");
    setAssignedTo(users.find((u) => u.role === "Technician")?.id || users[0]?.id || "");
    setDueDate(new Date().toISOString().slice(0, 10));
    setEstLabor("1.0h");
  }, [open, preset]);

  if (!open) return null;
  const site = sites.find((s) => s.id === siteId);
  const equipmentOptions = site?.equipment || [];

  const submit = () => {
    if (!description.trim() || !siteId || !assignedTo) return;
    const eq = equipmentOptions.find((e) => e.id === equipmentId);
    onCreate({
      siteId, equipmentId: equipmentId || null, equipmentName: eq?.name || "", description: description.trim(),
      type, priority, assignedTo, dueDate: dueDate || new Date().toISOString().slice(0, 10), estLabor,
    });
    onClose();
  };

  return (
    <div style={isMobile ? mobileOverlayStyle() : overlayStyle} onClick={onClose}>
      <div style={isMobile ? mobileModalStyle({ ...modalStyle, maxWidth: 520 }) : { ...modalStyle, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>New work order</div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={labelStyle}>Site</div>
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setEquipmentId(""); }} style={{ ...selStyle, width: "100%" }}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Equipment (optional)</div>
            <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} style={{ ...selStyle, width: "100%" }}>
              <option value="">— General / not equipment-specific —</option>
              {equipmentOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Description</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What needs to be done?"
              style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: T.ink, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Type</div>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...selStyle, width: "100%" }}>
                {["Preventive", "Corrective", "Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Priority</div>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...selStyle, width: "100%" }}>
                {["Low", "High", "Highest"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Assign to</div>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ ...selStyle, width: "100%" }}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Due date</div>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...selStyle, width: "100%" }} />
            </div>
          </div>
          <FieldRow label="Estimated labor" value={estLabor} onChange={setEstLabor} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={submit} style={smallBtn}><Plus size={12} style={{ marginRight: 4 }} />Create work order</button>
          <button onClick={onClose} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const WO_TABS = ["General", "Completion", "Labor Tasks", "Parts", "Meter Readings", "Files", "Work Log"];

function WorkOrderModal({ wo, sites, users, onClose, onSave, onUploadReport, role }) {
  const fileRef = useRef();
  const [tab, setTab] = useState("General");
  const [draft, setDraft] = useState(null);
  const isMobile = useIsMobile();
  React.useEffect(() => { setDraft(wo ? { ...wo } : null); setTab("General"); }, [wo?.id]);
  if (!wo || !draft) return null;
  const canEdit = role === "Admin" || role === "Manager";
  const isAssignee = role === "Technician";
  const field = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const site = sites.find((s) => s.id === wo.siteId);
  const equipment = site?.equipment.find((e) => e.id === wo.equipmentId);
  const assignee = users.find((u) => u.id === wo.assignedTo);

  return (
    <div style={isMobile ? mobileOverlayStyle() : overlayStyle} onClick={onClose}>
      <div style={isMobile ? mobileModalStyle({ ...modalStyle, padding: 0 }) : { ...modalStyle, maxWidth: 900, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 26px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>WO {wo.code}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(canEdit || isAssignee) && <button onClick={() => onSave(wo.id, draft)} style={smallBtn}><Save size={12} style={{ marginRight: 4 }} />Save</button>}
            <button onClick={onClose} style={iconBtn}><X size={18} /></button>
          </div>
        </div>

        <div style={{ padding: isMobile ? "16px 16px 0" : "20px 26px 0" }}>
          <div style={{ display: "flex", gap: isMobile ? 12 : 20, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            {!isMobile && (
              <div style={{ width: 96, height: 96, borderRadius: 12, background: T.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: `1px solid ${T.line}` }}>
                <Building2 size={26} color={T.teal} />
                <div style={{ fontSize: 10, color: T.sub, textAlign: "center", padding: "0 4px" }}>{equipment?.name}</div>
              </div>
            )}

            <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 12, minWidth: isMobile ? "100%" : "auto" }}>
              <FieldRow label="Code" value={String(wo.code)} disabled mono />
              <FieldRow label="Asset" value={equipment?.name} disabled />
              <div>
                <div style={labelStyle}>Work order status</div>
                <select value={draft.status} disabled={!canEdit && !isAssignee} onChange={(e) => field("status", e.target.value)} style={{ ...selStyle, width: "100%" }}>
                  {["Open", "In Progress", "Late", "Closed"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Maintenance type</div>
                <select value={draft.type} disabled={!canEdit} onChange={(e) => field("type", e.target.value)} style={{ ...selStyle, width: "100%" }}>
                  {["Preventive", "Corrective", "Other"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Priority</div>
                <select value={draft.priority} disabled={!canEdit} onChange={(e) => field("priority", e.target.value)} style={{ ...selStyle, width: "100%" }}>
                  {["Low", "High", "Highest"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <FieldRow label="Suggested start date" value={draft.suggestedStart} onChange={(v) => field("suggestedStart", v)} disabled={!canEdit} />
            </div>

            {!isMobile && <div style={{ width: 74, height: 74, border: `1px solid ${T.line}`, borderRadius: 8, flexShrink: 0, background: "repeating-conic-gradient(#0F172A 0% 25%, #fff 0% 50%) 0/8px 8px" }} title="QR code" />}
          </div>

          <div style={{ display: "flex", gap: 2, marginTop: 20, borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
            {WO_TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                border: "none", background: "transparent", padding: "9px 14px", fontSize: 12.5,
                fontWeight: 700, color: tab === t ? T.ink : T.sub, cursor: "pointer",
                borderBottom: tab === t ? `2px solid ${T.teal}` : "2px solid transparent", whiteSpace: "nowrap",
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: isMobile ? "14px 16px 100px" : "18px 26px 26px", maxHeight: isMobile ? "none" : "50vh", overflowY: "auto" }}>
          {tab === "General" && (
            <>
              <SectionLabel icon={FileText}>Summary of issue</SectionLabel>
              <textarea disabled={!canEdit} value={draft.summary} onChange={(e) => field("summary", e.target.value)} rows={2}
                style={{ width: "100%", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: T.ink, resize: "vertical", fontFamily: "inherit", marginBottom: 16 }} />

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: isMobile ? 16 : 24 }}>
                <div>
                  <SectionLabel icon={ClipboardList}>Work instructions</SectionLabel>
                  <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                    {wo.instructions.map((step, i) => (
                      <li key={i} style={{ fontSize: 12.5, color: T.ink }}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <SectionLabel icon={Users}>Assigned to</SectionLabel>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>{assignee?.name}</div>
                  <FieldRow label="Estimated labor" value={draft.estLabor} onChange={(v) => field("estLabor", v)} disabled={!canEdit} />
                  <div style={{ height: 10 }} />
                  <FieldRow label="Actual labor" value={draft.actLabor} onChange={(v) => field("actLabor", v)} disabled={!canEdit && !isAssignee} />
                </div>
              </div>
            </>
          )}

          {tab === "Completion" && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <FieldRow label="Completed by" value={draft.completedBy} onChange={(v) => field("completedBy", v)} disabled={!isAssignee && !canEdit} />
              <FieldRow label="Date completed" value={draft.dateCompleted} onChange={(v) => field("dateCompleted", v)} disabled={!isAssignee && !canEdit} />
            </div>
          )}

          {tab === "Labor Tasks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {wo.instructions.map((step, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.ink, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px" }}>
                  <input type="checkbox" disabled={!isAssignee && !canEdit} />{step}
                </label>
              ))}
            </div>
          )}

          {tab === "Parts" && equipment && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {equipment.parts.map((p) => (
                <div key={p.id} style={{ fontSize: 12.5, color: T.ink, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px" }}>{p.name}</div>
              ))}
            </div>
          )}

          {tab === "Meter Readings" && (
            <div style={{ padding: "20px 0", textAlign: "center", color: T.sub, fontSize: 12.5 }}>No meter readings logged for this work order yet.</div>
          )}

          {tab === "Files" && (
            <>
              <SectionLabel icon={Upload}>Completion report</SectionLabel>
              <div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <FileText size={16} color={T.sub} />
                <div style={{ flex: 1, fontSize: 12.5, color: T.sub }}>
                  {wo.report ? (
                    <>
                      {wo.reportUrl ? (
                        <a href={wo.reportUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.teal, fontWeight: 700, textDecoration: "none" }}>{wo.report}</a>
                      ) : (
                        <span style={{ color: T.ink, fontWeight: 700 }}>{wo.report}</span>
                      )}
                      {wo.reportUploadedBy && <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Uploaded by {users.find((u) => u.id === wo.reportUploadedBy)?.name || "—"}</div>}
                    </>
                  ) : "Upload the technician's report — PDF or Word"}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }}
                  onChange={(e) => e.target.files[0] && onUploadReport(wo.id, e.target.files[0])} />
                <button onClick={() => fileRef.current.click()} style={smallBtn}>Upload</button>
              </div>
            </>
          )}

          {tab === "Work Log" && (
            <div style={{ fontSize: 12, color: T.sub, borderLeft: `2px solid ${T.line}`, paddingLeft: 10 }}>
              Created for {wo.dueDate} · Priority {wo.priority} · Status {wo.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Room Designer — add a room, then place equipment on a grid          */
/* ------------------------------------------------------------------ */
function RoomDesigner({ sites, activeSite, setActiveSite, addRoom, onDeleteRoom, placeEquipment }) {
  const site = sites.find((s) => s.id === activeSite) || sites[0];
  const [roomId, setRoomId] = useState(site.rooms[0]?.id);
  const [newRoomName, setNewRoomName] = useState("");
  const [dragEq, setDragEq] = useState(null);
  const room = site.rooms.find((r) => r.id === roomId) || site.rooms[0];
  const unplaced = site.equipment.filter((e) => e.roomId === room?.id && !e.pos);
  const isMobile = useIsMobile();

  const cellSize = 54;

  return (
    <div>
      <PageHeader title="Room Designer" sub="Add a room, then drag equipment onto its floor grid"
        right={
          <select value={site.id} onChange={(e) => { setActiveSite(e.target.value); setRoomId(null); }} style={selStyle}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        } />

      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : undefined, gridTemplateColumns: isMobile ? undefined : "260px 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
            <SectionLabel icon={Plus}>Add room</SectionLabel>
            <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. Cold Aisle B"
              style={{ ...selStyle, width: "100%", marginBottom: 8 }} />
            <button style={{ ...smallBtn, width: "100%" }} onClick={() => {
              if (!newRoomName.trim()) return;
              const id = site.id + "-r" + (site.rooms.length + 1);
              addRoom(site.id, { id, name: newRoomName.trim(), grid: { w: 8, h: 5 } });
              setRoomId(id); setNewRoomName("");
            }}><Plus size={12} style={{ marginRight: 4 }} />Create room</button>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
            <SectionLabel icon={LayoutGrid}>Rooms</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {site.rooms.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setRoomId(r.id)} style={{
                    textAlign: "left", border: "none", borderRadius: 8, padding: "8px 10px",
                    background: r.id === roomId ? T.panel : "transparent", cursor: "pointer",
                    fontWeight: r.id === roomId ? 700 : 600, fontSize: 12.5, color: T.ink, flex: 1, minWidth: 0,
                  }}>{r.name}</button>
                  <button onClick={() => {
                    onDeleteRoom(site.id, r.id);
                    if (roomId === r.id) setRoomId(site.rooms.find((x) => x.id !== r.id)?.id || null);
                  }} style={iconBtn} title="Delete room"><Trash2 size={13} color={T.red} /></button>
                </div>
              ))}
              {site.rooms.length === 0 && <div style={{ fontSize: 11.5, color: T.sub, fontStyle: "italic" }}>No rooms yet — add one above</div>}
            </div>
          </div>

          <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
            <SectionLabel icon={Cpu}>Unplaced equipment</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unplaced.length === 0 && <div style={{ fontSize: 11.5, color: T.sub, fontStyle: "italic" }}>Everything is placed</div>}
              {unplaced.map((e) => (
                <div key={e.id} draggable onDragStart={() => setDragEq(e.id)} style={{
                  border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 9px", fontSize: 12,
                  fontWeight: 700, color: T.ink, cursor: "grab", background: "#fff",
                }}>{e.name}</div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: T.sub, marginTop: 8 }}>Drag a card onto the grid →</div>
          </div>
        </div>

        {room ? (
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, overflowX: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: T.ink, marginBottom: 10 }}>{room.name} floor plan</div>
            <div style={{
              display: "grid", gridTemplateColumns: `repeat(${room.grid.w},${cellSize}px)`,
              gridTemplateRows: `repeat(${room.grid.h},${cellSize}px)`, gap: 4, width: "max-content",
            }}>
              {Array.from({ length: room.grid.w * room.grid.h }).map((_, i) => {
                const x = i % room.grid.w, y = Math.floor(i / room.grid.w);
                const placed = site.equipment.find((e) => e.roomId === room.id && e.pos && e.pos.x === x && e.pos.y === y);
                return (
                  <div key={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dragEq && (placeEquipment(site.id, dragEq, room.id, { x, y }), setDragEq(null))}
                    style={{
                      border: `1px solid ${T.line}`, borderRadius: 6, background: placed ? "#E4F5F3" : T.panel,
                      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                    }}>
                    {placed && (
                      <div title={placed.name} style={{ textAlign: "center" }}>
                        <Server size={16} color={T.tealDeep} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : <div style={{ color: T.sub, fontSize: 13 }}>Create a room to begin placing equipment.</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Users & Roles (Admin only)                                         */
/* ------------------------------------------------------------------ */
function UsersRoles({ users, sites, onAddUser, onUpdateUser, onDeleteUser, onUpdateUserSites, currentUserId }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Technician");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const addMember = () => {
    if (!name.trim()) return;
    const id = "u" + (Date.now());
    onAddUser({ id, name: name.trim(), role, initials: initialsOf(name), email: email.trim() || null });
    setName(""); setEmail(""); setRole("Technician");
  };
  const removeMember = (id) => {
    if (id === currentUserId) return; // can't remove yourself
    onDeleteUser(id);
  };
  const startEdit = (u) => { setEditingId(u.id); setEditName(u.name); setEditEmail(u.email || ""); };
  const saveEdit = (id) => {
    const newName = editName.trim();
    const payload = {};
    if (newName) { payload.name = newName; payload.initials = initialsOf(newName); }
    payload.email = editEmail.trim() || null;
    onUpdateUser(id, payload);
    setEditingId(null);
  };
  const toggleSite = (u, siteId) => {
    const cur = u.siteIds || [];
    const next = cur.includes(siteId) ? cur.filter((id) => id !== siteId) : [...cur, siteId];
    onUpdateUserSites(u.id, next);
  };

  const isMobile = useIsMobile();

  return (
    <div>
      <PageHeader title="Users & Roles" sub="Role-based access control — email links a profile to a real login" />

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 8, alignItems: isMobile ? "stretch" : "flex-end", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ flex: 1, minWidth: isMobile ? "100%" : 140 }}>
          <div style={labelStyle}>New member name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Omar Saeed" style={{ ...selStyle, width: "100%" }} />
        </div>
        <div style={{ flex: 1, minWidth: isMobile ? "100%" : 160 }}>
          <div style={labelStyle}>Email (must match their login)</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="omar@company.com" style={{ ...selStyle, width: "100%" }} />
        </div>
        <div style={{ width: isMobile ? "100%" : "auto" }}>
          <div style={labelStyle}>Role</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...selStyle, width: isMobile ? "100%" : "auto" }}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={addMember} style={{ ...smallBtn, width: isMobile ? "100%" : "auto", justifyContent: "center" }}><Plus size={12} style={{ marginRight: 4 }} />Add member</button>
      </div>

      <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>
        Adding a profile here doesn't create their login — create their actual sign-in separately in
        Supabase (Authentication → Users → Add user) with this exact email, or have them sign themselves
        up if you've enabled that. The email here just links the two together.
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <div key={u.id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.teal, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{u.initials}</div>
                {editingId === u.id ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      style={{ ...selStyle, padding: "5px 8px", fontSize: 12.5 }} placeholder="Name" />
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(u.id)}
                      style={{ ...selStyle, padding: "5px 8px", fontSize: 12.5 }} placeholder="Email" />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{u.name}{u.id === currentUserId && <span style={{ color: T.sub, fontWeight: 600 }}> (you)</span>}</div>
                    <div style={{ fontSize: 11, color: u.email ? T.sub : T.amber }}>{u.email || "No email linked"}</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 4 }}>
                  {editingId === u.id ? (
                    <button onClick={() => saveEdit(u.id)} style={iconBtn}><Save size={14} /></button>
                  ) : (
                    <button onClick={() => startEdit(u)} style={iconBtn} title="Edit"><FileText size={14} /></button>
                  )}
                  <button onClick={() => removeMember(u.id)} disabled={u.id === currentUserId} style={{ ...iconBtn, opacity: u.id === currentUserId ? 0.35 : 1, cursor: u.id === currentUserId ? "not-allowed" : "pointer" }} title="Remove">
                    <Trash2 size={14} color={T.red} />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <select value={u.role} onChange={(e) => onUpdateUser(u.id, { role: e.target.value })} style={{ ...selStyle, flex: 1 }}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <span style={{ fontSize: 11.5, color: T.sub }}>
                {u.role === "Admin" ? "Full access" : u.role === "Manager" ? "Sites, assets, work orders" : "Assigned work orders only"}
              </span>
              <SiteChips user={u} sites={sites} onToggle={toggleSite} />
            </div>
          ))}
        </div>
      ) : (
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 1fr 1.2fr 70px", padding: "11px 16px", background: T.panel, fontWeight: 800, fontSize: 11, color: T.sub, textTransform: "uppercase" }}>
          <div>User</div><div>Email</div><div>Role</div><div>Access</div><div></div>
        </div>
        {users.map((u) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 1fr 1.2fr 70px", alignItems: "center", padding: "10px 16px", borderTop: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.teal, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{u.initials}</div>
              {editingId === u.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  style={{ ...selStyle, padding: "5px 8px", fontSize: 12.5, width: "100%" }} placeholder="Name" />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{u.name}{u.id === currentUserId && <span style={{ color: T.sub, fontWeight: 600 }}> (you)</span>}</span>
              )}
            </div>
            {editingId === u.id ? (
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit(u.id)}
                style={{ ...selStyle, padding: "5px 8px", fontSize: 12.5, width: "100%" }} placeholder="Email" />
            ) : (
              <span style={{ fontSize: 12, color: u.email ? T.sub : T.amber }}>{u.email || "No email linked"}</span>
            )}
            <select value={u.role} onChange={(e) => onUpdateUser(u.id, { role: e.target.value })} style={selStyle}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <span style={{ fontSize: 11.5, color: T.sub }}>
              {u.role === "Admin" ? "Full access" : u.role === "Manager" ? "Sites, assets, work orders" : "Assigned work orders only"}
            </span>
            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
              {editingId === u.id ? (
                <button onClick={() => saveEdit(u.id)} style={iconBtn}><Save size={14} /></button>
              ) : (
                <button onClick={() => startEdit(u)} style={iconBtn} title="Edit"><FileText size={14} /></button>
              )}
              <button onClick={() => removeMember(u.id)} disabled={u.id === currentUserId} style={{ ...iconBtn, opacity: u.id === currentUserId ? 0.35 : 1, cursor: u.id === currentUserId ? "not-allowed" : "pointer" }} title="Remove">
                <Trash2 size={14} color={T.red} />
              </button>
            </div>
            <div style={{ gridColumn: "1 / -1", paddingTop: 8 }}>
              <SiteChips user={u} sites={sites} onToggle={toggleSite} />
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Maintenance Calendar — week view with day columns, like Fiix's     */
/*  Calendar Legacy, plus a mini month picker                          */
/* ------------------------------------------------------------------ */
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function startOfWeek(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtISO(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function MiniMonth({ cursor, setCursor, weekStart, setWeekStart }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button style={iconBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button style={iconBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={14} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, fontSize: 10, color: T.sub, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>
        {DAY_NAMES.map((d) => <div key={d}>{d[0]}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
          const inWeek = d >= weekStart && d < addDays(weekStart, 7);
          return (
            <button key={i} onClick={() => setWeekStart(startOfWeek(d))} style={{
              border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer",
              background: inWeek ? T.ink : "transparent", color: inWeek ? "#fff" : T.ink, fontWeight: inWeek ? 800 : 600,
            }}>{day}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics — fleet-wide maintenance and capacity insights           */
/* ------------------------------------------------------------------ */
function BarRow({ label, value, max, tone = T.teal, suffix = "" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 120, fontSize: 12, color: T.ink, fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: 8, borderRadius: 5, background: T.panel, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: tone, borderRadius: 5, minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ width: 34, fontSize: 12, fontWeight: 800, color: T.ink, textAlign: "right", flexShrink: 0, ...mono }}>{value}{suffix}</div>
    </div>
  );
}

function AnalyticsPanel({ title, icon: Icon, children }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <Icon size={15} color={T.sub} />
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{title}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Analytics({ sites, workOrders, users }) {
  const isMobile = useIsMobile();
  const siteIds = new Set(sites.map((s) => s.id));
  const wos = workOrders.filter((w) => siteIds.has(w.siteId));

  const total = wos.length;
  const open = wos.filter((w) => w.status !== "Closed").length;
  const late = wos.filter((w) => w.status === "Late").length;
  const closed = wos.filter((w) => w.status === "Closed").length;
  const preventive = wos.filter((w) => w.type === "Preventive");
  const pmCompliance = preventive.length ? Math.round((preventive.filter((w) => w.status !== "Late").length / preventive.length) * 100) : null;

  const countBy = (key, options) => {
    const counts = {};
    options.forEach((o) => (counts[o] = 0));
    wos.forEach((w) => { const v = w[key]; if (v != null) counts[v] = (counts[v] || 0) + 1; });
    return counts;
  };
  const byStatus = countBy("status", ["Open", "In Progress", "Late", "Closed"]);
  const byType = countBy("type", ["Preventive", "Corrective", "Other"]);
  const byPriority = countBy("priority", ["Low", "High", "Highest"]);

  const bySite = {};
  sites.forEach((s) => (bySite[s.name] = wos.filter((w) => w.siteId === s.id).length));

  const byTech = {};
  users.forEach((u) => { const c = wos.filter((w) => w.assignedTo === u.id).length; if (c > 0) byTech[u.name] = c; });

  const equipmentTotal = sites.reduce((a, s) => a + s.equipment.length, 0);
  const equipmentOffline = sites.reduce((a, s) => a + s.equipment.filter((e) => e.status === "Offline").length, 0);

  const completedWithDates = wos.filter((w) => w.status === "Closed" && w.dateCompleted && w.dueDate);
  let avgDaysToClose = null;
  if (completedWithDates.length > 0) {
    const totalDays = completedWithDates.reduce((sum, w) => {
      const diff = (new Date(w.dateCompleted) - new Date(w.dueDate)) / (1000 * 60 * 60 * 24);
      return sum + diff;
    }, 0);
    avgDaysToClose = Math.round((totalDays / completedWithDates.length) * 10) / 10;
  }

  const maxStatus = Math.max(1, ...Object.values(byStatus));
  const maxType = Math.max(1, ...Object.values(byType));
  const maxPriority = Math.max(1, ...Object.values(byPriority));
  const maxSite = Math.max(1, ...Object.values(bySite));
  const maxTech = Math.max(1, ...Object.values(byTech), 1);

  const statusTone = { Open: T.teal, "In Progress": T.violet, Late: T.red, Closed: T.sub };

  return (
    <div>
      <PageHeader title="Analytics" sub="Fleet-wide maintenance and capacity insights" />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 12, marginBottom: 22 }}>
        <StatCard label="Total work orders" value={total} icon={ClipboardList} tone="teal" />
        <StatCard label="Open" value={open} icon={Wrench} tone="amber" />
        <StatCard label="Overdue" value={late} icon={AlertTriangle} tone="red" />
        <StatCard label="Closed" value={closed} icon={CheckCircle2} tone="violet" />
        <StatCard label="PM compliance" value={pmCompliance == null ? "—" : `${pmCompliance}%`} sub={preventive.length ? `${preventive.length} preventive WOs` : "No preventive WOs yet"} icon={Gauge} tone={pmCompliance == null ? "teal" : pmCompliance >= 80 ? "teal" : pmCompliance >= 50 ? "amber" : "red"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <AnalyticsPanel title="Work orders by status" icon={ClipboardList}>
          {Object.entries(byStatus).map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxStatus} tone={statusTone[k]} />)}
        </AnalyticsPanel>
        <AnalyticsPanel title="Work orders by type" icon={Wrench}>
          {Object.entries(byType).map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxType} tone={k === "Corrective" ? T.amber : k === "Preventive" ? T.teal : T.violet} />)}
          <div style={{ height: 1, background: T.line, margin: "4px 0" }} />
          {Object.entries(byPriority).map(([k, v]) => <BarRow key={k} label={k + " priority"} value={v} max={maxPriority} tone={k === "Highest" ? T.red : k === "High" ? T.amber : T.teal} />)}
        </AnalyticsPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <AnalyticsPanel title="Work orders by site" icon={Building2}>
          {Object.entries(bySite).map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxSite} tone={T.teal} />)}
        </AnalyticsPanel>
        <AnalyticsPanel title="Technician workload" icon={Users}>
          {Object.keys(byTech).length === 0 && <div style={{ fontSize: 12, color: T.sub, fontStyle: "italic" }}>No work orders assigned yet.</div>}
          {Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxTech} tone={T.violet} />)}
        </AnalyticsPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <AnalyticsPanel title="Site capacity & load" icon={Zap}>
          {sites.map((s) => {
            const pct = s.cap ? Math.round((s.load / s.cap) * 100) : 0;
            return <BarRow key={s.id} label={s.name} value={pct} max={100} suffix="%" tone={pct > 85 ? T.red : pct > 60 ? T.amber : T.teal} />;
          })}
        </AnalyticsPanel>
        <AnalyticsPanel title="Equipment health" icon={Cpu}>
          <BarRow label="Total assets" value={equipmentTotal} max={Math.max(1, equipmentTotal)} tone={T.teal} />
          <BarRow label="Offline" value={equipmentOffline} max={Math.max(1, equipmentTotal)} tone={T.red} />
          <div style={{ marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>Avg. days to close (vs. due date)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, ...mono }}>
              {avgDaysToClose == null ? "—" : avgDaysToClose > 0 ? `+${avgDaysToClose}d late` : `${avgDaysToClose}d early`}
            </div>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{completedWithDates.length} closed work order{completedWithDates.length === 1 ? "" : "s"} with dates on record</div>
          </div>
        </AnalyticsPanel>
      </div>
    </div>
  );
}

function MaintenanceCalendar({ workOrders, sites, users, user, onOpen }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(2026, 7, 3)));
  const [cursor, setCursor] = useState(new Date(2026, 7, 1));
  const [filter, setFilter] = useState("all");
  const isMobile = useIsMobile();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const scoped = user.role === "Technician" ? workOrders.filter((w) => w.assignedTo === user.id) : workOrders;
  const filtered = scoped.filter((w) => {
    if (filter === "late") return w.status === "Late";
    if (filter === "open") return w.status === "Open";
    return true;
  });

  const byDate = (iso) => filtered.filter((w) => w.dueDate === iso);
  const toneFor = (w) => (w.status === "Late" ? "red" : w.type === "Corrective" ? "amber" : "teal");

  return (
    <div>
      <PageHeader title="Maintenance Calendar" sub="Scheduled and overdue work orders by day"
        right={
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "open", "late"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                border: `1px solid ${T.line}`, borderRadius: 20, padding: "6px 13px", fontSize: 11.5, fontWeight: 700,
                cursor: "pointer", background: filter === f ? T.ink : "#fff", color: filter === f ? "#fff" : T.sub, textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>
        } />

      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : undefined, gridTemplateColumns: isMobile ? undefined : "220px 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", flexWrap: "wrap", gap: 14 }}>
          <MiniMonth cursor={cursor} setCursor={setCursor} weekStart={weekStart} setWeekStart={setWeekStart} />
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? "1 1 200px" : "none" }}>
            <button onClick={() => setWeekStart(startOfWeek(new Date(2026, 7, 3)))} style={{ ...smallBtn, background: T.panel, color: T.ink, width: "100%" }}>Current week</button>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={iconBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 11.5, color: T.sub, fontWeight: 700, alignSelf: "center" }}>{MONTH_NAMES[weekStart.getMonth()].slice(0, 3)} {weekStart.getDate()}–{addDays(weekStart, 6).getDate()}</span>
              <button style={iconBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: T.sub, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#0E9C8F", display: "inline-block" }} />Preventive</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#D97706", display: "inline-block" }} />Corrective</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#DC4C4C", display: "inline-block" }} />Late</div>
          </div>
        </div>

        <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: isMobile ? "auto" : "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(7,130px)" : "repeat(7,1fr)", minWidth: isMobile ? 910 : "auto" }}>
            {weekDays.map((d, i) => {
              const iso = fmtISO(d);
              const isToday = fmtISO(new Date(2026, 7, 4)) === iso;
              return (
                <div key={i} style={{ borderLeft: i ? `1px solid ${T.line}` : "none", minHeight: 420 }}>
                  <div style={{
                    padding: "10px 10px", borderBottom: `1px solid ${T.line}`, background: isToday ? T.panel : "#fff",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.sub, letterSpacing: 0.4 }}>{DAY_NAMES[i]}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: isToday ? T.teal : T.ink }}>{d.getDate()}</span>
                  </div>
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {byDate(iso).map((w) => {
                      const assignee = users.find((u) => u.id === w.assignedTo);
                      const site = sites.find((s) => s.id === w.siteId);
                      return (
                        <button key={w.id} onClick={() => onOpen(w.id)} style={{
                          textAlign: "left", border: `1px solid ${T.line}`, borderLeft: `3px solid ${toneFor(w) === "red" ? T.red : toneFor(w) === "amber" ? T.amber : T.teal}`,
                          borderRadius: 8, padding: "7px 8px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: T.sub, ...mono }}>#{w.code}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 800, color: T.sub, background: T.panel, borderRadius: 8, padding: "1px 6px" }}>{w.estLabor}</span>
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{w.equipmentName}</div>
                          <div style={{ fontSize: 10, color: T.sub }}>{assignee?.name} · {site?.name}</div>
                        </button>
                      );
                    })}
                    {byDate(iso).length === 0 && <div style={{ fontSize: 10.5, color: T.line, textAlign: "center", paddingTop: 10 }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                           */
/* ------------------------------------------------------------------ */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [sites, setSites] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeSite, setActiveSite] = useState(null);
  const [openEqId, setOpenEqId] = useState(null);
  const [openWoId, setOpenWoId] = useState(null);
  const [newWODraft, setNewWODraft] = useState(null); // null = closed, object = open with optional preset
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useWindowIsMobile();

  // Track the Supabase Auth session — checks for an existing one on load
  // (so refreshing the page keeps you signed in), and listens for
  // sign-in/sign-out events from here on.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = (email, password) => {
    setAuthError(null);
    setAuthLoading(true);
    supabase.auth.signInWithPassword({ email, password })
      .then(({ error }) => { if (error) setAuthError(error.message); })
      .finally(() => setAuthLoading(false));
  };
  const signOut = () => supabase.auth.signOut();

  const loadData = () => {
    setLoading(true);
    setLoadError(null);
    fetchAll()
      .then(({ sites, workOrders, users, customTypes }) => {
        setSites(sites);
        setWorkOrders(workOrders);
        setUsers(users);
        setCustomTypes(customTypes || []);
        setActiveSite((prev) => prev || sites[0]?.id || null);
      })
      .catch((err) => setLoadError(err.message || String(err)))
      .finally(() => setLoading(false));
  };

  // Once we have a signed-in session, load the app's data. On sign-out,
  // clear everything back to empty so a different account can't briefly
  // see the previous user's data.
  useEffect(() => {
    if (session) loadData();
    else { setSites([]); setWorkOrders([]); setUsers([]); setActiveSite(null); }
  }, [session]);

  const allEquipment = sites.flatMap((s) => s.equipment);
  const openEquipment = allEquipment.find((e) => e.id === openEqId);

  // Every handler below updates local state immediately (so the UI feels
  // instant) and fires the matching Supabase write in the background. If
  // the write fails, we log it and reload from the database so the UI
  // never silently drifts out of sync with what's actually saved.
  const onDbError = (err) => { console.error(err); loadData(); };

  const uploadEquipmentReport = async (eqId, file) => {
    if (file.size > 50 * 1024 * 1024) { alert("That file is over 50MB — the current storage plan's per-file limit. Try a smaller file, or compress it first."); return; }
    try {
      const { url } = await uploadReportFile(file, `equipment/${eqId}`);
      setSites((prev) => prev.map((s) => ({ ...s, equipment: s.equipment.map((e) => e.id === eqId ? { ...e, report: file.name, reportUrl: url, reportUploadedBy: user?.id } : e) })));
      dbUpdateEquipment(eqId, { report: file.name, reportUrl: url, reportUploadedBy: user?.id }).catch(onDbError);
    } catch (err) {
      alert("Upload failed: " + (err.message || err));
    }
  };
  const uploadWOReport = async (woId, file) => {
    if (file.size > 50 * 1024 * 1024) { alert("That file is over 50MB — the current storage plan's per-file limit. Try a smaller file, or compress it first."); return; }
    try {
      const { url } = await uploadReportFile(file, `work-orders/${woId}`);
      setWorkOrders((prev) => prev.map((w) => w.id === woId ? { ...w, report: file.name, reportUrl: url, status: "In Progress", reportUploadedBy: user?.id } : w));
      dbUpdateWorkOrder(woId, { report: file.name, reportUrl: url, status: "In Progress", reportUploadedBy: user?.id }).catch(onDbError);
    } catch (err) {
      alert("Upload failed: " + (err.message || err));
    }
  };
  const setWOStatus = (woId, status) => {
    setWorkOrders((prev) => prev.map((w) => w.id === woId ? { ...w, status } : w));
    dbUpdateWorkOrder(woId, { status }).catch(onDbError);
  };
  const saveWorkOrder = (woId, draft) => {
    const prevWO = workOrders.find((w) => w.id === woId);
    setWorkOrders((prev) => prev.map((w) => w.id === woId ? { ...w, ...draft } : w));
    dbUpdateWorkOrder(woId, draft).catch(onDbError);
    // Notify only when the assignment actually changed to someone new
    if (draft.assignedTo && draft.assignedTo !== prevWO?.assignedTo) {
      const assignee = users.find((u) => u.id === draft.assignedTo);
      const site = sites.find((s) => s.id === prevWO?.siteId);
      if (assignee?.email) {
        notifyAssignment({
          to: assignee.email, name: assignee.name, woCode: prevWO?.code,
          description: draft.summary ?? prevWO?.summary, dueDate: draft.suggestedStart ?? prevWO?.suggestedStart,
          priority: draft.priority ?? prevWO?.priority, siteName: site?.name, equipmentName: prevWO?.equipmentName,
        });
      }
    }
  };
  const addWorkOrder = (draft) => {
    const code = Math.max(90, ...workOrders.map((w) => w.code || 0)) + 1;
    const wo = {
      id: "wo" + Date.now(), code,
      siteId: draft.siteId, equipmentId: draft.equipmentId || null, equipmentName: draft.equipmentName || "",
      description: draft.description, summary: draft.description, priority: draft.priority, type: draft.type,
      assignedTo: draft.assignedTo, status: "Open", mop: null, dueDate: draft.dueDate, suggestedStart: draft.dueDate,
      instructions: draft.instructions && draft.instructions.length ? draft.instructions : [
        `Inspect ${draft.equipmentName || "asset"}`,
        "Check fluid levels / connections",
        "Record meter reading before starting",
        `Perform ${draft.type.toLowerCase()} tasks per MOP`,
        "Take a photo for each step and attach to Files",
        "Sign off and complete work order",
      ],
      estLabor: draft.estLabor || "1.0h", actLabor: "", completedBy: "", dateCompleted: "", report: null, reportUploadedBy: null,
    };
    setWorkOrders((prev) => [...prev, wo]);
    dbAddWorkOrder(wo).catch(onDbError);
    const assignee = users.find((u) => u.id === wo.assignedTo);
    const site = sites.find((s) => s.id === wo.siteId);
    if (assignee?.email) {
      notifyAssignment({
        to: assignee.email, name: assignee.name, woCode: wo.code, description: wo.description,
        dueDate: wo.dueDate, priority: wo.priority, siteName: site?.name, equipmentName: wo.equipmentName,
      });
    }
  };
  const saveEquipmentGeneral = (eqId, draft) => {
    setSites((prev) => prev.map((s) => ({ ...s, equipment: s.equipment.map((e) => e.id === eqId ? { ...e, ...draft } : e) })));
    dbUpdateEquipment(eqId, draft).catch(onDbError);
  };
  const addRoom = (siteId, room) => {
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, rooms: [...s.rooms, room] } : s));
    dbAddRoom(siteId, room).catch(onDbError);
  };
  const deleteRoom = (siteId, roomId) => {
    const site = sites.find((s) => s.id === siteId);
    const occupied = site?.equipment.some((e) => e.roomId === roomId);
    if (occupied) {
      alert("This room still has equipment in it. Move or delete that equipment first, then remove the room.");
      return;
    }
    setSites((prev) => prev.map((s) => s.id === siteId
      ? { ...s, rooms: s.rooms.filter((r) => r.id !== roomId), racks: s.racks.filter((r) => r.roomId !== roomId) }
      : s));
    dbDeleteRoom(roomId).catch(onDbError);
  };
  const placeEquipment = (siteId, eqId, roomId, pos) => {
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, equipment: s.equipment.map((e) => e.id === eqId ? { ...e, roomId, pos } : e) } : s));
    dbUpdateEquipment(eqId, { roomId, pos }).catch(onDbError);
  };
  const addFloor = (siteId, floor) => {
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, floors: [...(s.floors || []), floor] } : s));
    dbAddFloor(siteId, floor).catch(onDbError);
  };
  const deleteFloor = (siteId, floorId) => {
    const site = sites.find((s) => s.id === siteId);
    const occupied = site?.rooms.some((r) => r.floorId === floorId);
    if (occupied) {
      alert("This floor still has rooms on it. Move or delete those rooms first, then remove the floor.");
      return;
    }
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, floors: (s.floors || []).filter((f) => f.id !== floorId) } : s));
    dbDeleteFloor(floorId).catch(onDbError);
  };

  const addSite = (draft) => {
    const id = "s" + (Date.now());
    const rooms = [{ id: id + "-r1", name: "Server Hall A", grid: { w: 8, h: 5 } }];
    const racks = Array.from({ length: draft.rackCount || 0 }).map((_, i) => ({ id: `${id}-rk${i + 1}`, name: `Rack ${String(i + 1).padStart(2, "0")}`, roomId: rooms[0].id }));
    const site = { id, name: draft.name, loc: draft.loc, cap: draft.cap, load: draft.load, itLoad: draft.itLoad || 0, floors: [], racks, rooms, equipment: [] };
    setSites((prev) => [...prev, site]);
    dbAddSite(site).catch(onDbError);
  };
  const updateSite = (siteId, draft) => {
    setSites((prev) => prev.map((s) => {
      if (s.id !== siteId) return s;
      const curCount = s.racks.length, wantCount = draft.rackCount || 0;
      let racks = s.racks;
      if (wantCount !== curCount) {
        racks = Array.from({ length: wantCount }).map((_, i) => s.racks[i] || { id: `${s.id}-rk${i + 1}`, name: `Rack ${String(i + 1).padStart(2, "0")}`, roomId: s.rooms[0]?.id });
      }
      return { ...s, name: draft.name, loc: draft.loc, cap: draft.cap, load: draft.load, itLoad: draft.itLoad, racks };
    }));
    dbUpdateSite(siteId, draft).catch(onDbError);
  };
  const deleteSite = (siteId) => {
    setSites((prev) => prev.filter((s) => s.id !== siteId));
    setWorkOrders((prev) => prev.filter((w) => w.siteId !== siteId));
    if (activeSite === siteId) setActiveSite((prev) => sites.find((s) => s.id !== siteId)?.id || prev);
    dbDeleteSite(siteId).catch(onDbError);
  };

  const addEquipment = (siteId, draft) => {
    const site = sites.find((s) => s.id === siteId);
    const seq = site.equipment.length + 1;
    const id = siteId + "-eq" + Date.now();
    const code = `${siteId.toUpperCase()}-${draft.roomId.split("-").pop().toUpperCase()}-EQ${String(seq).padStart(3, "0")}`;
    const eq = {
      id, code, name: draft.name, type: draft.type, roomId: draft.roomId, rackId: null, status: draft.status || "Online",
      installYear: draft.installYear || new Date().getFullYear(), make: "", model: "", serial: "", barcode: "",
      category: "Equipment", account: "", chargeDept: "", notes: "", location: site.name,
      parts: [], pm: [], customFields: [], report: null,
    };
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, equipment: [...s.equipment, eq] } : s));
    dbAddEquipment(siteId, eq).catch(onDbError);
  };
  const deleteEquipment = (siteId, eqId) => {
    setSites((prev) => prev.map((s) => s.id === siteId ? { ...s, equipment: s.equipment.filter((e) => e.id !== eqId) } : s));
    setWorkOrders((prev) => prev.filter((w) => w.equipmentId !== eqId));
    dbDeleteEquipment(eqId).catch(onDbError);
  };

  const addUser = (u) => {
    setUsers((prev) => [...prev, u]);
    dbAddUser(u).catch(onDbError);
  };
  const updateUser = (userId, fields) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...fields } : u));
    dbUpdateUser(userId, fields).catch(onDbError);
  };
  const updateUserSites = (userId, siteIds) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, siteIds } : u));
    dbSetUserSites(userId, siteIds).catch(onDbError);
  };
  const deleteUser = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    dbDeleteUser(userId).catch(onDbError);
  };

  const equipmentTypes = Array.from(new Set([...BUILTIN_EQUIPMENT_TYPES, ...customTypes]));
  const addEquipmentType = (name) => {
    const trimmed = name.trim();
    if (!trimmed || equipmentTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    setCustomTypes((prev) => [...prev, trimmed]);
    dbAddEquipmentType(trimmed).catch(onDbError);
  };

  // session === undefined → still checking for an existing session (brief,
  // happens once on first load)
  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,system-ui,sans-serif" }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  // session === null → not signed in
  if (!session) return <Login onSignIn={signIn} error={authError} loading={authLoading} />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "Inter,system-ui,sans-serif", color: T.sub }}>
        <Loader2 size={22} className="spin" style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
        <div style={{ fontSize: 13 }}>Loading from database…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,system-ui,sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: "center", color: T.sub }}>
          <AlertTriangle size={26} color={T.red} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 800, color: T.ink, marginBottom: 6 }}>Couldn't reach the database</div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>{loadError}</div>
          <div style={{ fontSize: 12, marginBottom: 14 }}>Check that <code>.env</code> has the correct <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, and that the schema/migration have been run in Supabase.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={loadData} style={smallBtn}>Retry</button>
            <button onClick={signOut} style={{ ...smallBtn, background: T.panel, color: T.ink }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, but no profile row in the `users` table matches this
  // account's email — nothing to show them yet.
  const user = users.find((u) => u.email && u.email.toLowerCase() === session.user.email.toLowerCase());
  if (!user) return <NoProfileScreen email={session.user.email} onLogout={signOut} />;

  const PAGE_TITLES = { dashboard: "Sites Dashboard", calendar: "Calendar", assets: "Assets", workorders: "Work Orders", analytics: "Analytics", roomdesigner: "Room Designer", users: "Users & Roles" };

  return (
    <MobileCtx.Provider value={isMobile}>
      <div style={{ display: "flex", background: T.bg, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", color: T.ink, flexDirection: isMobile ? "column" : "row" }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={signOut} mobileOpen={drawerOpen} onCloseMobile={() => setDrawerOpen(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((c) => !c)} />
        {isMobile && (
          <div style={{
            position: "sticky", top: 0, zIndex: 40, background: T.bg, borderBottom: `1px solid ${T.line}`,
            display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          }}>
            <button onClick={() => setDrawerOpen(true)} style={iconBtn}><Menu size={18} /></button>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Server size={13} color="#fff" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: T.ink }}>{PAGE_TITLES[page]}</div>
            <div style={{ marginLeft: "auto", width: 26, height: 26, borderRadius: "50%", background: T.teal, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{user.initials}</div>
          </div>
        )}
        <div style={{ flex: 1, padding: isMobile ? "14px" : "26px 32px", overflowX: "auto", minWidth: 0 }}>
          {page === "dashboard" && <SitesDashboard sites={visibleSitesFor(user, sites)} workOrders={workOrders} setPage={setPage} setActiveSite={setActiveSite} role={user.role} onAddSite={addSite} onUpdateSite={updateSite} onDeleteSite={deleteSite} />}
          {page === "calendar" && <MaintenanceCalendar workOrders={workOrders} sites={sites} users={users} user={user} onOpen={setOpenWoId} />}
          {page === "assets" && <AssetTree sites={visibleSitesFor(user, sites)} activeSite={activeSite} setActiveSite={setActiveSite} onOpenEquipment={setOpenEqId} role={user.role} onAddEquipment={addEquipment} onDeleteEquipment={deleteEquipment} onAddRoom={addRoom} onDeleteRoom={deleteRoom} onAddFloor={addFloor} onDeleteFloor={deleteFloor} equipmentTypes={equipmentTypes} onAddEquipmentType={addEquipmentType} />}
          {page === "workorders" && <WorkOrders workOrders={workOrders} users={users} user={user} onUploadReport={uploadWOReport} onStatusChange={setWOStatus} onOpen={setOpenWoId} onNewWorkOrder={() => setNewWODraft({})} />}
          {page === "analytics" && <PermGate allow={["Admin", "Manager"]} role={user.role} fallback={<AccessDenied />}>
            <Analytics sites={visibleSitesFor(user, sites)} workOrders={workOrders} users={users} />
          </PermGate>}
          {page === "roomdesigner" && <PermGate allow={["Admin", "Manager"]} role={user.role} fallback={<AccessDenied />}>
            <RoomDesigner sites={visibleSitesFor(user, sites)} activeSite={activeSite} setActiveSite={setActiveSite} addRoom={addRoom} onDeleteRoom={deleteRoom} placeEquipment={placeEquipment} />
          </PermGate>}
          {page === "users" && <PermGate allow={["Admin"]} role={user.role} fallback={<AccessDenied />}>
            <UsersRoles users={users} sites={sites} onAddUser={addUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} onUpdateUserSites={updateUserSites} currentUserId={user.id} />
          </PermGate>}
        </div>
        <EquipmentModal equipment={openEquipment} users={users} onClose={() => setOpenEqId(null)} onUploadReport={uploadEquipmentReport} onSaveGeneral={saveEquipmentGeneral} role={user.role}
          onNewWorkOrder={() => {
            if (!openEquipment) return;
            const ownerSite = sites.find((s) => s.equipment.some((e) => e.id === openEquipment.id));
            setNewWODraft({ siteId: ownerSite?.id, equipmentId: openEquipment.id, equipmentName: openEquipment.name });
          }} />
        <WorkOrderModal wo={workOrders.find((w) => w.id === openWoId)} sites={sites} users={users} onClose={() => setOpenWoId(null)} onSave={saveWorkOrder} onUploadReport={uploadWOReport} role={user.role} />
        <NewWorkOrderModal open={!!newWODraft} preset={newWODraft} sites={visibleSitesFor(user, sites)} users={users} onClose={() => setNewWODraft(null)} onCreate={addWorkOrder} />
      </div>
    </MobileCtx.Provider>
  );
}

function AccessDenied() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, color: T.sub, gap: 8 }}>
      <ShieldCheck size={30} color={T.sub} />
      <div style={{ fontWeight: 700, color: T.ink }}>Restricted to Admin</div>
      <div style={{ fontSize: 13 }}>Your role doesn't have access to this section.</div>
    </div>
  );
}
