import { Messages } from "./types";

import type {
	ChatMessage,
	GenericServerMessage,
	JoinMessage,
	MouseMessage,
	MoveMessage,
} from "./types";

export function encodeMsg(msg: GenericServerMessage): Uint8Array {
	if (msg.type >= Messages.length) {
		throw new Error("Unknown message type" + msg.type);
	}
	const type = Messages[msg.type];

	switch (type) {
		case "MSG_HOST":
		case "MSG_LEAVE":
		case "MSG_START":
		case "MSG_TEAM":
		case "MSG_SHOOT": {
			const buf = new Uint8Array(1);
			buf[0] = msg.type;
			return buf;
		}
		case "MSG_JOIN": {
			const data = msg.data as JoinMessage;
			const buf = new Uint8Array(5);
			buf[0] = msg.type;
			const { room } = data;
			if (room.length > 4) {
				throw new Error("Room name too long");
			}
			const roomBuf = new TextEncoder().encode(room);
			buf.set(roomBuf, 1);
			return buf;
		}
		case "MSG_MOVE": {
			const data = msg.data as MoveMessage;
			const { direction, start } = data;
			const buf = new Uint8Array(2);
			buf[0] = msg.type;
			let flags = 0;
			switch (direction) {
				case "up":
					flags |= 1 << 0;
					break;
				case "down":
					flags |= 1 << 1;
					break;
				case "left":
					flags |= 1 << 2;
					break;
				case "right":
					flags |= 1 << 3;
					break;
			}
			if (start) {
				flags |= 1 << 4;
			}
			buf[1] = flags;
			return buf;
		}
		case "MSG_CHAT": {
			const data = msg.data as ChatMessage;
			const sz = data.message.length;
			if (sz > 255) {
				throw new Error("Message too long");
			}
			const buf = new Uint8Array(sz + 1 + 1); // for type and size
			buf[0] = msg.type;
			buf[1] = sz;
			const msgBuf = new TextEncoder().encode(data.message);
			buf.set(msgBuf, 2);
			return buf;
		}
		case "MSG_MOUSE": {
			const data = msg.data as MouseMessage;
			const { x, y } = data;

			const buf = new ArrayBuffer(9);
			const view = new DataView(buf);
			view.setUint8(0, msg.type);
			view.setInt32(1, x, true);
			view.setInt32(5, y, true);

			return new Uint8Array(buf);
		}
		case "MSG_CNCT":
		case "MSG_HOSTED":
		case "MSG_JOINED":
		case "MSG_LEFT":
		case "MSG_STARTED":
		case "MSG_SHOT":
		case "MSG_CHATTED":
		case "MSG_MAP":
		case "MSG_STATE":
		case "MSG_SYSTEM":
		case "MSG_ERROR":
		default:
			throw new Error("Not Sendable " + msg.type);
	}
}
