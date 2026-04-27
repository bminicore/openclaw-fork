import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CodexAppServerStartOptions } from "./config.js";
import {
  createCodexAppServerProcessEnv,
  resolveCodexAppServerSpawnInvocation,
} from "./transport-stdio.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "openclaw-codex-spawn-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

function startOptions(command: string): CodexAppServerStartOptions {
  return {
    transport: "stdio",
    command,
    args: ["app-server", "--listen", "stdio://"],
    headers: {},
  };
}

describe("resolveCodexAppServerSpawnInvocation", () => {
  it("keeps non-Windows Codex app-server invocation unchanged", () => {
    const resolved = resolveCodexAppServerSpawnInvocation(startOptions("codex"), {
      platform: "darwin",
      env: {},
      execPath: "/usr/local/bin/node",
    });

    expect(resolved).toEqual({
      command: "codex",
      args: ["app-server", "--listen", "stdio://"],
      shell: undefined,
      windowsHide: undefined,
    });
  });

  it("resolves Windows npm .cmd Codex shims through Node instead of raw spawn", async () => {
    const binDir = await createTempDir();
    const entryPath = path.join(binDir, "node_modules", "@openai", "codex", "bin", "codex.js");
    const shimPath = path.join(binDir, "codex.cmd");
    await mkdir(path.dirname(entryPath), { recursive: true });
    await writeFile(entryPath, "console.log('codex')\n", "utf8");
    await writeFile(
      shimPath,
      '@ECHO off\r\n"%~dp0\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n',
      "utf8",
    );

    const resolved = resolveCodexAppServerSpawnInvocation(startOptions("codex"), {
      platform: "win32",
      env: { PATH: binDir, PATHEXT: ".CMD;.EXE;.BAT" },
      execPath: "C:\\node\\node.exe",
    });

    expect(resolved).toEqual({
      command: "C:\\node\\node.exe",
      args: [entryPath, "app-server", "--listen", "stdio://"],
      shell: undefined,
      windowsHide: true,
    });
  });
});

describe("createCodexAppServerProcessEnv", () => {
  it("removes inherited API key environment variables by default", () => {
    const env = createCodexAppServerProcessEnv(
      {
        AZURE_OPENAI_API_KEY: "azure-key",
        CODEX_API_KEY: "codex-key",
        OPENAI_API_KEY: "openai-key",
        OPENAI_API_KEYS: "openai-keys",
        OPENAI_API_KEY_SECONDARY: "secondary-key",
        PATH: "/usr/bin",
      },
      startOptions("codex"),
    );

    expect(env).toEqual({ PATH: "/usr/bin" });
  });

  it("keeps explicit child env overrides unless clearEnv removes them", () => {
    const env = createCodexAppServerProcessEnv(
      {
        PATH: "/usr/bin",
        SHOULD_CLEAR: "parent",
      },
      {
        ...startOptions("codex"),
        clearEnv: ["SHOULD_CLEAR"],
        env: {
          SHOULD_KEEP: "child",
        },
      },
    );

    expect(env).toEqual({
      PATH: "/usr/bin",
      SHOULD_KEEP: "child",
    });
  });
});
