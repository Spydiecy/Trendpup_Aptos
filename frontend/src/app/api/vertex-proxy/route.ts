import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

const TMUX_SESSION = 'agent';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToTmux(message: string): Promise<string> {
  if (message.trim() === '__ping__') {
    return 'pong';
  }
  execSync(`tmux send-keys -t ${TMUX_SESSION} "${message}" Enter`);
  const maxWaitMs = 12000; // 12 seconds max
  const pollInterval = 400; // ms
  let waited = 0;
  let lastResponse = '';
  while (waited < maxWaitMs) {
    await sleep(pollInterval);
    waited += pollInterval;
    const output = execSync(`tmux capture-pane -t ${TMUX_SESSION} -p -S -80`).toString();
    const userMsgIdx = output.lastIndexOf(`[user]: ${message}`);
    if (userMsgIdx !== -1) {
      const afterUserMsg = output.slice(userMsgIdx);
      const match = afterUserMsg.match(/\[ask_rag_agent\]:([\s\S]*?)(?=\n\[|$)/);
      if (match) {
        return match[1].trim();
      }
    }
    // Fallback: update last agent response if found
    const fallbackMatch = output.match(/\[ask_rag_agent\]:([\s\S]*?)(?=\n\[|$)/);
    if (fallbackMatch) {
      lastResponse = fallbackMatch[1].trim();
    }
  }
  return lastResponse || 'No response from agent.';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }
    const response = await sendToTmux(message);
    return NextResponse.json({ response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error', stack: error.stack }, { status: 500 });
  }
}