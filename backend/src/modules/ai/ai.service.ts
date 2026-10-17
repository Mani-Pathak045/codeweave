import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '../../generated/prisma/client.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const prisma = new PrismaClient();

export interface ExplainErrorParams {
  roomId: string;
  userId: string;
  code: string;
  stderr: string;
}

export interface CodeReviewParams {
  roomId: string;
  userId: string;
  code: string;
  language: string;
}

export interface AiResponse {
  requestId: string;
  output: string;
}

async function generateWithRetry(prompt: string, maxAttempts = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
      });
      return result.text ?? '';
    } catch (err: any) {
      lastError = err;
      const isRetryable = err.message?.includes('503') || err.message?.includes('UNAVAILABLE');
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 1000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export async function explainError(params: ExplainErrorParams): Promise<AiResponse> {
  const { roomId, userId, code, stderr } = params;

  const prompt = `You are a helpful coding assistant. A user's code produced an error. Explain what went wrong in plain, simple English (2-4 sentences), then suggest a specific fix. Do not just repeat the error message back.

Code:
\`\`\`
${code}
\`\`\`

Error output:
\`\`\`
${stderr}
\`\`\`

Respond in plain text, no markdown headers.`;

  const output = await generateWithRetry(prompt);

  const aiRequest = await prisma.aiRequest.create({
    data: {
      roomId,
      userId,
      type: 'error_explain',
      input: `${code}\n---\n${stderr}`,
      output,
    },
  });

  return { requestId: aiRequest.id, output };
}

export async function reviewCode(params: CodeReviewParams): Promise<AiResponse> {
  const { roomId, userId, code, language } = params;

  const prompt = `You are a helpful code reviewer. Review the following ${language} code. Point out any bugs, potential issues, or improvements. Be concise — a short bulleted list is ideal. If the code looks fine, say so briefly rather than inventing issues.

Code:
\`\`\`${language}
${code}
\`\`\`

Respond in plain text, no markdown headers.`;

  const output = await generateWithRetry(prompt);

  const aiRequest = await prisma.aiRequest.create({
    data: {
      roomId,
      userId,
      type: 'code_review',
      input: code,
      output,
    },
  });

  return { requestId: aiRequest.id, output };
}