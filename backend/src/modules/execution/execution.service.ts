import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PrismaClient } from '../../generated/prisma/client.js';

const prisma = new PrismaClient();

// ─── Language → Docker image + run command ───────────────────────────────────
// WHY DOCKER instead of Judge0 / isolate:
//   Judge0 uses `isolate` (v1.8.1, built 2021) to sandbox code execution.
//   On WSL2 kernels ≥ 5.15 (Docker Desktop for Windows), `isolate` crashes
//   with SIGSEGV (signal 11) after setting up bind-mounts but before execve,
//   because pivot_root() behaviour changed in new PID namespaces on modern
//   kernels. This issue is independent of cgroup version or seccomp settings.
//
//   Running code directly in Docker containers avoids isolate entirely while
//   still providing meaningful isolation (separate filesystem, network, process
//   tree) via Docker's built-in container primitives, which work on all platforms.
//
// NOTE ON SCOPE: only "javascript", "python"/"python3", and "java" are
// verified working as of this revision. Everything below the UNVERIFIED
// marker is untested and likely has issues (e.g. tools needing write access
// outside /code, which is mounted read-only). Verify each before trusting it.
// ─────────────────────────────────────────────────────────────────────────────
interface LangConfig {
  image: string;
  ext: string;
  cmd: string[];
}

const LANGUAGE_CONFIG: Record<string, LangConfig> = {
  javascript: {
    image: 'node:18-alpine',
    ext: 'js',
    cmd: ['node', '{file}'],
  },
  python: {
    image: 'python:3.12-alpine',
    ext: 'py',
    cmd: ['python3', '{file}'],
  },
  python3: {
    image: 'python:3.12-alpine',
    ext: 'py',
    cmd: ['python3', '{file}'],
  },
  java: {
    image: 'eclipse-temurin:21-jdk-alpine',
    ext: 'java',
    cmd: ['sh', '-c', 'javac -d /tmp /code/Main.java && java -cp /tmp Main'],
  },
  // ── UNVERIFIED below this line — test each individually before trusting it ──

  typescript: {
    image: 'node:18-alpine',
    ext: 'ts',
    cmd: ['node', '--experimental-strip-types', '{file}'],
  },
  cpp: {
    image: 'gcc:13',
    ext: 'cpp',
    cmd: ['sh', '-c', 'g++ -o /tmp/a.out /code/{file} && /tmp/a.out'],
  },
  c: {
    image: 'gcc:13',
    ext: 'c',
    cmd: ['sh', '-c', 'gcc -o /tmp/a.out /code/{file} && /tmp/a.out'],
  },
  go: {
    image: 'golang:1.22-alpine',
    ext: 'go',
    cmd: ['go', 'run', '{file}'],
  },
  ruby: {
    image: 'ruby:3.3-alpine',
    ext: 'rb',
    cmd: ['ruby', '{file}'],
  },
  rust: {
    image: 'rust:1.78-alpine',
    ext: 'rs',
    cmd: ['sh', '-c', 'rustc -o /tmp/a.out /code/{file} && /tmp/a.out'],
  },
  php: {
    image: 'php:8.3-alpine',
    ext: 'php',
    cmd: ['php', '{file}'],
  },
  kotlin: {
    image: 'zenika/kotlin:latest',
    ext: 'kt',
    cmd: ['sh', '-c', 'kotlinc /code/{file} -include-runtime -d /tmp/out.jar && java -jar /tmp/out.jar'],
  },
  csharp: {
    image: 'mcr.microsoft.com/dotnet/sdk:8.0-alpine',
    ext: 'cs',
    // Known broken: dotnet-script is not part of the base SDK image.
    // Needs a custom image or a different run strategy before this will work.
    cmd: ['sh', '-c', 'cd /tmp && dotnet-script /code/{file}'],
  },
  swift: {
    image: 'swift:5.10-focal',
    ext: 'swift',
    cmd: ['swift', '{file}'],
  },
};

