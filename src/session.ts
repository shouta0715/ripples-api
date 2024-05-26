/* eslint-disable class-methods-use-this */
import { DurableObject } from "cloudflare:workers";
import { WebMultiViewSync } from "@/sync";

type Sync = { SYNC: DurableObjectNamespace<WebMultiViewSync> };

type AssignedPosition = {
  startWidth: number;
  startHeight: number;
  endWidth: number;
  endHeight: number;
};

type State = {
  width: number;
  height: number;
  id: string;
  order: number;
  assignPosition: AssignedPosition;
};

type Data = {
  x: number;
  y: number;
  senderId: string;
};

export class WebMultiViewSession extends DurableObject<Sync> {
  users = new Map<string, State>();

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    const id = url.searchParams.get("id");

    if (!id) return new Response("Not Found", { status: 404 });

    const has = this.users.has(id);

    if (has) return new Response("Already Exists", { status: 400 });

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const width = Number(url.searchParams.get("width"));
    const height = Number(url.searchParams.get("height"));

    if (!width || !height) {
      return new Response("Invalid Request", { status: 400 });
    }

    const clientsLength = this.users.size;

    const isFirst = clientsLength === 0;

    const order = isFirst ? 1 : clientsLength + 1;

    const commonData = {
      id,
      width,
      height,
      order,
    };

    const allUsers = Array.from(this.users.values());

    const sortedUsers = allUsers.sort((a, b) => a.order - b.order);

    const prevUser = isFirst ? undefined : sortedUsers[clientsLength - 1];

    const assignPosition: AssignedPosition = {
      startWidth: 0,
      startHeight: 0,
      endWidth: width,
      endHeight: height,
    };

    if (isFirst || !prevUser) {
      const state: State = {
        ...commonData,
        assignPosition,
      };
      this.users.set(id, state);
      this.ctx.acceptWebSocket(server, [id]);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    const isOdd = order % 2 !== 0;

    if (isOdd) {
      const prevOddUser = sortedUsers.find((user) => user.order - 1 === order);
      const { endHeight } = prevUser.assignPosition;

      const startHeight = endHeight;
      const startWidth = prevOddUser ? prevOddUser.assignPosition.endWidth : 0;

      assignPosition.startHeight = startHeight;
      assignPosition.startWidth = startWidth;

      assignPosition.endHeight = startHeight + height;
      assignPosition.endWidth = startWidth + width;
    } else {
      const prevEvenUser = sortedUsers.find((user) => user.order === order - 2);

      const { endWidth } = prevUser.assignPosition;

      const startHeight = prevEvenUser
        ? prevEvenUser.assignPosition.endHeight
        : 0;
      const startWidth = endWidth;

      assignPosition.startHeight = startHeight;
      assignPosition.startWidth = startWidth;

      assignPosition.endHeight = startHeight + height;
      assignPosition.endWidth = startWidth + width;
    }

    const state: State = {
      ...commonData,
      assignPosition,
    };

    this.users.set(id, state);
    this.ctx.acceptWebSocket(server, [id]);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, m: ArrayBuffer | string) {
    const data = JSON.parse(m.toString()) as Data;

    const sockets = this.ctx.getWebSockets();

    const target = this.users.get(data.senderId);
    if (!target) return;

    for (const socket of sockets) {
      const tag = this.ctx.getTags(socket);
      if (!tag) continue;
      const me = this.users.get(tag[0]);
      if (!me) continue;
      if (socket === ws) continue;

      const { x, y } = data;

      const newX =
        x - me.assignPosition.startWidth + target.assignPosition.startWidth;
      const newY =
        y - me.assignPosition.startHeight + target.assignPosition.startHeight;
      socket.send(
        JSON.stringify({ x: newX, y: newY, senderId: data.senderId })
      );
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    const tag = this.ctx.getTags(ws);

    if (!tag) {
      ws.close(code, "Durable Object is closing WebSocket");

      return;
    }

    const id = tag[0];

    this.users.delete(id);

    ws.close(code, "Durable Object is closing WebSocket");
  }
}
