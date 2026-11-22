import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

for (let attempt = 0; attempt < 50; attempt++) {
  try {
    const response = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(1000) });
    await response.body?.cancel();
    if (response.ok) {
      spawn("cmd.exe", ["/d", "/c", "start", "", "http://localhost:3000"], { windowsHide: true, stdio: "ignore" });
      break;
    }
  } catch {
    // The server is still starting.
  }
  await wait(300);
}
