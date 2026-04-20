import { useState, useCallback } from 'react';
import { EmptyState } from '../common/EmptyState';
import { AutonomyHeader } from './AutonomyHeader';
import { OrgChart } from './OrgChart';
import { ConversationFeed } from './ConversationFeed';
import { NodeDrawer } from './NodeDrawer';
import { KickoffModal } from './KickoffModal';
import { InitCompanyModal } from './InitCompanyModal';
import { EditAgentModal } from '../agents/EditAgentModal';
import { getCompany, setAutonomyOverride } from '../../api/company';
import { usePolling } from '../../hooks/usePolling';
import type { Autonomy } from '../../types/api';

interface Props {
  paused: boolean;
  onAgentsChanged: () => void;
}

export function CompanyTab({ paused, onAgentsChanged }: Props) {
  const { data, refresh } = usePolling(getCompany, 3000, paused);
  const company = data ?? { agents: [], conversations: [], autonomyOverride: null };

  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showKickoff, setShowKickoff] = useState(false);
  const [showInit, setShowInit] = useState(false);

  const handleAutonomy = useCallback(async (v: Autonomy | null) => {
    try {
      await setAutonomyOverride(v);
      refresh();
    } catch (err: any) {
      alert('Autonomy update failed: ' + err.message);
    }
  }, [refresh]);

  const onChanged = useCallback(() => {
    refresh();
    onAgentsChanged();
  }, [refresh, onAgentsChanged]);

  const hasAgents = company.agents.length > 0;

  return (
    <>
      <AutonomyHeader
        override={company.autonomyOverride}
        onChange={handleAutonomy}
        onInit={() => setShowInit(true)}
        onKickoff={() => setShowKickoff(true)}
        hasAgents={hasAgents}
      />

      {!hasAgents ? (
        <EmptyState
          title="No company yet"
          description="Seed a starter hierarchy: CEO + BE/FE/QA managers."
          action={<button className="primary" onClick={() => setShowInit(true)}>Init company</button>}
        />
      ) : (
        <>
          <OrgChart agents={company.agents} onOpenNode={setDrawerName} />
          <ConversationFeed conversations={company.conversations} />
        </>
      )}

      <NodeDrawer
        open={drawerName != null}
        name={drawerName}
        agents={company.agents}
        onClose={() => setDrawerName(null)}
        onChanged={onChanged}
        onEdit={(name) => { setEditing(name); setDrawerName(null); }}
      />

      <KickoffModal
        open={showKickoff}
        agents={company.agents}
        onClose={() => setShowKickoff(false)}
        onDone={onChanged}
      />

      <InitCompanyModal
        open={showInit}
        onClose={() => setShowInit(false)}
        onDone={onChanged}
      />

      <EditAgentModal
        open={editing != null}
        name={editing}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
    </>
  );
}
