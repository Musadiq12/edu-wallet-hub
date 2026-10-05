import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  return { session, user: user as User | null, loading };
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_users").select("user_id,role,is_active").eq("user_id", userId!).maybeSingle();
      if (error) { console.error("[useIsAdmin] Failed to check admin access:", error); return false; }
      return !!data?.is_active;
    },
  });
}

export function useAdminRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("admin_users").select("role,is_active,display_name").eq("user_id", userId!).maybeSingle();
      return data ?? null;
    },
  });
}

export async function signOutCleanly() {
  await supabase.auth.signOut();
}