// ─── Resource limits applied to every container ──────────────────────────────
const DOCKER_LIMITS = [
  '--memory=256m',
  '--memory-swap=256m',
  '--cpus=0.5',
  '--pids-limit=64',
  '--network=none',
  '--read-only',
  '--tmpfs=/tmp:size=32m',
];

const WALL_TIME_MS = 60_000;

export interface SubmitCodeParams {
  roomId: string;
  userId: string;
  code: string;
  language: string;
}

export interface ExecutionResult {
  submissionId: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  judge0Token: string | null;
}

// ─── Helper: forcibly stop a named container (best-effort) ───────────────────
// Killing the `docker` CLI client process does NOT stop the container itself —
// the client is just a thin process that talks to the Docker daemon, which
// keeps running the container independently. Without this, a submitted
// infinite loop would keep consuming CPU/memory on the host indefinitely,
// even after we've given up waiting and returned Time Limit Exceeded.
function killContainer(containerName: string) {
  try {
    const killer = spawn('docker', ['kill', containerName], { stdio: 'ignore' });
    killer.on('error', () => { /* already exited naturally; ignore */ });
  } catch {
    // best-effort cleanup
  }
}

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
  containerName: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      killContainer(containerName);
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.slice(0, 65_536),
        stderr: timedOut
          ? `Time limit exceeded (wall clock ${WALL_TIME_MS / 1000}s)\n${stderr}`.slice(0, 65_536)
          : stderr.slice(0, 65_536),
        exitCode: timedOut ? -1 : (exitCode ?? -1),
      });
    });
  });
}

export async function submitCode(params: SubmitCodeParams): Promise<ExecutionResult> {
  const { roomId, userId, code, language } = params;

  const langKey = language.trim().toLowerCase();
  const config = LANGUAGE_CONFIG[langKey];
  if (!config) {
    throw new Error(
      `Unsupported language "${language}". Supported: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`
    );
  }

  const submission = await prisma.submission.create({
    data: { roomId, userId, code, language, status: 'pending' },
  });

  try {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codeweave-'));
    const fileName = langKey === 'java' ? 'Main.java' : `solution.${config.ext}`;
    const filePath = path.join(tmpDir, fileName);
    await fs.promises.writeFile(filePath, code, 'utf8');

    const containerCmd = config.cmd.map((part) => part.replace('{file}', `/code/${fileName}`));

    const containerName = `codeweave-exec-${submission.id}`;

    const dockerArgs = [
      'run',
      '--rm',
      '--name', containerName,
      ...DOCKER_LIMITS,
      '-v', `${tmpDir}:/code:ro`,
      '-w', '/code',
      config.image,
      ...containerCmd,
    ];

    const { stdout, stderr, exitCode } = await runCommand('docker', dockerArgs, WALL_TIME_MS, containerName);

    fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => { });

    const dockerPullPattern = /^(Unable to find image|\S+: (Pulling|Waiting|Download complete|Pull complete|Verifying Checksum|Already exists)|Pulling from|Digest:|Status:|What's Next)/;
    const cleanedStderr = stderr
      .split('\n')
      .filter((line) => !dockerPullPattern.test(line.trim()))
      .join('\n')
      .trim();

    let status: string;
    if (stderr.startsWith('Time limit exceeded')) {
      status = 'Time Limit Exceeded';
    } else if (exitCode === 0) {
      status = 'Accepted';
    } else if (exitCode === 125 || exitCode === 127) {
      status = 'Internal Error';
    } else {
      status = 'Runtime Error';
    }

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status,
        stdout: stdout || null,
        stderr: cleanedStderr || null,
        judge0Token: null,
      },
    });

    return {
      submissionId: updated.id,
      status: updated.status,
      stdout: updated.stdout,
      stderr: updated.stderr,
      judge0Token: null,
    };
  } catch (err: any) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'error', stderr: err.message },
    });
    throw err;
  }
}

export async function getRoomSubmissions(roomId: string, limit = 20) {
  return prisma.submission.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}