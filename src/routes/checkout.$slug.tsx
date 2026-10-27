import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Headphones, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { productBySlugQuery } from "@/lib/catalog";
import { effectivePrice, formatPrice } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { useSiteSettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";

type CouponQuote = {
  valid?: boolean;
  error?: string;
  code?: string;
  label?: string | null;
  discountAmount?: number;
  total?: number;
  checkoutPending?: boolean;
  checkoutOrderId?: string;
  checkoutDetails?: {
    fullName?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    deliveryAddress?: string | null;
    deliveryCity?: string | null;
    deliveryState?: string | null;
    deliveryPostalCode?: string | null;
    deliveryCountry?: string | null;
  };
};

type AppliedCoupon = {
  code: string;
  discountAmount: number;
  total: number;
  label: string | null;
  checkoutPending?: boolean;
};

const COUPON_ERROR_MESSAGES: Record<string, string> = {
  COUPON_NOT_FOUND: "That coupon code is not valid.",
  COUPON_EXPIRED: "This coupon is not currently active.",
  MIN_SUBTOTAL_NOT_MET: "Your order does not meet this coupon’s minimum subtotal.",
  USAGE_LIMIT_REACHED: "This coupon has reached its total usage limit.",
  COUPON_ALREADY_USED: "You have already used this coupon. It can only be used once per customer.",
  COUPON_CUSTOMER_LIMIT_REACHED: "You have reached the allowed number of uses for this coupon.",
  COUPON_CHECKOUT_PENDING: "You already have an unfinished checkout using this coupon. Resume that checkout instead of starting another.",
  NOT_ELIGIBLE_FOR_CART: "This coupon does not apply to this product.",
  COUPON_NOT_STACKABLE: "This coupon cannot be combined with another offer.",
};

function couponErrorMessage(code?: string) {
  return (code && COUPON_ERROR_MESSAGES[code]) || "This coupon cannot be applied.";
}

async function validateCouponCode(code: string, productId: string, subtotal: number): Promise<CouponQuote> {
  const couponClient = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await couponClient.rpc("validate_coupon", {
    p_code: code,
    p_product_id: productId,
    p_subtotal: subtotal,
  });
  if (error) throw new Error(error.message);
  return data as CouponQuote;
}

function clearCheckoutRequestKey(attemptKey: string | null) {
  if (!attemptKey) return;
  try {
    window.sessionStorage.removeItem(attemptKey);
  } catch {
    // A blocked sessionStorage must not interrupt checkout.
  }
}

function clearStoredCheckout(attemptKey: string | null, couponKey: string | null) {
  clearCheckoutRequestKey(attemptKey);
  if (!couponKey) return;
  try {
    window.sessionStorage.removeItem(couponKey);
  } catch {
    // A blocked sessionStorage must not interrupt checkout.
  }
}

export const Route = createFileRoute("/checkout/$slug")({
  head: () => ({
    meta: [
      { title: buildTitle(["Checkout", BRAND]) },
      { name: "description", content: "Securely complete your order using Razorpay." },
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
  const [submittedOrderId, setSubmittedOrderId] = useState<string | null>(null);

  // Keep the same checkout request ID across refreshes/retries; changing any checkout value starts a new attempt.
  const checkoutAttemptKey = user ? `eduwallet:checkout-attempt:${user.id}:${slug}` : null;
  const couponStorageKey = user ? `eduwallet:checkout-coupon:${user.id}:${slug}` : null;
  const clearCheckoutRequest = () => clearCheckoutRequestKey(checkoutAttemptKey);
  const clearCheckoutAttempt = () => clearStoredCheckout(checkoutAttemptKey, couponStorageKey);
  const [saving, setSaving] = useState(false);
  const [couponRestoring, setCouponRestoring] = useState(false);
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
  });

  const p = product.data;
  const amount = p ? effectivePrice(p) : 0;
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const payableAmount = appliedCoupon?.total ?? amount;

  const applyCoupon = async () => {
    if (!p || !couponCode.trim()) return toast.error("Enter a coupon code.");
    const requestedCode = couponCode.trim().toUpperCase();
    if (appliedCoupon?.code.toUpperCase() === requestedCode) {
      return toast.message("This coupon is already applied.");
    }
    if (couponRestoring) return;
    setCouponLoading(true);
    let couponWasRejected = false;
    try {
      const quote = await validateCouponCode(requestedCode, p.id, amount);
      if (!quote?.valid) {
        couponWasRejected = true;
        throw new Error(couponErrorMessage(quote?.error));
      }
      const total = Number(quote.total ?? amount);
      if (!Number.isFinite(total) || total <= 0) {
        couponWasRejected = true;
        throw new Error("This checkout requires a payment; this coupon cannot reduce the order to zero.");
      }

      const nextCode = quote.code ?? requestedCode;
      let previouslyAppliedCode: string | null = null;
      try {
        previouslyAppliedCode = couponStorageKey ? window.sessionStorage.getItem(couponStorageKey) : null;
      } catch {
        // Continue without persisted checkout recovery.
      }
      // Reapplying the same reserved coupon must keep the original idempotency key.
      if (previouslyAppliedCode?.trim().toUpperCase() !== nextCode.trim().toUpperCase()) {
        clearCheckoutRequest();
      }

      const nextCoupon: AppliedCoupon = {
        code: nextCode,
        discountAmount: Number(quote.discountAmount ?? 0),
        total,
        label: quote.label ?? null,
        checkoutPending: Boolean(quote.checkoutPending),
      };
      setAppliedCoupon(nextCoupon);
      setCouponCode(nextCode);
      try {
        if (couponStorageKey) window.sessionStorage.setItem(couponStorageKey, JSON.stringify(nextCoupon));
      } catch {
        // The server still validates the coupon; persistence only helps resume the same checkout.
      }
      if (quote.checkoutPending) {
        if (quote.checkoutDetails) {
          setForm((current) => ({
            ...current,
            full_name: quote.checkoutDetails?.fullName || current.full_name,
            email: quote.checkoutDetails?.email || current.email,
            whatsapp: quote.checkoutDetails?.whatsapp || current.whatsapp,
            delivery_address: quote.checkoutDetails?.deliveryAddress || current.delivery_address,
            delivery_city: quote.checkoutDetails?.deliveryCity || current.delivery_city,
            delivery_state: quote.checkoutDetails?.deliveryState || current.delivery_state,
            delivery_postal_code: quote.checkoutDetails?.deliveryPostalCode || current.delivery_postal_code,
            delivery_country: quote.checkoutDetails?.deliveryCountry || current.delivery_country,
          }));
        }
        toast.success("Existing checkout restored. You can safely retry the payment.");
      } else {
        toast.success("Coupon applied.");
      }
    } catch (err) {
      if (couponWasRejected) {
        clearCheckoutAttempt();
        setAppliedCoupon(null);
        setCouponCode("");
      } else if (appliedCoupon) {
        // A network error is not proof the previously applied coupon became invalid.
        setCouponCode(appliedCoupon.code);
      }
      toast.error(err instanceof Error ? err.message : "Could not validate this coupon.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    if (appliedCoupon?.checkoutPending) {
      // Keep the reservation metadata so reapplying the same coupon resumes this order.
      setAppliedCoupon(null);
      setCouponCode("");
      toast.message("Coupon removed from this form. Reapplying it will resume the existing checkout.");
      return;
    }
    clearCheckoutAttempt();
    setAppliedCoupon(null);
    setCouponCode("");
    toast.message("Coupon removed.");
  };
  

  useEffect(() => {
    if (!user || !p || !couponStorageKey) return;
    let savedValue: string | null = null;
    try {
      savedValue = window.sessionStorage.getItem(couponStorageKey);
    } catch {
      return;
    }
    if (!savedValue) return;

    let savedCoupon: AppliedCoupon;
    try {
      const parsed = JSON.parse(savedValue) as Partial<AppliedCoupon>;
      if (
        typeof parsed.code !== "string" ||
        typeof parsed.discountAmount !== "number" ||
        typeof parsed.total !== "number" ||
        !Number.isFinite(parsed.discountAmount) ||
        !Number.isFinite(parsed.total) ||
        parsed.total <= 0
      ) {
        clearStoredCheckout(checkoutAttemptKey, couponStorageKey);
        return;
      }
      savedCoupon = {
        code: parsed.code,
        discountAmount: parsed.discountAmount,
        total: parsed.total,
        label: typeof parsed.label === "string" ? parsed.label : null,
        checkoutPending: Boolean(parsed.checkoutPending),
      };
    } catch {
      clearStoredCheckout(checkoutAttemptKey, couponStorageKey);
      return;
    }

    let active = true;
    setCouponRestoring(true);
    const restore = async () => {
      try {
        const quote = await validateCouponCode(savedCoupon.code, p.id, amount);
        if (!active) return;
        if (!quote?.valid) {
          clearStoredCheckout(checkoutAttemptKey, couponStorageKey);
          setAppliedCoupon(null);
          setCouponCode("");
          toast.error(couponErrorMessage(quote?.error));
          return;
        }

        const restoredCoupon: AppliedCoupon = {
          code: quote.code ?? savedCoupon.code,
          discountAmount: Number(quote.discountAmount ?? savedCoupon.discountAmount),
          total: Number(quote.total ?? savedCoupon.total),
          label: quote.label ?? savedCoupon.label,
          checkoutPending: Boolean(quote.checkoutPending),
        };
        if (!Number.isFinite(restoredCoupon.total) || restoredCoupon.total <= 0) {
          clearStoredCheckout(checkoutAttemptKey, couponStorageKey);
          setAppliedCoupon(null);
          setCouponCode("");
          return;
        }

        setAppliedCoupon(restoredCoupon);
        setCouponCode(restoredCoupon.code);
        if (quote.checkoutPending && quote.checkoutDetails) {
          setForm((current) => ({
            ...current,
            full_name: quote.checkoutDetails?.fullName || current.full_name,
            email: quote.checkoutDetails?.email || current.email,
            whatsapp: quote.checkoutDetails?.whatsapp || current.whatsapp,
            delivery_address: quote.checkoutDetails?.deliveryAddress || current.delivery_address,
            delivery_city: quote.checkoutDetails?.deliveryCity || current.delivery_city,
            delivery_state: quote.checkoutDetails?.deliveryState || current.delivery_state,
            delivery_postal_code: quote.checkoutDetails?.deliveryPostalCode || current.delivery_postal_code,
            delivery_country: quote.checkoutDetails?.deliveryCountry || current.delivery_country,
          }));
        }
        try {
          window.sessionStorage.setItem(couponStorageKey, JSON.stringify(restoredCoupon));
        } catch {
          // The coupon is still validated server-side when checkout starts.
        }
      } catch {
        // If validation is temporarily offline, retain the saved quote for the existing
        // idempotent order; create-razorpay-order will still validate a new order server-side.
        if (active) {
          setAppliedCoupon(savedCoupon);
          setCouponCode(savedCoupon.code);
        }
      } finally {
        if (active) setCouponRestoring(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [user?.id, p?.id, slug, amount, checkoutAttemptKey, couponStorageKey]);

  // The confirmation screen replaces the checkout form; reset scroll so its heading is visible.
  useEffect(() => {
    if (submitted) window.scrollTo(0, 0);
  }, [submitted]);

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
          <h1 className="mt-4 font-serif text-2xl font-semibold">Payment verified successfully</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {p.product_type === "physical"
              ? `Your payment for ${p.title} is confirmed. We’ll prepare your order for delivery to the address you provided.${siteSettings.deliveryEstimate ? ` ${siteSettings.deliveryEstimate}.` : " We’ll contact you using the details provided at checkout if delivery updates are needed."}`
              : `Your payment for ${p.title} is confirmed. Open My Library to access your digital purchase. If it does not appear immediately, refresh the library in a moment.`}
          </p>
          <div className="mt-5 rounded-lg border border-border bg-surface p-4 text-left text-sm">
            <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-success" /> Razorpay payment verification was confirmed by our server.</p>
            <p className="mt-2 flex gap-2"><Headphones className="h-4 w-4 shrink-0 text-accent" /> Need help? Contact support and mention your order details.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {p.product_type === "physical" && submittedOrderId ? (
              <Button asChild><Link to="/track-order/$orderId" params={{ orderId: submittedOrderId }}>Track Delivery</Link></Button>
            ) : p.product_type === "physical" ? (
              <Button variant="outline" onClick={() => void navigate({ to: "/library" })}>Order confirmation unavailable</Button>
            ) : (
              <Button asChild><Link to="/library">Open My Library</Link></Button>
            )}
            <Button variant="outline" asChild><Link to="/shop">Continue shopping</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || couponRestoring) return;
    setError(null);
    if (!form.full_name.trim() || form.full_name.trim().length > 100) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError("Please enter a valid email address.");
    if (!/^[0-9+\-\s]{8,16}$/.test(form.whatsapp.trim())) return setError("Please enter a valid WhatsApp number.");
    if (p.product_type === "physical" && (!form.delivery_address.trim() || form.delivery_address.trim().length > 300)) return setError("Please enter your complete delivery address.");
    if (p.product_type === "physical" && (!form.delivery_city.trim() || !form.delivery_state.trim())) return setError("Please enter your city and state.");
    if (p.product_type === "physical" && !/^[0-9]{5,10}$/.test(form.delivery_postal_code.trim())) return setError("Please enter a valid postal PIN code.");
    if (p.product_type === "physical" && !form.delivery_country.trim()) return setError("Please enter your country.");
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Your session expired. Please sign in again.");
      if (!appliedCoupon && couponStorageKey) {
        // The customer removed a reserved coupon and chose to continue without it.
        let storedCoupon: AppliedCoupon | null = null;
        try {
          const raw = window.sessionStorage.getItem(couponStorageKey);
          storedCoupon = raw ? JSON.parse(raw) as AppliedCoupon : null;
        } catch {
          storedCoupon = null;
        }
        if (storedCoupon?.checkoutPending) clearCheckoutAttempt();
      }
      let idempotencyKey: string;
      try {
        const saved = checkoutAttemptKey ? window.sessionStorage.getItem(checkoutAttemptKey) : null;
        idempotencyKey = saved && /^[0-9a-f-]{36}$/i.test(saved) ? saved : crypto.randomUUID();
        if (checkoutAttemptKey) window.sessionStorage.setItem(checkoutAttemptKey, idempotencyKey);
      } catch {
        idempotencyKey = crypto.randomUUID();
      }
      const { data: checkout, error: createError } = await supabase.functions.invoke("create-razorpay-order", { body: {
        idempotencyKey,
        productId:p.id, fullName:form.full_name.trim(), email:form.email.trim(), whatsapp:form.whatsapp.trim(),
        couponCode:appliedCoupon?.code ?? null, deliveryAddress:form.delivery_address.trim(), deliveryCity:form.delivery_city.trim(),
        deliveryState:form.delivery_state.trim(), deliveryPostalCode:form.delivery_postal_code.trim(), deliveryCountry:form.delivery_country.trim() || "India",
        estimatedDelivery: p.product_type === "physical" ? siteSettings.deliveryEstimate : null,
      }});
      if (createError) {
        const context=(createError as {context?:{json?:()=>Promise<{error?:string}>}}).context;
        const payload=await context?.json?.().catch(()=>null);
        throw new Error(payload?.error || createError.message || "Could not start secure checkout.");
      }
      if (!checkout?.orderId || !checkout?.razorpayOrderId || !checkout?.keyId || !checkout?.amount) throw new Error("The payment service returned an incomplete checkout session. Please retry.");
      if (appliedCoupon && couponStorageKey) {
        const reservedCoupon: AppliedCoupon = {
          ...appliedCoupon,
          total: Number(checkout.amount) / 100,
          checkoutPending: true,
        };
        setAppliedCoupon(reservedCoupon);
        try {
          window.sessionStorage.setItem(couponStorageKey, JSON.stringify(reservedCoupon));
        } catch {
          // Server-side idempotency still protects payment creation.
        }
      }
      const loadRazorpay=async()=>{
        if ((window as Window & {Razorpay?:unknown}).Razorpay) return;
        let script=document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]');
        if (!script) {
          script=document.createElement("script"); script.src="https://checkout.razorpay.com/v1/checkout.js"; script.async=true; script.dataset.razorpayCheckout="true"; document.head.appendChild(script);
        }
        if (script.dataset.loaded==="true" || (window as Window & {Razorpay?:unknown}).Razorpay) return;
        await new Promise<void>((resolve,reject)=>{script!.addEventListener("load",()=>{script!.dataset.loaded="true";resolve()},{once:true});script!.addEventListener("error",()=>reject(new Error("Could not load Razorpay Checkout. Check your connection and retry.")),{once:true});});
      };
      await loadRazorpay();
      type Success={razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string};
      type Options={key:string;amount:number;currency:string;name:string;description:string;order_id:string;prefill:{name:string;email:string;contact:string};theme:{color:string};handler:(r:Success)=>void;modal:{ondismiss:()=>void}};
      type Instance={open:()=>void;on:(event:string,callback:(r:{error?:{description?:string}})=>void)=>void};
      const RazorpayCtor=(window as Window & {Razorpay?:new(options:Options)=>Instance}).Razorpay;
      if(!RazorpayCtor) throw new Error("Razorpay Checkout did not initialize. Please retry.");
      const razorpay=new RazorpayCtor({key:checkout.keyId,amount:checkout.amount,currency:checkout.currency||"INR",name:"EduWallet",description:p.title.slice(0,200),order_id:checkout.razorpayOrderId,prefill:checkout.prefill,theme:{color:"#2563eb"},
        handler:async(response)=>{
          try {
            const {data:verified,error:verifyError}=await supabase.functions.invoke("verify-razorpay-payment",{body:{orderId:checkout.orderId,razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
            if(verifyError||!verified?.ok){
              const context=(verifyError as {context?:{json?:()=>Promise<{error?:string}>}}|null)?.context;
              const payload=await context?.json?.().catch(()=>null);
              setError(`${payload?.error || "Payment may have completed, but verification is pending."} Payment reference: ${response.razorpay_payment_id}. Do not pay again; contact support if verification remains pending.`);setSaving(false);return;
            }
            clearCheckoutAttempt();
            setSubmittedOrderId(String(verified.orderId || checkout.orderId));
            setSubmitted(true);
          } catch { setError(`Payment may have completed, but verification could not finish. Payment reference: ${response.razorpay_payment_id}. Do not pay again; contact support if verification remains pending.`); }
          finally {setSaving(false);}
        },modal:{ondismiss:()=>setSaving(false)}});
      razorpay.on("payment.failed",(response)=>{setError(response.error?.description||"Payment was not completed. You can retry checkout.");setSaving(false);});
      razorpay.open();
    } catch(err){
      const message = err instanceof Error ? err.message : "Could not start checkout. Please retry.";
      // If the final server-side coupon check loses a race, do not leave a stale discount displayed.
      if (/coupon/i.test(message)) {
        clearCheckoutAttempt();
        setAppliedCoupon(null);
        setCouponCode("");
      }
      setError(message);
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
            <h2 className="text-lg font-semibold">Secure payment</h2>
            <div className="mt-4 rounded-md border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{p.title}</p>
              <p className="mt-1 text-muted-foreground">Amount payable: <span className="font-semibold text-foreground">{formatPrice(payableAmount)}</span>{appliedCoupon && <span className="ml-2 text-xs text-success">({formatPrice(appliedCoupon.discountAmount)} saved)</span>}</p>
            </div>
            <div className="mt-5 rounded-md border border-border p-4">
              <p className="font-medium">Pay securely with Razorpay</p>
              <p className="mt-2 text-sm text-muted-foreground">Continue to Razorpay to choose an available payment method. The final amount and eligible coupon discount are recalculated on our server before a payment session is created.</p>
              <p className="mt-3 text-sm text-muted-foreground">Your order is marked paid only after our server verifies the payment with Razorpay.</p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Delivery & payment details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.product_type === "physical" ? "Enter the shipping address for your physical book or printed notes, then continue to secure payment." : "Confirm your customer details and continue to secure payment."}
            </p>

            <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
              <div className="rounded-lg border border-border bg-surface p-3">
                <Label htmlFor="coupon-code">Coupon code</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input id="coupon-code" value={couponCode} disabled={!!appliedCoupon || couponLoading || couponRestoring} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter code" maxLength={64} />
                  {appliedCoupon ? <Button type="button" variant="outline" onClick={removeCoupon}>Remove</Button> : <Button type="button" variant="outline" disabled={couponLoading || couponRestoring || !couponCode.trim()} onClick={() => void applyCoupon()}>{couponRestoring ? "Restoring…" : couponLoading ? "Checking…" : "Apply"}</Button>}
                </div>
                {appliedCoupon && <p className="mt-2 text-sm text-success">{appliedCoupon.label || appliedCoupon.code} applied — you save {formatPrice(appliedCoupon.discountAmount)}.</p>}
              </div>
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, full_name: e.target.value }); }}
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
                  onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, email: e.target.value }); }}
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
                  onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, whatsapp: e.target.value }); }}
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
                  <Input id="delivery_address" value={form.delivery_address} maxLength={300} onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, delivery_address: e.target.value }); }} className="mt-1.5 h-11" autoComplete="street-address" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="delivery_city">City / town</Label>
                    <Input id="delivery_city" value={form.delivery_city} onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, delivery_city: e.target.value }); }} className="mt-1.5 h-11" autoComplete="address-level2" required />
                  </div>
                  <div>
                    <Label htmlFor="delivery_state">State</Label>
                    <Input id="delivery_state" value={form.delivery_state} onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, delivery_state: e.target.value }); }} className="mt-1.5 h-11" autoComplete="address-level1" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="delivery_postal_code">PIN code</Label>
                    <Input id="delivery_postal_code" inputMode="numeric" value={form.delivery_postal_code} maxLength={10} onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, delivery_postal_code: e.target.value }); }} className="mt-1.5 h-11" autoComplete="postal-code" required />
                  </div>
                  <div>
                    <Label htmlFor="delivery_country">Country</Label>
                    <Input id="delivery_country" value={form.delivery_country} onChange={(e) => { clearCheckoutRequest(); setForm({ ...form, delivery_country: e.target.value }); }} className="mt-1.5 h-11" autoComplete="country-name" required />
                  </div>
                </div>
              </>}
              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={saving || couponRestoring}>{couponRestoring ? "Restoring checkout…" : saving ? "Preparing secure checkout…" : `Pay ${formatPrice(payableAmount)} with Razorpay`}</Button>
              <p className="text-xs text-muted-foreground">If your bank shows a debit while verification is pending, do not pay again. Contact support with your payment reference.</p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
