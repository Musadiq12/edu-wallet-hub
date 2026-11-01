import { useQuery } from "@tanstack/react-query";
import { SendEmailDialog } from "./SendEmailDialog";
export type SellerEmailDecision = { suspended: boolean; reason: string | null };
export const sellerEmailDecisionKey = (sellerId: string) => ["admin-email-decision", sellerId];
export function SellerEmailActions({ seller }: { seller: { seller_id: string; full_name: string | null; email: string | null; is_suspended: boolean } }) {
  const decision = useQuery<SellerEmailDecision | null>({ queryKey: sellerEmailDecisionKey(seller.seller_id), queryFn: () => null, enabled: false, staleTime: Infinity, gcTime: Infinity });
  const common = { referenceId: seller.seller_id, recipientUserId: seller.seller_id, recipientName: seller.full_name, recipientEmail: seller.email };
  return <div className="flex flex-wrap gap-3 border-t border-border pt-3">
    {seller.is_suspended && <SendEmailDialog label="Send suspension email" disabled={!decision.data?.suspended || !decision.data.reason} draft={{ ...common, eventType: "seller_suspended", reason: decision.data?.reason, details: { "Seller ID": seller.seller_id, Status: "Suspended", Reason: decision.data?.reason ?? null } }} />}
    {!seller.is_suspended && decision.data?.suspended === false && <SendEmailDialog label="Send reactivation email" draft={{ ...common, eventType: "seller_reactivated", details: { "Seller ID": seller.seller_id, Status: "Active" } }} />}
    <SendEmailDialog label="Send custom email" draft={{ ...common, eventType: "custom", details: { "Seller ID": seller.seller_id, Status: seller.is_suspended ? "Suspended" : "Active" } }} />
  </div>;
}