import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Sales Analytics — EduWallet" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
