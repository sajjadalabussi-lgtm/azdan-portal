type ExpoPushPayload = {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
  data?: Record<string, unknown>;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type NotificationType =
  | "general"
  | "payment"
  | "addition"
  | "file"
  | "image"
  | "stage_update"
  | "stage_complete"
  | "update"
  | "progress";

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function notificationSymbol(type: string) {
  switch (type) {
    case "payment":
      return "💰";
    case "addition":
      return "➕";
    case "file":
      return "📄";
    case "image":
      return "🖼️";
    case "stage_update":
      return "🏗️";
    case "stage_complete":
      return "✅";
    case "progress":
      return "✅";
    case "update":
      return "🏗️";
    default:
      return "🔔";
  }
}

function getNotificationType(data?: Record<string, unknown>): NotificationType {
  const value = String(data?.notificationType || "general");
  const allowed: NotificationType[] = [
    "general",
    "payment",
    "addition",
    "file",
    "image",
    "stage_update",
    "stage_complete",
    "update",
    "progress",
  ];

  return allowed.includes(value as NotificationType)
    ? (value as NotificationType)
    : "general";
}

export async function sendExpoPushNotifications(input: {
  tokens: string[];
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  const uniqueTokens = Array.from(new Set(input.tokens.filter(Boolean)));

  if (uniqueTokens.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] as string[] };
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  const notificationType = getNotificationType(input.data);
  const symbol = notificationSymbol(notificationType);
  const pushTitle = input.title.startsWith(symbol)
    ? input.title
    : `${symbol} ${input.title}`;

  for (const tokenGroup of chunk(uniqueTokens, 100)) {
    const payloads: ExpoPushPayload[] = tokenGroup.map((token) => ({
      to: token,
      title: pushTitle,
      body: input.message,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: input.data ?? {},
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloads),
    });

    if (!response.ok) {
      failed += tokenGroup.length;
      continue;
    }

    const json = (await response.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        sent += 1;
        return;
      }

      failed += 1;

      if (ticket.details?.error === "DeviceNotRegistered") {
        const token = tokenGroup[index];
        if (token) invalidTokens.push(token);
      }
    });
  }

  return { sent, failed, invalidTokens };
}
