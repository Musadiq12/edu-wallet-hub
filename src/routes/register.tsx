import { createFileRoute, Navigate } from "@tanstack/react-router";

type Search = { redirect?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const redirect = search["redirect"];
    return typeof redirect === "string" ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: "Create account — EduWallet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterRedirect,
});

function RegisterRedirect() {
  const { redirect } = Route.useSearch();
  return <Navigate to="/login" search={{ mode: "signup", ...(redirect ? { redirect } : {}) }} replace />;
}
