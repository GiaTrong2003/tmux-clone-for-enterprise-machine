import { useState } from 'react';
import { Modal } from '../common/Modal';
import { formatTimeHMS, formatDurationMs, formatCost, formatDateTime } from '../../utils/format';
import type { ConversationEntry } from '../../types/api';
import './ConversationFeed.css';

interface Props {
  conversations: ConversationEntry[];
}

export function ConversationFeed({ conversations }: Props) {
  const [detail, setDetail] = useState<ConversationEntry | null>(null);

  return (
    <div className="conv-feed">
      <div className="conv-feed-header">
        <h3>Conversation feed</h3>
        <span className="conv-feed-count">
          {conversations.length} exchange{conversations.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="conv-feed-body">
        {conversations.length === 0 ? (
          <div className="conv-feed-empty">No conversations yet. Kick off a task to see agents chat.</div>
        ) : (
          [...conversations].reverse().map((c, i) => (
            <button key={`${c.timestamp}-${i}`} className="conv-row" onClick={() => setDetail(c)}>
              <span className="conv-time">{formatTimeHMS(c.timestamp)}</span>
              <span className="conv-from">{c.from}</span>
              <span className="conv-arrow">→</span>
              <span className="conv-to">{c.to}</span>
              <span className="conv-q">{c.question.slice(0, 140)}</span>
              <span className="conv-meta">
                {formatDurationMs(c.durationMs)} · {formatCost(c.costUsd)}
              </span>
            </button>
          ))
        )}
      </div>

      <Modal
        open={!!detail}
        title={detail ? `${detail.from} → ${detail.to}` : ''}
        onClose={() => setDetail(null)}
        width={720}
      >
        {detail && (
          <>
            <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
              {formatDateTime(detail.timestamp)} · {formatDurationMs(detail.durationMs)} · {formatCost(detail.costUsd)}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Question</div>
              <pre className="conv-detail-pre">{detail.question}</pre>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Answer</div>
              <pre className="conv-detail-pre">{detail.answer}</pre>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
