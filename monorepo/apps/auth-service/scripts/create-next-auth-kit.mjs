#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceRoot = path.resolve(__dirname, "..");

const AUTH_FILES = [
  "app/api/auth/signup/route.ts",
  "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/auth/me/route.ts",
  "app/api/auth/verify-email/route.ts",
  "app/api/auth/forgot-password/route.ts",
  "app/api/auth/reset-password/route.ts",
  "app/(public)/login/page.tsx",
  "app/(public)/signup/page.tsx",
  "app/(public)/forgot-password/page.tsx",
  "app/(public)/reset-password/page.tsx",
  "app/(protected)/dashboard/page.tsx",
  "app/verify-email/page.tsx",
  "components/auth/AuthCard.tsx",
  "components/auth/LoginForm.tsx",
  "components/auth/SignupForm.tsx",
  "components/auth/LogoutButton.tsx",
  "components/ui/Button.tsx",
  "components/ui/FormError.tsx",
  "components/ui/Input.tsx",
  "components/ui/PasswordInput.tsx",
  "hooks/useAuth.ts",
  "lib/auth/authService.ts",
  "lib/auth/cookies.ts",
  "lib/auth/env.ts",
  "lib/auth/jwt.ts",
  "lib/auth/password.ts",
  "lib/auth/session.ts",
  "lib/auth/validators.ts",
  "lib/db/client.ts",
  "lib/db/userRepo.ts",
  "lib/email/resend.ts",
  "lib/email/tokens.ts",
  "types/auth.ts",
  "types/user.ts",
  "proxy.ts",
];

const OPTIONAL_FILES = {
  "with-landing": ["app/page.tsx"],
};

const REQUIRED_DEPENDENCIES = {
  bcryptjs: "^3.0.3",
  jose: "^6.2.2",
  mongoose: "^9.3.3",
  resend: "^6.9.4",
  zod: "^4.3.6",
};

function parseArgs(argv) {
  const args = {
    target: process.cwd(),
    force: false,
    withLanding: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--target") {
      args.target = path.resolve(argv[i + 1] || process.cwd());
      i += 1;
      continue;
    }

    if (token === "--force") {
      args.force = true;
      continue;
    }

    if (token === "--with-landing") {
      args.withLanding = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log("create-next-auth-kit\n");
  console.log("Usage:");
  console.log(
    "  create-next-auth-kit [--target <path>] [--force] [--with-landing]",
  );
  console.log("\nOptions:");
  console.log(
    "  --target <path>     Target Next.js project path (default: current directory)",
  );
  console.log("  --force             Overwrite existing files");
  console.log("  --with-landing      Also copy app/page.tsx landing page");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureNextProject(targetRoot) {
  const pkgPath = path.join(targetRoot, "package.json");
  const appPath = path.join(targetRoot, "app");

  if (!(await pathExists(pkgPath))) {
    throw new Error(`No package.json found in target: ${targetRoot}`);
  }

  if (!(await pathExists(appPath))) {
    throw new Error(`No app/ directory found in target: ${targetRoot}`);
  }
}

async function copyFile(sourceRootPath, targetRootPath, relativePath, force) {
  const sourcePath = path.join(sourceRootPath, relativePath);
  const targetPath = path.join(targetRootPath, relativePath);

  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source template file missing: ${relativePath}`);
  }

  if (!force && (await pathExists(targetPath))) {
    throw new Error(
      `Target file already exists: ${relativePath} (use --force to overwrite)`,
    );
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function updatePackageJson(targetRoot) {
  const packageJsonPath = path.join(targetRoot, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw);

  pkg.dependencies = pkg.dependencies || {};

  for (const [name, version] of Object.entries(REQUIRED_DEPENDENCIES)) {
    if (!pkg.dependencies[name]) {
      pkg.dependencies[name] = version;
    }
  }

  const serialized = `${JSON.stringify(pkg, null, 2)}\n`;
  await fs.writeFile(packageJsonPath, serialized, "utf8");
}

async function updateTsConfigAlias(targetRoot) {
  const tsconfigPath = path.join(targetRoot, "tsconfig.json");
  if (!(await pathExists(tsconfigPath))) {
    return;
  }

  const raw = await fs.readFile(tsconfigPath, "utf8");
  const tsconfig = JSON.parse(raw);

  tsconfig.compilerOptions = tsconfig.compilerOptions || {};

  if (!tsconfig.compilerOptions.baseUrl) {
    tsconfig.compilerOptions.baseUrl = ".";
  }

  tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

  if (!tsconfig.compilerOptions.paths["@/*"]) {
    tsconfig.compilerOptions.paths["@/*"] = ["./*"];
  }

  const serialized = `${JSON.stringify(tsconfig, null, 2)}\n`;
  await fs.writeFile(tsconfigPath, serialized, "utf8");
}

function upsertEnv(rawContent) {
  const lines = rawContent.split(/\r?\n/);
  const existing = new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0]),
  );

  const additions = [
    "",
    "# Auth kit",
    "JWT_SECRET=replace-with-a-long-random-secret",
    "JWT_EXPIRES_IN_SECONDS=3600",
    "BCRYPT_SALT_ROUNDS=10",
    "MONGODB_URI=mongodb://127.0.0.1:27017/auth_app",
    "MONGODB_DB_NAME=auth_app",
    "RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "EMAIL_FROM=noreply@yourdomain.com",
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  ].filter((line) => {
    if (!line || line.startsWith("#")) {
      return true;
    }

    const key = line.split("=")[0];
    return !existing.has(key);
  });

  const next = `${rawContent.trimEnd()}\n${additions.join("\n")}\n`;
  return next;
}

async function updateEnvFiles(targetRoot) {
  const envExamplePath = path.join(targetRoot, ".env.example");
  const envLocalPath = path.join(targetRoot, ".env.local");

  if (await pathExists(envExamplePath)) {
    const raw = await fs.readFile(envExamplePath, "utf8");
    await fs.writeFile(envExamplePath, upsertEnv(raw), "utf8");
  } else {
    await fs.writeFile(envExamplePath, upsertEnv(""), "utf8");
  }

  if (!(await pathExists(envLocalPath))) {
    await fs.writeFile(envLocalPath, upsertEnv(""), "utf8");
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const targetRoot = options.target;

  console.log(`Scaffolding auth kit into: ${targetRoot}`);

  await ensureNextProject(targetRoot);

  const filesToCopy = [...AUTH_FILES];
  if (options.withLanding) {
    filesToCopy.push(...OPTIONAL_FILES["with-landing"]);
  }

  for (const relativePath of filesToCopy) {
    await copyFile(sourceRoot, targetRoot, relativePath, options.force);
  }

  await updatePackageJson(targetRoot);
  await updateTsConfigAlias(targetRoot);
  await updateEnvFiles(targetRoot);

  console.log("\nAuth kit scaffold complete.");
  console.log("Next steps:");
  console.log("  1) cd", targetRoot);
  console.log("  2) npm install");
  console.log("  3) Fill .env.local values");
  console.log("  4) npm run dev");
}

run().catch((error) => {
  console.error("\nFailed to scaffold auth kit:");
  console.error(error.message);
  process.exit(1);
});
