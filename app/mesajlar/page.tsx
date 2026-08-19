import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { database, ensureDatabase } from "@/lib/database";
import { MessageComposer } from "@/components/message-composer";

interface MessageRow { id: string; sender_id: string; receiver_id: string; body: string; created_at: string; product_id: string | null; order_id: string | null; sender_name: string; receiver_name: string; product_title: string | null }

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ user?: string; product?: string; order?: string }> }) {
  const user = await requireUser("/mesajlar");
  await ensureDatabase();
  const params = await searchParams;
  const target = params.user ? await database().prepare("SELECT id,first_name,last_name FROM users WHERE id = ? AND status = 'ACTIVE'").bind(params.user).first<{ id: string; first_name: string; last_name: string }>() : null;
  await database().prepare("UPDATE messages SET read_at = ? WHERE receiver_id = ? AND read_at IS NULL").bind(new Date().toISOString(), user.id).run();
  const messages = (await database().prepare(`SELECT m.id,m.sender_id,m.receiver_id,m.body,m.created_at,m.product_id,m.order_id,
    su.first_name || ' ' || su.last_name AS sender_name,ru.first_name || ' ' || ru.last_name AS receiver_name,p.title AS product_title
    FROM messages m JOIN users su ON su.id = m.sender_id JOIN users ru ON ru.id = m.receiver_id LEFT JOIN products p ON p.id = m.product_id
    WHERE m.sender_id = ? OR m.receiver_id = ? ORDER BY m.created_at DESC LIMIT 100`).bind(user.id, user.id).all<MessageRow>()).results;
  return <div className="dashboard-page"><div className="page-heading"><span className="kicker dark">GÜVENLİ İLETİŞİM</span><h1>Mesajlar</h1><p>Satıcı, alıcı ve dükkanlarla platform içinde iletişim kur.</p></div>{target && target.id !== user.id && <MessageComposer receiverId={target.id} receiverName={`${target.first_name} ${target.last_name}`} productId={params.product} orderId={params.order}/>}<div className="message-list">{messages.map((message) => { const mine = message.sender_id === user.id; const otherId = mine ? message.receiver_id : message.sender_id; const otherName = mine ? message.receiver_name : message.sender_name; const query = new URLSearchParams({ user: otherId }); if (message.product_id) query.set("product", message.product_id); if (message.order_id) query.set("order", message.order_id); return <article key={message.id} className={mine ? "sent" : "received"}><small>{mine ? `Sen → ${otherName}` : otherName} · {new Date(message.created_at).toLocaleString("tr-TR")}</small>{message.product_title && <small>{message.product_title}</small>}<p>{message.body}</p><Link href={`/mesajlar?${query.toString()}`}>Yanıtla</Link></article>; })}{messages.length === 0 && <div className="empty-state"><h2>Henüz mesaj yok</h2><p>Ürün detayından satıcıya güvenli şekilde soru sorabilirsin.</p></div>}</div></div>;
}
