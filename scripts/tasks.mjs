import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const api = path.join(root, "apps/api");
const uv = [
  "-m",
  "uv",
  "run",
  "--locked",
  "--env-file",
  path.join(root, ".env").replaceAll("\\", "/"),
];
const python = process.platform === "win32" ? "python" : "python3";

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function backend(...args) {
  run(python, [...uv, ...args], api);
}

function pnpm(...args) {
  // npm_execpath avoids a shell and Windows .cmd quoting problems.
  if (!process.env.npm_execpath) throw new Error("Run this task through pnpm.");
  run(process.execPath, [process.env.npm_execpath, ...args]);
}

function checkApi() {
  backend("ruff", "format", "--check", ".", "../../scripts");
  backend("ruff", "check", ".", "../../scripts");
  backend("mypy", ".");
  backend("python", "manage.py", "check", "--fail-level", "WARNING");
  backend("python", "manage.py", "makemigrations", "--check", "--dry-run");
  backend(
    "python",
    "manage.py",
    "spectacular",
    "--validate",
    "--fail-on-warn",
    "--file",
    "../../docs/openapi.yaml",
  );
  backend("pytest");
}

switch (process.argv[2]) {
  case "dev-api":
    backend("python", "manage.py", "runserver", "127.0.0.1:8000");
    break;
  case "migrate":
    backend("python", "manage.py", "migrate");
    break;
  case "check-api":
    checkApi();
    break;
  case "check":
    checkApi();
    for (const task of ["format:check", "lint", "typecheck", "test", "build"])
      pnpm(task);
    break;
  default:
    throw new Error("Unknown task.");
}
