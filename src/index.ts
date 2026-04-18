#!/usr/bin/env node
import path from 'path';
import { loadPlan, executePlan, listPlanWorkers } from './orchestrator';
import { spawnWorker } from './worker';
import { mergeOutputs } from './merge';
import { cleanWorkers } from './file-comm';
import { startGui } from './gui/server';

const BASE_DIR = process.cwd();

function printHelp(): void {
  console.log(`
  ldmux - Local dmux for Windows Terminal
  ========================================

  Multi-agent orchestrator that runs Claude Code sessions in parallel.

  Usage:
    npx ts-node src/index.ts <command> [options]

  Commands:
    new <prompt>          Create a single worker with the given prompt
    run <plan.json>       Execute a task plan from JSON file
    list                  List all workers and their status
    merge                 Merge all worker outputs into one file
    gui                   Start the web dashboard (http://localhost:3700)
    clean                 Remove all worker data
    help                  Show this help message

  Examples:
    npx ts-node src/index.ts new "Implement auth middleware"
    npx ts-node src/index.ts run plan.json
    npx ts-node src/index.ts gui

  Options:
    --no-pane             Don't open Windows Terminal panes (background only)
    --name <name>         Worker name (for 'new' command)
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'new': {
      const prompt = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
      if (!prompt) {
        console.error('  Error: Please provide a prompt.\n');
        console.error('  Usage: npx ts-node src/index.ts new "Your prompt here"');
        process.exit(1);
      }
      const nameFlag = args.indexOf('--name');
      const name = nameFlag >= 0 ? args[nameFlag + 1] : `worker-${Date.now()}`;
      console.log(`\n  Creating worker: ${name}`);
      spawnWorker(BASE_DIR, { name, prompt });
      console.log(`  Worker "${name}" started.\n`);
      break;
    }

    case 'run': {
      const planPath = args[1];
      if (!planPath) {
        console.error('  Error: Please provide a plan file.\n');
        console.error('  Usage: npx ts-node src/index.ts run plan.json');
        process.exit(1);
      }
      const usePane = !args.includes('--no-pane');
      const plan = loadPlan(planPath);
      await executePlan(BASE_DIR, plan, usePane);
      break;
    }

    case 'list': {
      listPlanWorkers(BASE_DIR);
      break;
    }

    case 'merge': {
      mergeOutputs(BASE_DIR);
      break;
    }

    case 'gui': {
      startGui(BASE_DIR);
      break;
    }

    case 'clean': {
      cleanWorkers(BASE_DIR);
      console.log('  All worker data cleaned.\n');
      break;
    }

    default: {
      console.error(`  Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('  Fatal error:', err.message);
  process.exit(1);
});
