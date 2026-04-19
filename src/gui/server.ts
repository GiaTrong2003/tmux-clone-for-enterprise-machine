import express from 'express';
import path from 'path';
import { listWorkers, listWorkersLive, readOutput, readOutputTail, readStatus, readTask, clearOutput, cleanWorkers, readSession } from '../file-comm';
import { spawnWorker, stopWorker } from '../worker';
import { mergeOutputs } from '../merge';
import { listAgents, readAgentConfig, updateAgentConfig, deleteAgent } from '../agent-config';
import { resetAgent } from '../agent';

const PORT = 3700;

export function startGui(baseDir: string, agentDir: string = baseDir): void {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API: List all workers
  app.get('/api/workers', (_req, res) => {
    const workers = listWorkers(baseDir);
    res.json(workers);
  });

  // API: List workers enriched with liveness info (PID alive check, output mtime/size)
  app.get('/api/workers/live', (_req, res) => {
    res.json(listWorkersLive(baseDir));
  });

  // API: Get worker output
  app.get('/api/workers/:name/output', (req, res) => {
    const output = readOutput(baseDir, req.params.name);
    res.json({ name: req.params.name, output });
  });

  // API: Incremental tail — returns only bytes appended since `since`
  app.get('/api/workers/:name/tail', (req, res) => {
    const since = parseInt(String(req.query.since || '0'), 10) || 0;
    const { chunk, size } = readOutputTail(baseDir, req.params.name, since);
    res.json({ name: req.params.name, chunk, size });
  });

  // API: Get worker status
  app.get('/api/workers/:name/status', (req, res) => {
    const status = readStatus(baseDir, req.params.name);
    if (status) {
      res.json(status);
    } else {
      res.status(404).json({ error: 'Worker not found' });
    }
  });

  // API: Create new worker
  app.post('/api/workers', (req, res) => {
    const { name, prompt, cwd, agent } = req.body;
    if (!name || !prompt) {
      res.status(400).json({ error: 'name and prompt are required' });
      return;
    }
    try {
      spawnWorker(baseDir, { name, prompt, cwd, agent });
      res.json({ success: true, name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Stop a worker
  app.post('/api/workers/:name/stop', (req, res) => {
    const stopped = stopWorker(req.params.name);
    res.json({ success: stopped, name: req.params.name });
  });

  // API: Retry a worker — reuses original prompt, clears old output
  app.post('/api/workers/:name/retry', (req, res) => {
    const name = req.params.name;
    const current = readStatus(baseDir, name);
    if (current && current.status === 'running') {
      res.status(409).json({ error: 'Worker is currently running. Stop it first.' });
      return;
    }
    const prompt = readTask(baseDir, name);
    if (!prompt) {
      res.status(404).json({ error: 'Task file not found — cannot retry.' });
      return;
    }
    try {
      stopWorker(name); // no-op if not tracked; safety
      clearOutput(baseDir, name);
      spawnWorker(baseDir, { name, prompt });
      res.json({ success: true, name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Persistent agents ---

  // API: List all agents (those with agent.json) + session stats
  app.get('/api/agents', (_req, res) => {
    const agents = listAgents(agentDir).map(cfg => {
      const session = readSession(agentDir, cfg.name);
      const status = readStatus(agentDir, cfg.name);
      return {
        ...cfg,
        status: status?.status,
        turns: session?.turns ?? 0,
        totalCostUsd: session?.totalCostUsd ?? 0,
        lastActiveAt: session?.lastActiveAt,
        hasSession: !!session,
      };
    });
    res.json(agents);
  });

  // API: Get single agent config + session/status
  app.get('/api/agents/:name', (req, res) => {
    const cfg = readAgentConfig(agentDir, req.params.name);
    if (!cfg) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const session = readSession(agentDir, cfg.name);
    const status = readStatus(agentDir, cfg.name);
    res.json({
      ...cfg,
      status: status?.status,
      turns: session?.turns ?? 0,
      totalCostUsd: session?.totalCostUsd ?? 0,
      lastActiveAt: session?.lastActiveAt,
      hasSession: !!session,
    });
  });

  // API: Update agent config (soul/skill/cwd/model). Pass null to clear a field.
  // Query `?reset=true` resets the session after save (applies new soul/skill).
  app.patch('/api/agents/:name', (req, res) => {
    const { soul, skill, cwd, model } = req.body ?? {};
    const status = readStatus(agentDir, req.params.name);
    if (status?.status === 'running') {
      res.status(409).json({ error: 'Agent is running. Wait for it to finish before editing.' });
      return;
    }
    try {
      const { updated, soulOrSkillChanged } = updateAgentConfig(agentDir, req.params.name, {
        soul, skill, cwd, model,
      });
      let didReset = false;
      if (req.query.reset === 'true' && soulOrSkillChanged) {
        resetAgent(agentDir, req.params.name);
        didReset = true;
      }
      res.json({ success: true, updated, soulOrSkillChanged, didReset });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // API: Delete agent (removes entire folder: config, session, history, logs)
  app.delete('/api/agents/:name', (req, res) => {
    const status = readStatus(agentDir, req.params.name);
    if (status?.status === 'running') {
      res.status(409).json({ error: 'Agent is running. Stop or wait before deleting.' });
      return;
    }
    try {
      deleteAgent(agentDir, req.params.name);
      res.json({ success: true });
    } catch (err: any) {
      const msg = err.message as string;
      const code = msg.includes('not found') ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  // API: Reset agent session (keeps soul/skill, wipes history + session)
  app.post('/api/agents/:name/reset', (req, res) => {
    const status = readStatus(agentDir, req.params.name);
    if (status?.status === 'running') {
      res.status(409).json({ error: 'Agent is running. Stop or wait before resetting.' });
      return;
    }
    try {
      resetAgent(agentDir, req.params.name);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // API: Merge all outputs
  app.post('/api/merge', (_req, res) => {
    const merged = mergeOutputs(baseDir);
    res.json({ success: true, output: merged });
  });

  // API: Clean all workers
  app.post('/api/clean', (_req, res) => {
    cleanWorkers(baseDir);
    res.json({ success: true });
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────┐');
    console.log('  │        ldmux - Web Dashboard         │');
    console.log('  │                                      │');
    console.log(`  │   http://localhost:${PORT}              │`);
    console.log('  │                                      │');
    console.log('  │   Press Ctrl+C to stop               │');
    console.log('  └─────────────────────────────────────┘');
    console.log('');
  });
}
