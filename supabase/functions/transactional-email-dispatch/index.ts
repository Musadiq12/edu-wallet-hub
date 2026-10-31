import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "EduWallet Support <support@eduwallethub.in>";
const REPLY_TO = "support@eduwallethub.in";
const SITE = "https://eduwallethub.in";
const BATCH_SIZE = 20;

type Job = {
  id:string; dedupe_key:string; recipient_email:string; recipient_name:string|null;
  event_type:string; payload:Record<string,unknown>; attempts:number;
};

const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const money=(value:unknown)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value??0));

function render(job:Job){
 const p=job.payload??{}, name=esc(job.recipient_name||"there"), product=esc(p.product_title||"your product");
 const amount=money(p.amount??p.seller_share), reason=esc(p.reason||"No additional reason was provided.");
 const url=typeof p.dashboard_url==="string"?p.dashboard_url:typeof p.product_url==="string"?p.product_url:typeof p.wallet_url==="string"?p.wallet_url:typeof p.order_url==="string"?p.order_url:SITE;
 const entries:Record<string,{subject:string;heading:string;intro:string;detail:string;cta:string}>={
 "seller.account_approved":{subject:"Your EduWallet seller account is verified",heading:"Your seller account is verified",intro:"Your seller application has been approved. Seller access is now enabled for your account.",detail:"You can submit study resources for review, manage approved products, view sales and request withdrawals from your seller dashboard.",cta:"Open Seller Dashboard"},
 "seller.account_rejected":{subject:"Update on your EduWallet seller application",heading:"Your seller application needs attention",intro:"We have reviewed your seller application and could not approve it at this time.",detail:"Review the reason below and correct the relevant information before contacting support or submitting a new application.",cta:"Review Application"},
 "seller.product_approved":{subject:"Your product is approved and live on EduWallet",heading:"Your product is now live",intro:"Your submitted product has passed review and is now published on EduWallet.",detail:`Product: ${product}. Customers can now find it in the marketplace.`,cta:"View Product"},
 "seller.product_rejected":{subject:"Action required: changes to your EduWallet product",heading:"Your product was not approved",intro:"Our review team could not approve this product in its current form.",detail:`Product: ${product}. Review the feedback below, make the necessary changes and resubmit it for review.`,cta:"View Feedback"},
 "seller.product_unpublished":{subject:"Your EduWallet product is no longer published",heading:"Your product has been unpublished",intro:"An administrator has unpublished one of your products.",detail:`Product: ${product}. Contact support if you believe this action was taken in error.`,cta:"View Products"},
 "seller.first_sale":{subject:"Your first sale on EduWallet",heading:"You have made your first sale",intro:"A customer has completed a purchase of one of your products. This is your first recorded sale on EduWallet.",detail:`Product: ${product}. Your recorded seller share for this order is ${money(p.seller_share)}. Check your sales dashboard for the order details and applicable availability status.`,cta:"View Sales"},
 "seller.new_sale":{subject:"You have a new sale on EduWallet",heading:"A new product sale is confirmed",intro:"A customer has completed a purchase of one of your products.",detail:`Product: ${product}. Your recorded seller share for this order is ${money(p.seller_share)}. Check your sales dashboard for details.`,cta:"View Sales"},
 "seller.payout_requested":{subject:"We received your EduWallet withdrawal request",heading:"Withdrawal request received",intro:"Your withdrawal request has been recorded successfully.",detail:`Requested amount: ${amount}. We will review and process the request. This message does not mean a bank transfer has been made.`,cta:"View Wallet"},
 "seller.payout_processing":{subject:"Your EduWallet payout is being processed",heading:"Your payout is being processed",intro:"Your withdrawal request has moved to processing.",detail:`Payout amount: ${amount}. The transfer is being arranged. We will notify you when the request is marked as paid.`,cta:"View Wallet"},
 "seller.payout_marked_paid":{subject:"Your EduWallet payout has been marked as paid",heading:"Payout marked as paid",intro:"Your withdrawal request has been marked as paid by EduWallet.",detail:`Payout amount: ${amount}. ${p.upi_reference?"UPI reference: "+esc(p.upi_reference)+".":"A UPI reference was not recorded."} Please check your bank or UPI account. Contact support if the credit is not visible.`,cta:"View Wallet"},
 "seller.payout_rejected":{subject:"Update on your EduWallet withdrawal request",heading:"Withdrawal request not approved",intro:"Your withdrawal request was rejected after review.",detail:`Amount: ${amount}. Reason: ${reason}. The reserved amount has been released back to your available balance.`,cta:"View Wallet"},
 "seller.account_suspended":{subject:"Important update about your EduWallet seller account",heading:"Seller access has been suspended",intro:"Your seller account has been temporarily suspended.",detail:`Reason: ${reason}. Contact support if you need clarification or believe this decision is incorrect.`,cta:"Contact Support"},
 "seller.account_reinstated":{subject:"Your EduWallet seller access has been restored",heading:"Seller access restored",intro:"Your seller account has been reinstated.",detail:"You can sign in and continue managing your seller products and sales.",cta:"Open Seller Dashboard"},
 "buyer.order_received":{subject:"We received your EduWallet order",heading:"Your order has been received",intro:"We have created your order and recorded the details below.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Total: ${amount}. Payment must be confirmed before digital files are delivered.`,cta:"View My Orders"},
 "buyer.payment_confirmed":{subject:"Payment confirmed for your EduWallet order",heading:"Your payment is confirmed",intro:"We have confirmed the payment for your order.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Amount paid: ${amount}. Digital delivery or physical fulfilment will follow the order details.`,cta:"View My Orders"},
 "buyer.payment_rejected":{subject:"Action required: payment update for your EduWallet order",heading:"We could not verify your payment",intro:"Your order payment was not approved during review.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Reason: ${reason}. Review the order page for next steps.`,cta:"View My Orders"},
 "buyer.digital_delivery_confirmed":{subject:"Your EduWallet digital order has been delivered",heading:"Your digital order is ready",intro:"Your digital order has been marked as delivered.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Open your orders page to access the available download option.`,cta:"View My Orders"},
 "buyer.refund_processed":{subject:"Your EduWallet refund has been processed",heading:"Refund processed",intro:"The payment provider has confirmed that your refund was processed.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Refund amount: ${amount}. Your bank or payment provider may take additional time to display the credit.`,cta:"View My Orders"},
 "buyer.refund_failed":{subject:"Update on your EduWallet refund",heading:"Your refund could not be completed",intro:"The payment provider reported that the refund did not complete.",detail:`Order: ${esc(p.order_id)}. Product: ${product}. Contact support for assistance.`,cta:"View My Orders"}
 };
 const t=entries[job.event_type]??{subject:"An update about your EduWallet account",heading:"Your account has an update",intro:"There is a new update related to your EduWallet account.",detail:"Sign in to EduWallet to review the latest information.",cta:"Open EduWallet"};
 const h=esc(t.heading), intro=esc(t.intro), detail=esc(t.detail);
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="x-ua-compatible" content="ie=edge"><title>${h}</title></head><body style="margin:0;padding:0;background-color:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172b3a"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f8" style="background-color:#f3f5f8"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3e8ee;border-radius:14px"><tr><td bgcolor="#123b63" style="background-color:#123b63;padding-top:22px;padding-bottom:22px;padding-left:30px;padding-right:30px;color:#ffffff;font-size:22px;line-height:28px;font-weight:bold">EduWallet</td></tr><tr><td style="padding-top:34px;padding-bottom:18px;padding-left:30px;padding-right:30px"><p style="margin:0 0 12px;font-size:14px;line-height:22px;color:#5b6b78">Hello ${name},</p><h1 style="margin:0;font-size:26px;line-height:34px;color:#123b63;font-weight:700">${h}</h1></td></tr><tr><td style="padding-left:30px;padding-right:30px;padding-bottom:10px"><p style="margin:0;font-size:15px;line-height:25px;color:#334756">${intro}</p></td></tr><tr><td style="padding-left:30px;padding-right:30px;padding-top:12px;padding-bottom:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f8fb" style="background-color:#f5f8fb;border:1px solid #e5ebf1;border-radius:10px"><tr><td style="padding:18px;font-size:14px;line-height:24px;color:#334756">${detail}</td></tr></table></td></tr><tr><td align="left" style="padding-left:30px;padding-right:30px;padding-bottom:30px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#123b63" style="background-color:#123b63;border-radius:8px"><a href="${esc(url)}" style="display:inline-block;padding-top:13px;padding-bottom:13px;padding-left:22px;padding-right:22px;color:#ffffff;text-decoration:none;font-size:14px;line-height:20px;font-weight:bold">${esc(t.cta)}</a></td></tr></table></td></tr><tr><td style="border-top:1px solid #e8edf2;padding-top:20px;padding-bottom:24px;padding-left:30px;padding-right:30px"><p style="margin:0 0 7px;font-size:12px;line-height:19px;color:#6c7b86">This is an official transactional message from EduWallet.</p><p style="margin:0;font-size:12px;line-height:19px;color:#6c7b86">Questions? Reply to this email or contact <a href="mailto:support@eduwallethub.in" style="color:#123b63">support@eduwallethub.in</a>.</p><p style="margin:12px 0 0;font-size:11px;line-height:17px;color:#8a969f">© EduWallet · <a href="${SITE}" style="color:#123b63">eduwallethub.in</a></p></td></tr></table></td></tr></table></body></html>`;
 const text=`Hello ${job.recipient_name||"there"},\n\n${t.heading}\n\n${t.intro}\n\n${t.detail}\n\nReview: ${url}\n\nEduWallet Support\nsupport@eduwallethub.in`;
 return {subject:t.subject,html,text};
}

Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const secret=Deno.env.get("EMAIL_DISPATCH_SECRET"), supplied=req.headers.get("x-email-dispatch-secret");
 if(!secret||!supplied||supplied!==secret)return new Response("Unauthorized",{status:401});
 const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), resend=Deno.env.get("RESEND_API_KEY");
 if(!url||!service||!resend)return new Response("Email dispatcher is not configured",{status:503});
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:jobs,error}=await db.from("email_outbox").select("*").in("status",["pending","failed"]).lte("next_attempt_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(BATCH_SIZE);
 if(error)return new Response("Could not load email jobs",{status:500});
 const results=[];
 for(const job of (jobs??[]) as Job[]){
  const {data:locked,error:lockError}=await db.from("email_outbox").update({status:"processing",attempts:job.attempts+1,last_error:null}).eq("id",job.id).in("status",["pending","failed"]).select("id").maybeSingle();
  if(lockError||!locked)continue;
  try{
   const mail=render(job);
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":job.dedupe_key},body:JSON.stringify({from:FROM,reply_to:REPLY_TO,to:[job.recipient_email],subject:mail.subject,html:mail.html,text:mail.text}),signal:AbortSignal.timeout(15000)});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(typeof body.message==="string"?body.message:`Resend returned ${response.status}`);
   await db.from("email_outbox").update({status:"sent",sent_at:new Date().toISOString(),resend_email_id:body.id??null,last_error:null}).eq("id",job.id).eq("status","processing");
   results.push({id:job.id,status:"sent"});
  }catch(error){
   const message=error instanceof Error?error.message:"Unknown email dispatch error";
   const minutes=Math.min(360,Math.pow(2,Math.min(job.attempts,8))*2);
   await db.from("email_outbox").update({status:"failed",last_error:message.slice(0,1000),next_attempt_at:new Date(Date.now()+minutes*60000).toISOString()}).eq("id",job.id).eq("status","processing");
   results.push({id:job.id,status:"failed"});
  }
 }
 return Response.json({processed:results.length,results});
});
