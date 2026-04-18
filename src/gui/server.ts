import express from 'express';
import path from 'path';
import { listWorkers, readOutput, readStatus, readTask, clearOutput, cleanWorkers } from '../file-comm';
import { spawnWorker, stopWorker } from '../worker';
import { mergeOutputs } from '../merge';

const PORT = 3700;

export function startGui(baseDir: string): void {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API: List all workers
  app.get('/api/workers', (_req, res) => {
    const workers = listWorkers(baseDir);
    res.json(workers);
  });

  // API: Get worker output
  app.get('/api/workers/:name/output', (req, res) => {
    const output = readOutput(baseDir, req.params.name);
    res.json({ name: req.params.name, output });
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
