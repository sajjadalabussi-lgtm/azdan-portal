type ExpoPushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
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

  for (const tokenGroup of chunk(uniqueTokens, 100)) {
    const payloads: ExpoPushPayload[] = tokenGroup.map((token) => ({
      to: token,
      title: input.title,
      body: input.message,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: input.data ?? {},
    })) as ExpoPushPayload[];

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
