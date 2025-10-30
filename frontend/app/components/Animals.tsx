"use client";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "");

type Timeseries = { date: string; morning_liters: number; evening_liters: number };
type Animal = {
  _id?: string;
  name?: string;
  node_name?: string;
  photo_base64?: string;
  age?: number;
  description?: string;
  milk_yield_timeseries?: Timeseries[];
};

export function Animals() {
  const { data, mutate } = useSWR<Animal[]>(`${API}/animals`, fetcher);
  const [form, setForm] = useState<Animal>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  async function create() {
    await fetch(`${API}/animals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, milk_yield_timeseries: form.milk_yield_timeseries || [] }),
    });
    setForm({});
    setShowAdd(false);
    mutate();
  }

  async function update(a: Animal) {
    if (!a._id) return;
    await fetch(`${API}/animals/${a._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    });
    mutate();
  }

  async function remove(id?: string) {
    if (!id) return;
    await fetch(`${API}/animals/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="glass mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
        <h2 className="text-xl font-semibold">Animals</h2>
        <button
          className="group flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10"
          onClick={() => setShowAdd(true)}
          title="Add animal"
          aria-label="Add animal"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" className="fill-[color:var(--foreground)] opacity-80 transition group-hover:opacity-100">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92L14.06 7.1l.92.92L5.92 20.08zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          <span className="text-sm opacity-80">Add</span>
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/15 bg-black p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">Add Animal</div>
              <button className="rounded-lg px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setShowAdd(false)} aria-label="Close">✕</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-md border bg-transparent p-2" placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="rounded-md border bg-transparent p-2" placeholder="Node name (e.g., CHILD_1 or ESP_MAIN)" value={form.node_name || ""} onChange={(e) => setForm({ ...form, node_name: e.target.value })} />
              <input className="rounded-md border bg-transparent p-2" placeholder="Age" type="number" value={form.age ?? ""} onChange={(e) => setForm({ ...form, age: parseInt(e.target.value || "0") })} />
              <div className="flex items-center gap-2">
                <input className="w-full rounded-md border bg-transparent p-2" placeholder="Photo base64 (optional)" value={form.photo_base64 || ""} onChange={(e) => setForm({ ...form, photo_base64: e.target.value })} />
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white/20 px-3 py-2 text-sm dark:bg-white/10" title="Upload photo" aria-label="Upload photo">
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = reader.result as string;
                      setForm((f) => ({ ...f, photo_base64: result }));
                    };
                    reader.readAsDataURL(file);
                  }} />
                  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[color:var(--foreground)] opacity-80"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2zM8.5 11A2.5 2.5 0 1 1 11 8.5 2.5 2.5 0 0 1 8.5 11z"/></svg>
                </label>
              </div>
              <textarea className="rounded-md border bg-transparent p-2 sm:col-span-2" placeholder="Description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {form.photo_base64 ? (
                <div className="sm:col-span-2">
                  <div className="text-xs opacity-70">Preview</div>
                  <img
                    src={form.photo_base64.startsWith("data:") ? form.photo_base64 : `data:image/jpeg;base64,${form.photo_base64}`}
                    alt="Animal preview"
                    className="mt-1 h-40 w-full rounded-lg object-cover"
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg px-4 py-2 hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="rounded-lg bg-white/20 px-4 py-2 dark:bg-white/10" onClick={create}>Create</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {(data || []).map((a) => (
          <div key={a._id} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{a.name || a.node_name || "Unnamed"}</div>
                <div className="text-sm opacity-70">Node: {a.node_name || "—"}</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex items-center justify-center rounded-xl px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={async () => {
                    if (editingId === a._id) {
                      await update(a);
                      setEditingId(null);
                    } else {
                      setEditingId(a._id || null);
                    }
                  }}
                  title={editingId === a._id ? "Save edits" : "Edit"}
                  aria-label={editingId === a._id ? "Save edits" : "Edit"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[color:var(--foreground)] opacity-80">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92L14.06 7.1l.92.92L5.92 20.08zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
                <button
                  className="flex items-center justify-center rounded-xl px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={() => remove(a._id)}
                  title="Delete"
                  aria-label="Delete"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[color:var(--foreground)] opacity-80">
                    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                {a.photo_base64 ? (
                  <img
                    src={(a.photo_base64 || "").startsWith("data:") ? (a.photo_base64 as string) : `data:image/jpeg;base64,${a.photo_base64}`}
                    alt="Animal"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sm opacity-60 dark:bg-white/5">
                    No photo
                  </div>
                )}
                <div className="rounded-xl border border-white/15 bg-white/40 p-3 text-sm dark:bg-white/10">
                  <div className="grid grid-cols-2 gap-y-1">
                    <span className="opacity-70">Name</span>
                    <span className="font-medium">{a.name || "—"}</span>
                    <span className="opacity-70">Age</span>
                    <span className="font-medium">{a.age ?? "—"}</span>
                    <span className="opacity-70">ESP Node</span>
                    <span className="font-medium">{a.node_name || "—"}</span>
                  </div>
                </div>
              </div>
              <div>
                <MilkYieldEditor animal={a} onChange={() => mutate()} />
              </div>
            </div>

            {editingId === a._id ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className="rounded-md border bg-transparent p-2" value={a.name || ""} onChange={(e) => (a.name = e.target.value)} placeholder="Name" />
                <input className="rounded-md border bg-transparent p-2" value={a.node_name || ""} onChange={(e) => (a.node_name = e.target.value)} placeholder="Node name" />
                <input className="rounded-md border bg-transparent p-2" type="number" value={a.age ?? 0} onChange={(e) => (a.age = parseInt(e.target.value || "0"))} placeholder="Age" />
                <div className="flex items-center gap-2">
                  <input className="w-full rounded-md border bg-transparent p-2" value={a.photo_base64 || ""} onChange={(e) => (a.photo_base64 = e.target.value)} placeholder="Photo base64" />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-white/20 px-3 py-2 text-sm dark:bg-white/10" title="Upload photo" aria-label="Upload photo">
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result as string;
                        a.photo_base64 = result;
                        setTick((x) => x + 1);
                      };
                      reader.readAsDataURL(file);
                    }} />
                    <svg width="18" height="18" viewBox="0 0 24 24" className="fill-[color:var(--foreground)] opacity-80"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2zM8.5 11A2.5 2.5 0 1 1 11 8.5 2.5 2.5 0 0 1 8.5 11z"/></svg>
                  </label>
                </div>
                <textarea className="rounded-md border bg-transparent p-2 sm:col-span-2" value={a.description || ""} onChange={(e) => (a.description = e.target.value)} placeholder="Description" />
                {a.photo_base64 ? (
                  <div className="sm:col-span-2">
                    <div className="text-xs opacity-70">Preview</div>
                    <img
                      src={(a.photo_base64 || "").startsWith("data:") ? (a.photo_base64 as string) : `data:image/jpeg;base64,${a.photo_base64}`}
                      alt="Animal preview"
                      className="mt-1 h-40 w-full rounded-lg object-cover"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MilkYieldEditor({ animal, onChange }: { animal: Animal; onChange: () => void }) {
  const [morning, setMorning] = useState(0);
  const [evening, setEvening] = useState(0);
  const today = new Date();
  const isoDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const dateKey = isoDate.slice(0, 10);
  
  const arr = Array.isArray(animal.milk_yield_timeseries) ? animal.milk_yield_timeseries : [];
  const todayEntry = arr.find((e) => e.date?.slice(0, 10) === dateKey);

  async function save() {
    if (todayEntry) return; // already saved
    const newArr = [...arr];
    newArr.push({ date: isoDate, morning_liters: morning || 0, evening_liters: evening || 0 });
    await fetch(`${API}/animals/${animal._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milk_yield_timeseries: newArr }),
    });
    setMorning(0);
    setEvening(0);
    onChange();
  }

  if (todayEntry) {
    return (
      <div className="mt-3 rounded-xl border border-white/15 bg-white/50 p-3 dark:bg-white/10">
        <div className="mb-2 text-sm font-medium">Today's Milk Yield (Locked)</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <span className="opacity-70">Morning:</span> <span className="font-medium">{todayEntry.morning_liters || 0}L</span>
          </div>
          <div className="text-sm">
            <span className="opacity-70">Evening:</span> <span className="font-medium">{todayEntry.evening_liters || 0}L</span>
          </div>
          <div className="text-xs opacity-70">Entry saved and locked for today.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-white/15 bg-white/50 p-3 dark:bg-white/10">
      <div className="mb-2 text-sm font-medium">Add Milk Yield (today)</div>
      <div className="flex flex-wrap items-center gap-3">
        <input className="w-32 rounded-md border bg-transparent p-2" type="number" placeholder="Morning (L)" value={morning} onChange={(e) => setMorning(parseFloat(e.target.value || "0"))} />
        <input className="w-32 rounded-md border bg-transparent p-2" type="number" placeholder="Evening (L)" value={evening} onChange={(e) => setEvening(parseFloat(e.target.value || "0"))} />
        <button className="rounded-md bg-white/20 px-3 py-2 text-sm dark:bg-white/10" onClick={save}>Save for today</button>
        <div className="text-xs opacity-70">Note: cannot edit past days; missing entries default to 0.</div>
      </div>
    </div>
  );
}


