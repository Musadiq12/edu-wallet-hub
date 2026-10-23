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
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const roleRpc = supabase as unknown as { rpc: (name: string, args: { _user_id: string; _role: string }) => Promise<{ data: unknown; error: Error | null }> };
      const { data, error } = await roleRpc.rpc("has_role", {
        _user_id: userId!,
        _role: "admin",
      });

      if (error) {
        console.error("[useIsAdmin] Failed to check admin role:", error);
        return false;
      }

      return data === true;
    },
  });
}

export async function signOutCleanly() {
  await supabase.auth.signOut();
}
