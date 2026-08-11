import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Load — pulls every table and reassembles the nested shape the app  */
/*  already works with (sites → rooms/racks/equipment → parts/pm)      */
/* ------------------------------------------------------------------ */
export async function fetchAll() {
  const [
    { data: users, error: uErr },
    { data: sitesRows, error: sErr },
    { data: rooms, error: rErr },
    { data: racks, error: rkErr },
    { data: equipment, error: eErr },
    { data: parts, error: pErr },
    { data: pm, error: pmErr },
    { data: workOrders, error: woErr },
  ] = await Promise.all([
    supabase.from("users").select("*").order("created_at"),
    supabase.from("sites").select("*").order("created_at"),
    supabase.from("rooms").select("*"),
    supabase.from("racks").select("*"),
    supabase.from("equipment").select("*"),
    supabase.from("parts").select("*"),
    supabase.from("pm_schedule").select("*"),
    supabase.from("work_orders").select("*").order("code"),
  ]);

  const firstError = uErr || sErr || rErr || rkErr || eErr || pErr || pmErr || woErr;
  if (firstError) throw firstError;

  // Soft-fail on equipment_types: this table only exists once
  // migration_custom_types.sql has been run, so don't break the whole
  // app's data load if it's missing yet — just fall back to no custom
  // types until the migration is run.
  let customTypes = [];
  try {
    const { data, error } = await supabase.from("equipment_types").select("name").order("created_at");
    if (!error) customTypes = (data || []).map((t) => t.name);
  } catch (e) { /* table not migrated yet — ignore */ }

  const usersOut = (users || []).map((u) => ({ id: u.id, name: u.name, role: u.role, initials: u.initials, email: u.email }));

  const sites = (sitesRows || []).map((s) => {
    const siteRooms = (rooms || []).filter((r) => r.site_id === s.id).map((r) => ({
      id: r.id, name: r.name, grid: { w: r.grid_w, h: r.grid_h },
    }));
    const siteRacks = (racks || []).filter((r) => r.site_id === s.id).map((r) => ({
      id: r.id, name: r.name, roomId: r.room_id,
    }));
    const siteEquipment = (equipment || []).filter((e) => e.site_id === s.id).map((e) => ({
      id: e.id, code: e.code, name: e.name, type: e.type, roomId: e.room_id, rackId: e.rack_id,
      status: e.status, installYear: e.install_year, make: e.make, model: e.model, serial: e.serial,
      barcode: e.barcode, category: e.category, account: e.account, chargeDept: e.charge_dept,
      notes: e.notes, location: e.location, report: e.report,
      pos: e.pos_x != null && e.pos_y != null ? { x: e.pos_x, y: e.pos_y } : undefined,
      customFields: e.custom_fields || [],
      parts: (parts || []).filter((p) => p.equipment_id === e.id).map((p) => ({
        id: p.id, name: p.name, installedDate: p.installed_date, lifetimeMonths: p.lifetime_months,
      })),
      pm: (pm || []).filter((x) => x.equipment_id === e.id).map((x) => ({
        id: x.id, date: x.date, type: x.type, mop: x.mop, assignedTo: x.assigned_to, status: x.status,
      })),
    }));
    return { id: s.id, name: s.name, loc: s.loc, cap: Number(s.cap), load: Number(s.load), itLoad: Number(s.it_load), rooms: siteRooms, racks: siteRacks, equipment: siteEquipment };
  });

  const workOrdersOut = (workOrders || []).map((w) => ({
    id: w.id, code: w.code, siteId: w.site_id, equipmentId: w.equipment_id, equipmentName: w.equipment_name,
    description: w.description, summary: w.summary, priority: w.priority, type: w.type, assignedTo: w.assigned_to,
    status: w.status, mop: w.mop, dueDate: w.due_date, suggestedStart: w.suggested_start, report: w.report,
    instructions: w.instructions || [], estLabor: w.est_labor, actLabor: w.act_labor,
    completedBy: w.completed_by, dateCompleted: w.date_completed,
  }));

  return { sites, workOrders: workOrdersOut, users: usersOut, customTypes };
}

/* ------------------------------------------------------------------ */
/*  Sites                                                               */
/* ------------------------------------------------------------------ */
export async function dbAddSite(site) {
  const { error } = await supabase.from("sites").insert({
    id: site.id, name: site.name, loc: site.loc, cap: site.cap, load: site.load, it_load: site.itLoad ?? 0,
  });
  if (error) throw error;
  if (site.rooms?.length) {
    await supabase.from("rooms").insert(site.rooms.map((r) => ({ id: r.id, site_id: site.id, name: r.name, grid_w: r.grid.w, grid_h: r.grid.h })));
  }
  if (site.racks?.length) {
    await supabase.from("racks").insert(site.racks.map((r) => ({ id: r.id, site_id: site.id, room_id: r.roomId, name: r.name })));
  }
}

