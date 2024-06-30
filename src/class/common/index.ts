import { BasicMessage, BasicState, Session } from "@/models/sessions";

export abstract class BasicSession<
  S extends BasicState,
  A extends string,
  M extends BasicMessage<A>,
> implements Session<S, A, M>
{
  role: "admin" | "user";

  ws: WebSocket;

  id: string;

  state: S;

  constructor(ws: WebSocket, role: "admin" | "user", initialState?: S) {
    const id = crypto.randomUUID();
    this.id = id;
    this.ws = ws;
    this.role = role;
    this.state = this.loadState() || initialState;
  }

  abstract onConnect(url: URL): S;
  abstract onAction(data: M): void | Promise<void>;

  getWs(): WebSocket {
    return this.ws;
  }

  getState(): S {
    return this.state;
  }

  getSession(): Session<S, A, M> {
    return this;
  }

  saveState(state?: Partial<S>): S {
    const prevState = this.loadState();

    const newState = { ...prevState, ...state };

    this.state = newState;
    this.ws.serializeAttachment(newState);

    return newState;
  }

  loadState(): S {
    return this.ws.deserializeAttachment();
  }
}
