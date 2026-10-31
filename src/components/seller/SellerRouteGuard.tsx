import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export function SellerRouteGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [state,setState] = useState<"checking"|"seller"|"blocked"|"error">("checking");
  const [error,setError] = useState(false);

  useEffect(() => {
    let active=true;
    if(loading) return;
    if(!user) {
      void navigate({to:"/login",search:{redirect:window.location.pathname},replace:true});
      return;
    }
    void (async()=>{
      try {
        const {data,error}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
        if(error) throw error;
        if(!active) return;
        if(data?.role==="admin") {
          void navigate({to:"/admin/applications",replace:true});
          return;
        }
        if(data?.role!=="seller") {
          void navigate({to:"/become-seller",replace:true});
          return;
        }
        const {data:application,error:applicationError}=await supabase.from("seller_applications")
          .select("status,is_suspended").eq("user_id",user.id).maybeSingle();
        if(applicationError) throw applicationError;
        if(!active) return;
        if(application?.status==="approved" && !application.is_suspended) setState("seller");
        else setState("blocked");
      } catch {
        if(active) {setState("error");setError(true);}
      }
    })();
    return ()=>{active=false;};
  },[loading,user,navigate]);

  if(loading || state==="checking") return <div className="page-container space-y-4 py-12"><div className="h-8 w-48 animate-pulse rounded bg-muted"/><div className="h-28 animate-pulse rounded-xl bg-muted"/></div>;
  if(state==="error" || error) return <div className="page-container py-16"><div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-card p-6 text-center"><ShieldAlert className="mx-auto size-8 text-destructive"/><h1 className="mt-3 text-lg font-semibold">Could not verify seller access</h1><p className="mt-2 text-sm text-muted-foreground">Your seller data stays locked until your account can be verified.</p><Button asChild variant="outline" className="mt-4"><Link to="/">Return home</Link></Button></div></div>;
  if(state==="blocked") return <div className="page-container py-16"><div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center"><ShieldAlert className="mx-auto size-8 text-amber-600"/><h1 className="mt-3 text-lg font-semibold">Seller workspace unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This workspace is available only to verified sellers with an active account. Contact seller support if you need help.</p><Button asChild variant="outline" className="mt-4"><Link to="/">Return home</Link></Button></div></div>;
  if(state!=="seller") return null;
  return <>{children}</>;
}
