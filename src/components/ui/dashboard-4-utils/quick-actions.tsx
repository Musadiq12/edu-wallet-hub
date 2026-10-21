import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ClipboardList, MessageSquare, PackagePlus, Star } from "lucide-react";

const actions = [
  { label: "Manage orders", description: "Review payments and fulfilment", to: "/admin/orders", icon: ClipboardList },
  { label: "Manage products", description: "Update your catalogue", to: "/admin/products", icon: PackagePlus },
  { label: "Customer messages", description: "Respond to enquiries", to: "/admin/messages", icon: MessageSquare },
  { label: "Moderate reviews", description: "Review customer feedback", to: "/admin/reviews", icon: Star },
];

export function QuickActions() {
  return <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm md:col-span-2 xl:col-span-4">
    <div className="mb-3"><h2 className="font-semibold">Quick actions</h2><p className="text-sm text-muted-foreground">Common store-management tasks</p></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{actions.map(({label,description,to,icon:Icon})=><Link key={to} to={to} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{description}</span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/></Link>)}</div>
  </section>;
}
