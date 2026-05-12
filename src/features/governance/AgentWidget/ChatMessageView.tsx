import type { ChatMessage } from './useAgentChat';
import { ToolBadges } from './ToolBadge';

export function ChatMessageView({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  if (message.isLoading) {
    return (
      <div className="flex items-start gap-2">
        <BotAvatar />
        <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex h-4 items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <BotAvatar />}
      <div
        className={[
          'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-amber-400 text-black'
            : message.isError
              ? 'rounded-tl-sm border border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'rounded-tl-sm border border-white/10 bg-white/5 text-zinc-100',
        ].join(' ')}
      >
        <MessageBody content={message.content} />
        {!isUser && <ToolBadges actions={message.actions} />}
        <span className={`mt-1 block text-[10px] opacity-40 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">
      RS
    </div>
  );
}

function MessageBody({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        if (line === '') return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i} className="mb-0.5 last:mb-0">
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
              if (p.startsWith('`') && p.endsWith('`'))
                return (
                  <code key={j} className="rounded bg-white/10 px-1 font-mono text-[11px] text-amber-300">
                    {p.slice(1, -1)}
                  </code>
                );
              return <span key={j}>{p}</span>;
            })}
          </p>
        );
      })}
    </>
  );
}
