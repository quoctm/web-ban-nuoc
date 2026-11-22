import nextEnv from "@next/env";
import { createConnection } from "node:net";

export function loadLocalEnvironment() {
  nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
}

export async function requireStoppedServer() {
  const running = await new Promise((done, reject) => {
    const socket = createConnection(3000, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); done(true); });
    socket.once("error", (error) => error.code === "ECONNREFUSED" ? done(false) : reject(error));
  });
  if (running) throw new Error("Hãy dừng website trước khi dùng lệnh thao tác trên kho dữ liệu.");
}