export async function dbUpdateSite(siteId, fields) {
  const { error } = await supabase.from("sites").update({
    name: fields.name, loc: fields.loc, cap: fields.cap, load: fields.load, it_load: fields.itLoad,
  }).eq("id", siteId);
  if (error) throw error;
}

export async function dbDeleteSite(siteId) {
  const { error } = await supabase.from("sites").delete().eq("id", siteId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Rooms                                                               */
/* ------------------------------------------------------------------ */
export async function dbAddRoom(siteId, room) {
  const { error } = await supabase.from("rooms").insert({
    id: room.id, site_id: siteId, name: room.name, grid_w: room.grid.w, grid_h: room.grid.h,
  });
  if (error) throw error;
}

export async function dbDeleteRoom(roomId) {
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Equipment                                                           */
/* ------------------------------------------------------------------ */
export async function dbAddEquipment(siteId, eq) {
  const { error } = await supabase.from("equipment").insert({
    id: eq.id, site_id: siteId, room_id: eq.roomId, rack_id: eq.rackId, code: eq.code, name: eq.name,
    type: eq.type, status: eq.status, install_year: eq.installYear, make: eq.make, model: eq.model,
    serial: eq.serial, barcode: eq.barcode, category: eq.category, account: eq.account,
    charge_dept: eq.chargeDept, notes: eq.notes, location: eq.location, custom_fields: eq.customFields || [],
  });
  if (error) throw error;
}

export async function dbUpdateEquipment(eqId, fields) {
  const payload = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.location !== undefined) payload.location = fields.location;
  if (fields.category !== undefined) payload.category = fields.category;
  if (fields.account !== undefined) payload.account = fields.account;
  if (fields.chargeDept !== undefined) payload.charge_dept = fields.chargeDept;
  if (fields.make !== undefined) payload.make = fields.make;
  if (fields.model !== undefined) payload.model = fields.model;
  if (fields.serial !== undefined) payload.serial = fields.serial;
  if (fields.barcode !== undefined) payload.barcode = fields.barcode;
  if (fields.notes !== undefined) payload.notes = fields.notes;
  if (fields.customFields !== undefined) payload.custom_fields = fields.customFields;
  if (fields.report !== undefined) payload.report = fields.report;
  if (fields.roomId !== undefined) payload.room_id = fields.roomId;
  if (fields.pos !== undefined) { payload.pos_x = fields.pos.x; payload.pos_y = fields.pos.y; }
  const { error } = await supabase.from("equipment").update(payload).eq("id", eqId);
  if (error) throw error;
}

export async function dbDeleteEquipment(eqId) {
  const { error } = await supabase.from("equipment").delete().eq("id", eqId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Work orders                                                         */
/* ------------------------------------------------------------------ */
export async function dbUpdateWorkOrder(woId, fields) {
  const payload = {};
  if (fields.status !== undefined) payload.status = fields.status;
  if (fields.type !== undefined) payload.type = fields.type;
  if (fields.priority !== undefined) payload.priority = fields.priority;
  if (fields.suggestedStart !== undefined) payload.suggested_start = fields.suggestedStart;
  if (fields.summary !== undefined) payload.summary = fields.summary;
  if (fields.estLabor !== undefined) payload.est_labor = fields.estLabor;
  if (fields.actLabor !== undefined) payload.act_labor = fields.actLabor;
  if (fields.completedBy !== undefined) payload.completed_by = fields.completedBy;
  if (fields.dateCompleted !== undefined) payload.date_completed = fields.dateCompleted;
  if (fields.report !== undefined) payload.report = fields.report;
  const { error } = await supabase.from("work_orders").update(payload).eq("id", woId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Users                                                                */
/* ------------------------------------------------------------------ */
export async function dbAddUser(user) {
  const { error } = await supabase.from("users").insert({ id: user.id, name: user.name, role: user.role, initials: user.initials, email: user.email || null });
  if (error) throw error;
}

export async function dbUpdateUser(userId, fields) {
  const payload = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.role !== undefined) payload.role = fields.role;
  if (fields.initials !== undefined) payload.initials = fields.initials;
  if (fields.email !== undefined) payload.email = fields.email;
  const { error } = await supabase.from("users").update(payload).eq("id", userId);
  if (error) throw error;
}

export async function dbDeleteUser(userId) {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Equipment classifications (custom "types")                         */
/* ------------------------------------------------------------------ */
export async function dbAddEquipmentType(name) {
  const id = "type-" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { error } = await supabase.from("equipment_types").insert({ id, name: name.trim() });
  if (error) throw error;
}
