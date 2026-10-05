import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin(){
  const navigate=useNavigate();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setBusy(true);
    try{
      const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(error) throw error;
      if(!data.user) throw new Error("Sign-in failed.");
      const {data:admin,error:roleError}=await supabase.from("admin_users").select("is_active").eq("user_id",data.user.id).maybeSingle();
      if(roleError || !admin?.is_active){await supabase.auth.signOut();throw new Error("This account is not an active Revivor administrator.");}
      void navigate({to:"/admin"});
    }catch(err){toast.error(err instanceof Error?err.message:"Unable to sign in.");}
    finally{setBusy(false);}
  };
  return <main className="grid min-h-screen place-items-center bg-[#f8f6f0] px-4 py-10">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-950 text-amber-400"><ShieldCheck className="size-6"/></div>
      <h1 className="mt-6 text-3xl font-black">Revivor Admin</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in with an active administrator account.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold">Email<Input className="mt-1.5 h-11" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label>
        <label className="block text-sm font-semibold">Password<Input className="mt-1.5 h-11" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
        <Button className="h-11 w-full bg-slate-950 font-black" disabled={busy}>{busy?<span>Signing in…</span>:<><LogIn className="mr-2 size-4"/>Sign in to Admin</>}</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm"><Link to="/forgot-password" className="font-semibold text-slate-600 hover:text-slate-950">Forgot password?</Link><Link to="/" className="font-semibold text-slate-600 hover:text-slate-950">Back to site</Link></div>
    </div>
  </main>;
}
