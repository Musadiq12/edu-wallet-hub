import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Copy, Loader2, Plus, Save, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminProductsQuery, type AdminProduct } from "@/lib/admin";
import { categoriesQuery } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/coupons/")({ component: AdminCoupons });

type CouponTarget = { targetType: "ALL_PRODUCTS" | "PRODUCT" | "CATEGORY"; targetId: string | null; mode: "INCLUDE" | "EXCLUDE" };
type Coupon = {
  id: string; code: string; description: string | null; publicLabel: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING"; discountValue: number;
  maxDiscountAmount: number | null; minSubtotal: number; startsAt: string | null; endsAt: string | null;
  totalUsageLimit: number | null; perCustomerLimit: number; usageCount: number; firstOrderOnly: boolean;
  stackable: boolean; priority: number; status: string; createdAt: string; targets: CouponTarget[];
};
type CouponDraft = {
  code: string; description: string; publicLabel: string; discountType: Coupon["discountType"];
  discountValue: string; maxDiscountAmount: string; minSubtotal: string; startsAt: string; endsAt: string;
  totalUsageLimit: string; perCustomerLimit: string; firstOrderOnly: boolean; stackable: boolean; status: string;
};
const emptyDraft: CouponDraft = {
  code: "", description: "", publicLabel: "", discountType: "PERCENTAGE", discountValue: "10",
  maxDiscountAmount: "", minSubtotal: "0", startsAt: "", endsAt: "", totalUsageLimit: "",
  perCustomerLimit: "1", firstOrderOnly: false, stackable: false, status: "DRAFT",
};
const rpc = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function AdminCoupons() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(emptyDraft);
  const [targets, setTargets] = useState<CouponTarget[]>([{ targetType: "ALL_PRODUCTS", targetId: null, mode: "INCLUDE" }]);
  const [targetType, setTargetType] = useState<"PRODUCT" | "CATEGORY" | "ALL_PRODUCTS">("PRODUCT");
  const [targetId, setTargetId] = useState("");
  const [targetMode, setTargetMode] = useState<"INCLUDE" | "EXCLUDE">("INCLUDE");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const coupons = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await rpc.rpc("admin_list_coupons");
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as Coupon[];
    },
  });
  const products = useQuery(adminProductsQuery(true));
  const categories = useQuery(categoriesQuery());
  const productOptions = (products.data ?? []) as AdminProduct[];
  const categoryOptions = categories.data ?? [];
  const visible = useMemo(() => (coupons.data ?? []).filter((coupon) =>
    (!search || coupon.code.toLowerCase().includes(search.toLowerCase())) &&
    (filter === "ALL" || coupon.status === filter)
  ), [coupons.data, search, filter]);

  function startNew() {
    setEditing(null); setDraft({ ...emptyDraft, code: `SAVE${Math.random().toString(36).slice(2, 6).toUpperCase()}` });
    setTargets([{ targetType: "ALL_PRODUCTS", targetId: null, mode: "INCLUDE" }]);
  }
  function startEdit(coupon: Coupon) {
    setEditing(coupon);
    setDraft({
      code: coupon.code, description: coupon.description ?? "", publicLabel: coupon.publicLabel ?? "",
      discountType: coupon.discountType, discountValue: String(coupon.discountValue),
      maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount),
      minSubtotal: String(coupon.minSubtotal ?? 0), startsAt: coupon.startsAt?.slice(0, 16) ?? "",
      endsAt: coupon.endsAt?.slice(0, 16) ?? "", totalUsageLimit: coupon.totalUsageLimit == null ? "" : String(coupon.totalUsageLimit),
      perCustomerLimit: String(coupon.perCustomerLimit ?? 1), firstOrderOnly: coupon.firstOrderOnly,
      stackable: coupon.stackable, status: coupon.status,
    });
    setTargets(coupon.targets ?? []);
  }
  function addTarget() {
    const next: CouponTarget = { targetType, targetId: targetType === "ALL_PRODUCTS" ? null : targetId, mode: targetMode };
    if (next.targetType !== "ALL_PRODUCTS" && !next.targetId) return toast.error("Select a product or category first.");
    if (targets.some((t) => t.targetType === next.targetType && t.targetId === next.targetId && t.mode === next.mode)) return;
    setTargets((current) => [...current.filter((t) => !(t.targetType === "ALL_PRODUCTS" && t.mode === "INCLUDE")), next]);
    setTargetId("");
  }
  async function saveCoupon(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.code.trim()) return toast.error("Enter a coupon code.");
    if (draft.discountType !== "FREE_SHIPPING" && !(Number(draft.discountValue) > 0)) return toast.error("Enter a valid discount value.");
    if (targets.length === 0 || !targets.some((t) => t.mode === "INCLUDE")) return toast.error("Add at least one included target.");
    setSaving(true);
    try {
      const payload = {
        ...draft, code: draft.code.trim().toUpperCase(), discountValue: draft.discountType === "FREE_SHIPPING" ? 0 : Number(draft.discountValue),
        maxDiscountAmount: draft.maxDiscountAmount, minSubtotal: Number(draft.minSubtotal || 0),
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : "",
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : "",
        totalUsageLimit: draft.totalUsageLimit, perCustomerLimit: Number(draft.perCustomerLimit || 1),
      };
      const { error } = await rpc.rpc("admin_save_coupon", { p_coupon: payload, p_targets: targets, p_coupon_id: editing?.id ?? null });
      if (error) throw new Error(error.message);
      toast.success(editing ? "Coupon updated." : "Coupon created.");
      setEditing(null); setDraft(emptyDraft); setTargets([{ targetType: "ALL_PRODUCTS", targetId: null, mode: "INCLUDE" }]);
      await qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save coupon.");
    } finally { setSaving(false); }
  }
  async function setStatus(coupon: Coupon, status: string) {
    const label = status === "DISABLED" ? "disable" : "activate";
    if (!window.confirm(`Are you sure you want to ${label} ${coupon.code}?`)) return;
    const { error } = await rpc.rpc("admin_set_coupon_status", { p_coupon_id: coupon.id, p_status: status });
    if (error) return toast.error(error.message);
    toast.success(`Coupon ${status.toLowerCase()}.`);
    await qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
  }
  function targetLabel(target: CouponTarget) {
    if (target.targetType === "ALL_PRODUCTS") return "All products";
    if (target.targetType === "PRODUCT") return productOptions.find((p) => p.id === target.targetId)?.title ?? "Product";
    return categoryOptions.find((c) => c.id === target.targetId)?.name ?? "Category";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">Admin / Marketing</p><h1 className="text-2xl font-semibold">Coupons & discounts</h1><p className="mt-1 text-sm text-muted-foreground">Create product- and category-scoped offers. Only admins can manage coupons.</p></div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" /> New coupon</Button>
      </div>

      {draft.code !== emptyDraft.code && (
        <form onSubmit={saveCoupon} className="space-y-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{editing ? `Edit ${editing.code}` : "Create coupon"}</h2><Button type="button" variant="ghost" size="icon" onClick={() => { setDraft(emptyDraft); setEditing(null); }} aria-label="Close form"><X className="h-4 w-4" /></Button></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="coupon-code">Coupon code</Label><div className="flex gap-2"><Input id="coupon-code" value={draft.code} maxLength={64} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/\s/g, "") })} required /><Button type="button" variant="outline" onClick={() => setDraft({ ...draft, code: `SAVE${Math.random().toString(36).slice(2, 7).toUpperCase()}` })} aria-label="Generate code"><Ticket className="h-4 w-4" /></Button></div></div>
            <div className="space-y-2"><Label htmlFor="coupon-label">Public label</Label><Input id="coupon-label" value={draft.publicLabel} onChange={(e) => setDraft({ ...draft, publicLabel: e.target.value })} placeholder="10% off selected notes" /></div>
            <div className="space-y-2"><Label htmlFor="coupon-status">Status</Label><select id="coupon-status" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{["DRAFT","ACTIVE","SCHEDULED","DISABLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="coupon-type">Discount type</Label><select id="coupon-type" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.discountType} onChange={(e) => setDraft({ ...draft, discountType: e.target.value as CouponDraft["discountType"], discountValue: e.target.value === "FREE_SHIPPING" ? "0" : draft.discountValue })}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount (₹)</option><option value="FREE_SHIPPING">Free shipping</option></select></div>
            <div className="space-y-2"><Label htmlFor="coupon-value">Discount value {draft.discountType === "PERCENTAGE" ? "(%)" : "(₹)"}</Label><Input id="coupon-value" type="number" min="0" max={draft.discountType === "PERCENTAGE" ? 100 : undefined} step="0.01" value={draft.discountValue} disabled={draft.discountType === "FREE_SHIPPING"} onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-cap">Maximum discount (₹)</Label><Input id="coupon-cap" type="number" min="0" step="0.01" value={draft.maxDiscountAmount} onChange={(e) => setDraft({ ...draft, maxDiscountAmount: e.target.value })} placeholder="No cap" /></div>
            <div className="space-y-2"><Label htmlFor="coupon-min">Minimum subtotal (₹)</Label><Input id="coupon-min" type="number" min="0" step="0.01" value={draft.minSubtotal} onChange={(e) => setDraft({ ...draft, minSubtotal: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-start">Starts at</Label><Input id="coupon-start" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-end">Ends at</Label><Input id="coupon-end" type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-limit">Total uses</Label><Input id="coupon-limit" type="number" min="1" value={draft.totalUsageLimit} onChange={(e) => setDraft({ ...draft, totalUsageLimit: e.target.value })} placeholder="Unlimited" /></div>
            <div className="space-y-2"><Label htmlFor="coupon-customer-limit">Uses per customer</Label><Input id="coupon-customer-limit" type="number" min="1" value={draft.perCustomerLimit} onChange={(e) => setDraft({ ...draft, perCustomerLimit: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="coupon-description">Internal description</Label><Input id="coupon-description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Campaign notes" /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.firstOrderOnly} onChange={(e) => setDraft({ ...draft, firstOrderOnly: e.target.checked })} /> First order only</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.stackable} onChange={(e) => setDraft({ ...draft, stackable: e.target.checked })} /> Stackable (reserved for multi-coupon cart)</label></div>
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h3 className="font-medium">Applies to</h3>
            <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_1fr_auto]">
              <select aria-label="Target type" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={targetType} onChange={(e) => { const v = e.target.value as typeof targetType; setTargetType(v); setTargetId(""); }}><option value="PRODUCT">Product</option><option value="CATEGORY">Category</option><option value="ALL_PRODUCTS">All products</option></select>
              <select aria-label="Target item" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={targetId} disabled={targetType === "ALL_PRODUCTS"} onChange={(e) => setTargetId(e.target.value)}><option value="">Choose {targetType.toLowerCase()}</option>{targetType === "PRODUCT" ? productOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>) : targetType === "CATEGORY" ? categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : null}</select>
              <select aria-label="Target inclusion" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={targetMode} onChange={(e) => setTargetMode(e.target.value as typeof targetMode)}><option value="INCLUDE">Include</option><option value="EXCLUDE">Exclude</option></select>
              <Button type="button" variant="outline" onClick={addTarget}>Add target</Button>
            </div>
            <div className="flex flex-wrap gap-2">{targets.map((target, index) => <Badge key={`${target.targetType}-${target.targetId}-${target.mode}-${index}`} variant="secondary" className="gap-2">{target.mode === "EXCLUDE" ? "Exclude: " : "Include: "}{targetLabel(target)}<button type="button" aria-label="Remove target" onClick={() => setTargets((current) => current.filter((_, i) => i !== index))}><X className="h-3 w-3" /></button></Badge>)}</div>
            <p className="text-xs text-muted-foreground">Only product, category, and all-products targets are enabled because the current catalog has no variant or brand tables.</p>
          </section>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setDraft(emptyDraft); setEditing(null); }}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editing ? "Save changes" : "Create coupon"}</Button></div>
        </form>
      )}

      <div className="flex flex-wrap gap-3"><Input aria-label="Search coupon code" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search coupon code…" className="max-w-sm" /><select aria-label="Filter coupon status" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>{["ALL","ACTIVE","DRAFT","SCHEDULED","EXPIRED","DISABLED"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {coupons.isLoading ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading coupons…</div> : coupons.isError ? <div className="rounded-lg border border-destructive/40 p-6 text-sm">Could not load coupons. Confirm the coupon database migration has been applied and your account has admin access.</div> : visible.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><BadgePercent className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No coupons found</h2><p className="mt-1 text-sm text-muted-foreground">Create a coupon and choose exactly which products or categories it applies to.</p><Button className="mt-4" onClick={startNew}>Create coupon</Button></div> : (
        <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted/80"><tr>{["Coupon","Discount","Targets","Usage","Status","Actions"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visible.map((coupon) => <tr key={coupon.id} className="border-t border-border"><td className="px-4 py-3"><div className="flex items-center gap-2 font-semibold">{coupon.code}<button type="button" title="Copy coupon code" onClick={() => { void navigator.clipboard.writeText(coupon.code).then(() => toast.success("Code copied")).catch(() => toast.error("Could not copy code")); }}><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button></div><p className="text-xs text-muted-foreground">{coupon.publicLabel || coupon.description || "No description"}</p></td><td className="px-4 py-3">{coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : coupon.discountType === "FIXED_AMOUNT" ? `₹${coupon.discountValue}` : "Free shipping"}</td><td className="px-4 py-3"><div className="flex max-w-xs flex-wrap gap-1">{(coupon.targets ?? []).map((t, i) => <Badge key={i} variant="outline">{t.mode === "EXCLUDE" ? "− " : "+ "}{targetLabel(t)}</Badge>)}</div></td><td className="px-4 py-3 tabular-nums">{coupon.usageCount}{coupon.totalUsageLimit ? ` / ${coupon.totalUsageLimit}` : " / ∞"}</td><td className="px-4 py-3"><Badge variant={coupon.status === "ACTIVE" ? "default" : "secondary"}>{coupon.status}</Badge></td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(coupon)}>Edit</Button><Button size="sm" variant="outline" onClick={() => void setStatus(coupon, coupon.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}>{coupon.status === "ACTIVE" ? "Disable" : "Activate"}</Button></div></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
