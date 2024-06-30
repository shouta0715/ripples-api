import { URL, WebSocket } from "@cloudflare/workers-types";

export type BasicState = {
  id: string;
  role: "admin" | "user";
};

export interface BasicMessage<A> {
  action: A;
  [key: string]: unknown;
}

export interface Session<
  S extends BasicState,
  A extends string,
  M extends BasicMessage<A>,
> {
  role: "admin" | "user";
  id: string;
  state: S;
  ws: WebSocket;

  // セッション関連の処理
  onConnect(url: URL): S;

  // メッセージを受信したときの処理
  onAction(data: M): void | Promise<void>;

  // セッションの状態を取得
  getState(): S;
  getSession(): Session<S, A, M>;
  getWs(): WebSocket;

  // セッションの状態をDurable Objectに保存
  saveState(state: Partial<S>): S;
  loadState(): S;
}
