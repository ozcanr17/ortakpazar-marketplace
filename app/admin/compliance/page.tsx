import { requireAdmin } from "@/lib/auth";
import { database, ensureDatabase } from "@/lib/database";
import { ComplianceControl } from "@/components/admin-controls";

interface ComplianceItem { id: string; title: string; status: string; owner: string | null; note: string | null; evidence_url: string | null }

export default async function CompliancePage() {
  await requireAdmin();
  await ensureDatabase();
  const items = (await database().prepare("SELECT id,title,status,owner,note,evidence_url FROM compliance_items ORDER BY id").all<ComplianceItem>()).results;
  return <><div className="admin-heading"><span className="kicker dark">TÜRKİYE UYUMLULUK</span><h1>Compliance checklist</h1><p>Bu liste hukuki tavsiye veya uygunluk onayı değildir. Her madde yetkin hukuk, vergi ve ödeme uzmanlarınca doğrulanmalıdır.</p></div><div className="compliance-list">{items.map((item) => <article key={item.id}><div><b>{item.title}</b><span>{item.status}</span></div><ComplianceControl item={item}/></article>)}</div></>;
}
