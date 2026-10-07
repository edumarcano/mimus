import { spawn } from "node:child_process";
import http from "node:http";

const demoOrigin = process.env.E2E_DEMO_ORIGIN ?? "http://localhost:3000";
const livePort = process.env.E2E_LIVE_PORT ?? "3001";
const deadlineMs = 240_000;
const started = Date.now();

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForDemo() {
  while (Date.now() - started < deadlineMs) {
    if (await probe(demoOrigin)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`Timed out waiting for demo server at ${demoOrigin}`);
  process.exit(1);
}

await waitForDemo();

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "start", "--", "-p", livePort],
  {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
