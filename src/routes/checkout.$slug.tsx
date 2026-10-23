import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, Headphones, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { productBySlugQuery } from "@/lib/catalog";
import { effectivePrice, formatPrice } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { useSiteSettings, upiLink } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout/$slug")({
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Complete your UPI payment and submit payment confirmation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useSession();
  const product = useQuery(productBySlugQuery(slug));
  const siteSettings = useSiteSettings();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    whatsapp: "",
    delivery_address: "",
    delivery_city: "",
    delivery_state: "",
    delivery_postal_code: "",
    delivery_country: "India",
    transaction_id: "",
    amount: "",
    confirm: false,
  });
  const [file, setFile] = useState<File | null>(null);

  const p = product.data;
  const amount = p ? effectivePrice(p) : 0;
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; total: number; label: string | null } | null>(null);
  const couponRpc = supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
  const payableAmount = appliedCoupon?.total ?? amount;

  const applyCoupon = async () => {
    if (!p || !couponCode.trim()) return toast.error("Enter a coupon code.");
    setCouponLoading(true);
    try {
      const { data, error } = await couponRpc.rpc("validate_coupon", { p_code: couponCode.trim(), p_product_id: p.id, p_subtotal: amount });
      if (error) throw new Error(error.message);
      const quote = data as { valid?: boolean; error?: string; code?: string; label?: string | null; discountAmount?: number; total?: number };
      if (!quote?.valid) {
        const messages: Record<string, string> = {
          COUPON_NOT_FOUND: "That coupon code is not valid.", COUPON_EXPIRED: "This coupon is not currently active.",
          MIN_SUBTOTAL_NOT_MET: "Your order does not meet this coupon’s minimum subtotal.", USAGE_LIMIT_REACHED: "This coupon has reached its usage limit.",
          NOT_ELIGIBLE_FOR_CART: "This coupon does not apply to this product.", COUPON_NOT_STACKABLE: "This coupon cannot be combined with another offer.",
        };
        throw new Error(messages[quote?.error ?? ""] ?? "This coupon cannot be applied.");
      }
      const total = Number(quote.total ?? amount);
      if (total <= 0) throw new Error("This checkout requires a payment; this coupon cannot reduce the order to zero.");
      setAppliedCoupon({ code: quote.code ?? couponCode.trim().toUpperCase(), discountAmount: Number(quote.discountAmount ?? 0), total, label: quote.label ?? null });
      setForm((current) => ({ ...current, amount: total.toFixed(2) }));
      toast.success("Coupon applied.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply coupon.");
    } finally { setCouponLoading(false); }
  };
  const removeCoupon = () => {
    setAppliedCoupon(null); setCouponCode(""); setForm((current) => ({ ...current, amount: amount.toFixed(2) }));
    toast.message("Coupon removed.");
  };
  

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name,email,whatsapp")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setForm((f) => ({
          ...f,
          full_name: f.full_name || data?.full_name || "",
          email: f.email || data?.email || user.email || "",
          whatsapp: f.whatsapp || data?.whatsapp || "",
        }));
      });
  }, [user]);

  useEffect(() => {
    if (p) setForm((f) => ({ ...f, amount: f.amount || String(effectivePrice(p)) }));
  }, [p]);

  if (product.isLoading || authLoading) {
    return (
      <div className="page-container section-y">
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  if (!p || p.is_free) {
    return (
      <div className="page-container section-y">
        <EmptyState
          title="Product unavailable"
          description="This resource can't be purchased right now."
          action={
            <Button asChild>
              <Link to="/shop">Back to shop</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container section-y">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold">Create an account to continue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An account lets us match your payment to your order and deliver your material.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="sm:flex-1" asChild>
              <Link to="/register" search={{ redirect: `/checkout/${slug}` }}>
                Register
              </Link>
            </Button>
            <Button variant="outline" className="sm:flex-1" asChild>
              <Link to="/login" search={{ redirect: `/checkout/${slug}` }}>
                Login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-container section-y">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          <h1 className="mt-4 font-serif text-2xl font-semibold">Payment confirmation received.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {p.product_type === "physical" ? `We will verify your payment and prepare your order for delivery to the shipping address you provided. ${siteSettings.deliveryEstimate ? `${siteSettings.deliveryEstimate}.` : ""}` : "We will verify your payment and prepare your digital PDF for delivery."}
          </p>
          <div className="mt-5 rounded-lg border border-border bg-surface p-4 text-left text-sm">
            <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> Your payment is reviewed manually before delivery.</p>
            <p className="mt-2 flex gap-2"><Headphones className="h-4 w-4 shrink-0 text-accent" /> Need help? Use the Contact page and mention your order details.</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Your payment is not confirmed until our team verifies it.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/shop">Continue browsing</Link>
            </Button>
            <Button
  variant="outline"
  onClick={() => navigate({ to: "/shop" })}
>
  Continue shopping
</Button>
          </div>
        </div>
      </div>
    );
  }

  const copyUpi = async () => {
  try {
    await navigator.clipboard.writeText(siteSettings.upiId);
    toast.success("UPI ID copied");
  } catch {
    toast.error("Could not copy. Please note the UPI ID manually.");
  }
};

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against duplicate submits even if multiple click/submit events arrive
    // before React has re-rendered the disabled state.
    if (saving) return;
    setError(null);

    const paid = Number(form.amount);
    if (!form.full_name.trim() || form.full_name.length > 100) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^[0-9+\-\s]{8,16}$/.test(form.whatsapp)) {
      setError("Please enter a valid WhatsApp number.");
      return;
    }
    if (p.product_type === "physical" && (!form.delivery_address.trim() || form.delivery_address.trim().length > 300)) {
      setError("Please enter your complete delivery address.");
      return;
    }
    if (p.product_type === "physical" && (!form.delivery_city.trim() || !form.delivery_state.trim())) {
      setError("Please enter your city and state.");
      return;
    }
    if (p.product_type === "physical" && !/^[0-9]{5,10}$/.test(form.delivery_postal_code.trim())) {
      setError("Please enter a valid postal PIN code.");
      return;
    }
    if (p.product_type === "physical" && !form.delivery_country.trim()) {
      setError("Please enter your country.");
      return;
    }
    if (!/^[a-zA-Z0-9]{6,30}$/.test(form.transaction_id.trim())) {
      setError("Please enter a valid UPI transaction ID / UTR (6–30 letters or digits).");
      return;
    }
    if (!paid || paid <= 0) {
      setError("Please enter the amount you paid.");
      return;
    }
    if (!form.confirm) {
      setError("Please confirm that you have completed the payment and agree to the Terms & Conditions.");
      return;
    }

    setSaving(true);
    try {
      let screenshotPath: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
        const { error: upErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError("We couldn't upload your screenshot. You can submit without it.");
          setSaving(false);
          return;
        }
        screenshotPath = path;
      }

      const order = {
        user_id: user.id,
        product_id: p.id,
        product_type: p.product_type,
        product_title: p.title,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        whatsapp: form.whatsapp.trim(),
        delivery_address: p.product_type === "physical" ? form.delivery_address.trim() : null,
        delivery_city: p.product_type === "physical" ? form.delivery_city.trim() : null,
        delivery_state: p.product_type === "physical" ? form.delivery_state.trim() : null,
        delivery_postal_code: p.product_type === "physical" ? form.delivery_postal_code.trim() : null,
        delivery_country: p.product_type === "physical" ? form.delivery_country.trim() : null,
        amount: paid,
        coupon_code: appliedCoupon?.code ?? null,
        coupon_discount: appliedCoupon?.discountAmount ?? 0,
        payment_method: "UPI",
        transaction_id: form.transaction_id.trim(),
        screenshot_path: screenshotPath,
        payment_status: "submitted" as const,
        order_status: "payment_submitted" as const,
      };
      const orderWriter = supabase as unknown as { from: (table: "orders") => { insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } };
      const { error: insertError } = await orderWriter.from("orders").insert(order);
      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("COUPON_") || message.includes("NOT_ELIGIBLE_FOR_CART")) {
        setAppliedCoupon(null);
        setError("The coupon is no longer eligible. Please reapply it and confirm the updated payment amount.");
      } else {
        setError("We couldn't submit your confirmation. Please try again or contact support.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-y">
      <div className="page-container max-w-5xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/shop/$slug", params: { slug } })}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to product
        </button>
        <h1 className="mt-3 text-3xl font-bold">Complete your order</h1>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Payment instructions</h2>
            <div className="mt-4 rounded-md border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{p.title}</p>
              <p className="mt-1 text-muted-foreground">
                Amount payable: <span className="font-semibold text-foreground">{formatPrice(payableAmount)}</span>{appliedCoupon && <span className="ml-2 text-xs text-success">({formatPrice(appliedCoupon.discountAmount)} saved)</span>}
              </p>
            </div>

            <ol className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>1. Scan the QR code below with any UPI app, or pay to the UPI ID.</li>
              <li>2. Pay exactly {formatPrice(payableAmount)}.</li>
              <li>3. Return here and submit the payment confirmation form.</li>
            </ol>

            <div className="mt-5 flex flex-col items-center gap-4 rounded-md border border-border bg-background p-5">
              {siteSettings.qrCodeUrl ? (
                <img
                  src={siteSettings.qrCodeUrl}
                  alt="UPI QR code for Edu Wallet"
                  className="h-56 w-56"
                />
              ) : (
                <QRCodeSVG
                  value={upiLink(
  siteSettings.upiId,
  siteSettings.upiPayeeName,
  payableAmount,
  p.title.slice(0, 40)
)}
                />
              )}
              <div className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="truncate text-sm font-medium">{siteSettings.upiId}</span>
                <Button type="button" variant="ghost" size="sm" onClick={copyUpi}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy
                </Button>
              </div>
              <a
               href={upiLink(
  siteSettings.upiId,
  siteSettings.upiPayeeName,
  amount,
  p.title.slice(0, 40)
)}
                className="text-sm font-medium text-primary hover:underline sm:hidden"
              >
                Open UPI app
              </a>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Delivery & payment details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.product_type === "physical" ? "Enter the shipping address for your physical book or printed notes, then submit payment details." : "Submit your payment details to order this digital PDF."}
            </p>

            <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
              <div className="rounded-lg border border-border bg-surface p-3">
                <Label htmlFor="coupon-code">Coupon code</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input id="coupon-code" value={couponCode} disabled={!!appliedCoupon || couponLoading} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" maxLength={64} />
                  {appliedCoupon ? <Button type="button" variant="outline" onClick={removeCoupon}>Remove</Button> : <Button type="button" variant="outline" disabled={couponLoading || !couponCode.trim()} onClick={() => void applyCoupon()}>{couponLoading ? "Checking…" : "Apply"}</Button>}
                </div>
                {appliedCoupon && <p className="mt-2 text-sm text-success">{appliedCoupon.label || appliedCoupon.code} applied — you save {formatPrice(appliedCoupon.discountAmount)}.</p>}
              </div>
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="mt-1.5 h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp number</Label>
                <Input
                  id="whatsapp"
                  inputMode="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  className="mt-1.5 h-11"
                  required
                />
              </div>
              {p.product_type === "physical" && <>
                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold">Shipping address</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Use the complete address where the courier should deliver your order.</p>
                </div>
                <div>
                  <Label htmlFor="delivery_address">House / street / locality</Label>
                  <Input id="delivery_address" value={form.delivery_address} maxLength={300} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} className="mt-1.5 h-11" autoComplete="street-address" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="delivery_city">City / town</Label>
                    <Input id="delivery_city" value={form.delivery_city} onChange={(e) => setForm({ ...form, delivery_city: e.target.value })} className="mt-1.5 h-11" autoComplete="address-level2" required />
                  </div>
                  <div>
                    <Label htmlFor="delivery_state">State</Label>
                    <Input id="delivery_state" value={form.delivery_state} onChange={(e) => setForm({ ...form, delivery_state: e.target.value })} className="mt-1.5 h-11" autoComplete="address-level1" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="delivery_postal_code">PIN code</Label>
                    <Input id="delivery_postal_code" inputMode="numeric" value={form.delivery_postal_code} maxLength={10} onChange={(e) => setForm({ ...form, delivery_postal_code: e.target.value })} className="mt-1.5 h-11" autoComplete="postal-code" required />
                  </div>
                  <div>
                    <Label htmlFor="delivery_country">Country</Label>
                    <Input id="delivery_country" value={form.delivery_country} onChange={(e) => setForm({ ...form, delivery_country: e.target.value })} className="mt-1.5 h-11" autoComplete="country-name" required />
                  </div>
                </div>
              </>}
              <div>
                <Label htmlFor="amount">Amount paid (₹)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1.5 h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="txn">UPI transaction ID / UTR</Label>
                <Input
                  id="txn"
                  value={form.transaction_id}
                  onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                  className="mt-1.5 h-11"
                  required
                />
              </div>
              <div>
                <Label htmlFor="proof">Payment screenshot (optional)</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="confirm"
                  checked={form.confirm}
                  onCheckedChange={(v) => setForm({ ...form, confirm: v === true })}
                />
                <Label htmlFor="confirm" className="text-sm leading-snug font-normal">
                  I confirm that I have completed this UPI payment, the details above are correct,
                  and I agree to the{" "}
                  <Link to="/terms" target="_blank" className="font-medium text-primary hover:underline">
                    Terms & Conditions
                  </Link>.
                </Label>
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={saving}>
                {saving ? "Submitting..." : "Submit Payment Confirmation"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Submitting this form does not confirm payment. Your order is marked as verified
                only after our team checks the transaction.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
