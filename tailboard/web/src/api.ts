import type { Board, Memo, NodeDetail } from "./types";

export async function fetchBoard(): Promise<Board> {
  const res = await fetch("/api/board");
  if (!res.ok) {
    throw new Error("board " + res.status);
  }
  return res.json() as Promise<Board>;
}

export async function fetchNode(id: string): Promise<NodeDetail> {
  const res = await fetch("/api/nodes/" + encodeURIComponent(id));
  if (!res.ok) {
    throw new Error("node " + res.status);
  }
  return res.json() as Promise<NodeDetail>;
}

export async function ackAlert(id: string): Promise<void> {
  const res = await fetch("/api/alerts/" + encodeURIComponent(id) + "/ack", { method: "POST" });
  if (!res.ok) {
    throw new Error("ack " + res.status);
  }
}

export async function postMemo(author: string, body: string, pinned: boolean): Promise<Memo> {
  const res = await fetch("/api/memos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ author, body, pinned }),
  });
  if (!res.ok) {
    throw new Error("memo " + res.status);
  }
  return res.json() as Promise<Memo>;
}

export async function pinMemo(id: string, pinned: boolean): Promise<void> {
  await fetch("/api/memos/" + encodeURIComponent(id) + "/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });
}

export async function refreshBrief(): Promise<void> {
  await fetch("/api/briefing/refresh", { method: "POST" });
}

export function subscribeBoard(onBoard: (b: Board) => void): () => void {
  const es = new EventSource("/api/stream");
  es.addEventListener("board", (ev) => {
    onBoard(JSON.parse((ev as MessageEvent).data) as Board);
  });
  const poll = window.setInterval(() => {
    void fetchBoard().then(onBoard).catch(() => undefined);
  }, 8000);
  return () => {
    es.close();
    window.clearInterval(poll);
  };
}
