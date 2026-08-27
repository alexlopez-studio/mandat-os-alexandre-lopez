// Edge Function : création automatique d'un canal Slack à chaque nouveau projet Mandat OS.
// Déclenchée par un trigger Postgres (pg_net) sur INSERT INTO projects.
// Déployée sur Supabase (project-ref ntlbforzrdmeifpzfjtk), slug `slack-new-project`, verify_jwt=false.
// Secrets requis (Supabase Function secrets) : SLACK_BOT_TOKEN, WEBHOOK_SECRET.

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

// Humains à inviter dans chaque canal projet (IDs stables).
const MEMBER_IDS = ["U0BSA1XJ2JZ", "U0BRYMJQKJT"]; // Alexandre Lopez, Laëtitia Galanakis

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function slack(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function createChannel(name: string) {
  let candidate = name;
  for (let i = 0; i < 6; i++) {
    const res = await slack("conversations.create", { name: candidate, is_private: false });
    if (res.ok) return { id: res.channel.id, name: candidate, ok: true };
    if (res.error !== "name_taken") return { ok: false, error: res.error };
    candidate = `${name}-${i + 2}`;
  }
  return { ok: false, error: "name_taken_after_retries" };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let record: Record<string, unknown>;
  try {
    const body = await req.json();
    record = (body && body.record) || body || {};
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const title = String(record.title ?? "").trim() || "projet";
  const city = String(record.property_city ?? "").trim();
  const stage = String(record.stage ?? "");
  const kind = String(record.kind ?? "");
  const isTest = Boolean(record.is_test);

  // On ne crée pas de canal pour les projets de démo.
  if (isTest) {
    return json({ ok: true, skipped: "is_test" });
  }

  const slug = slugify(`${title} ${city}`.trim()) || "projet";
  const channelName = `proj-${slug}`;

  // Le bot est ajouté automatiquement au canal qu'il crée.
  const created = await createChannel(channelName);
  if (!created.ok) {
    return json({ ok: false, error: created.error, channel: channelName }, 500);
  }

  // Inviter les humains.
  const invite = await slack("conversations.invite", {
    channel: created.id,
    users: MEMBER_IDS.join(","),
  });

  // Message de bienvenue.
  const welcome = [
    `🏠 *Nouveau projet : ${title}*`,
    city ? `📍 ${city}` : "",
    stage ? `🏷 Étape : ${stage}` : "",
    kind ? `📋 Type : ${kind}` : "",
    "",
    "Canal créé automatiquement depuis Mandat OS.",
  ].filter(Boolean).join("\n");
  const post = await slack("chat.postMessage", { channel: created.id, text: welcome });

  return json({
    ok: true,
    channel: created.name,
    channel_id: created.id,
    invite_ok: invite.ok,
    invite_error: invite.error ?? null,
    post_ok: post.ok,
    post_error: post.error ?? null,
  });
});
