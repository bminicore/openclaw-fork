import { spawn } from "node:child_process";
import {
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgram,
} from "openclaw/plugin-sdk/windows-spawn";
import type { CodexAppServerStartOptions } from "./config.js";
import type { CodexAppServerTransport } from "./transport.js";

type CodexAppServerSpawnRuntime = {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  execPath: string;
};

const DEFAULT_SPAWN_RUNTIME: CodexAppServerSpawnRuntime = {
  platform: process.platform,
  env: process.env,
  execPath: process.execPath,
};

const CODEX_APP_SERVER_DEFAULT_CLEAR_ENV = [
  "AZURE_OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_API_KEYS",
  "OPENAI_API_KEY_SECONDARY",
] as const;

export function createCodexAppServerProcessEnv(
  processEnv: NodeJS.ProcessEnv,
  options: CodexAppServerStartOptions,
): NodeJS.ProcessEnv {
  const env = {
    ...processEnv,
    ...options.env,
  };
  for (const key of [...CODEX_APP_SERVER_DEFAULT_CLEAR_ENV, ...(options.clearEnv ?? [])]) {
    delete env[key];
  }
  return env;
}

export function resolveCodexAppServerSpawnInvocation(
  options: CodexAppServerStartOptions,
  runtime: CodexAppServerSpawnRuntime = DEFAULT_SPAWN_RUNTIME,
): { command: string; args: string[]; shell?: boolean; windowsHide?: boolean } {
  const program = resolveWindowsSpawnProgram({
    command: options.command,
    platform: runtime.platform,
    env: runtime.env,
    execPath: runtime.execPath,
    packageName: "@openai/codex",
  });
  const resolved = materializeWindowsSpawnProgram(program, options.args);
  return {
    command: resolved.command,
    args: resolved.argv,
    shell: resolved.shell,
    windowsHide: resolved.windowsHide,
  };
}

export function createStdioTransport(options: CodexAppServerStartOptions): CodexAppServerTransport {
  const env = createCodexAppServerProcessEnv(process.env, options);
  const invocation = resolveCodexAppServerSpawnInvocation(options, {
    platform: process.platform,
    env,
    execPath: process.execPath,
  });
  return spawn(invocation.command, invocation.args, {
    env,
    detached: process.platform !== "win32",
    shell: invocation.shell,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: invocation.windowsHide,
  });
}
