import { RegisterForm } from "@/components/auth-forms";
import { database, ensureDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";
async function getLegalDocuments() { await ensureDatabase(); const result = await database().prepare("SELECT id,title FROM legal_documents WHERE active = 1 AND type IN ('USER_AGREEMENT','KVKK_NOTICE') ORDER BY type").all<{ id: string; title: string }>(); return result.results; }
export default async function RegisterPage() { const legalDocuments = await getLegalDocuments(); return <div className="auth-page register"><div className="auth-card"><span className="kicker dark">TOPLULUĞA KATIL</span><h1>Ücretsiz hesap oluştur</h1><p>Alıcı veya satıcı olarak aynı hesapla işlem yapabilirsin.</p>{legalDocuments.length >= 2 ? <RegisterForm legalDocuments={legalDocuments}/> : <p className="form-message">Kayıt için aktif hukuki metinler henüz yayınlanmamış. Yönetici yapılandırması gereklidir.</p>}</div><div className="auth-visual"><h2>İyi ürünler<br/>yeni hikâyeler bulsun.</h2><p>Pazarlama izni üyelik şartı değildir. Yalnızca hizmet için gereken verileri topluyoruz.</p></div></div>; }
