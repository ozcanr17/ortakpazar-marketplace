import { ComplianceControl } from "@/components/admin-controls";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export default async function CompliancePage() { await requireAdmin(); const { data } = await createSupabaseAdminClient().from("compliance_items").select("id,key,title,status,owner,note,evidence_url,reviewed_at").order("title"); return <><div className="admin-heading"><span className="kicker dark">TÜRKİYE UYUMLULUK</span><h1>Compliance checklist</h1><p>Bu liste hukuki tavsiye veya uygunluk onayı değildir. Her madde yetkin hukuk, vergi ve ödeme uzmanlarınca doğrulanmalıdır.</p></div><div className="compliance-list">{data?.map((item) => <article key={item.id}><div><b>{item.title}</b><span>{item.key} · {item.status}</span></div><ComplianceControl item={item}/></article>)}</div></>; }
