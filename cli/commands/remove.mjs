import fs from 'node:fs/promises';
import path from 'node:path';

import { AGENTS } from "../lib/agents.mjs";
import { assertSlug } from "../lib/validation.mjs";

function parseArgs(args) {
  const result = {
    skillName: null,
    agent: "claude",
    scope: "project",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--agent' && i + 1 < args.length) {
      result.agent = args[++i];
    } else if (arg === '--scope' && i + 1 < args.length) {
      result.scope = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (!arg.startsWith('-')) {
      result.skillName = arg;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage: npx aiskill remove <skill-name> [options]

Remove an installed skill

Arguments:
  <skill-name>         Name of the skill to remove

Options:
  --agent <name>       Target agent (claude, codex, opencode, cursor, antigravity)
                       Default: claude
  --scope <scope>      Installation scope (project, global)
                       Default: project
  --help, -h          Show this help message

Examples:
  npx aiskill remove ui-ux-pro-max
  npx aiskill remove ui-ux-pro-max --agent codex --scope global
`);
}

async function removeSkill(skillName, agent, scope) {
  assertSlug("skill-name", skillName);

  // Validate agent
  const agentConfig = AGENTS[agent];
  if (!agentConfig) {
    throw new Error(`Unknown agent "${agent}". Valid options: ${Object.keys(AGENTS).join(', ')}`);
  }

  // Validate scope
  if (scope !== 'project' && scope !== 'global') {
    throw new Error(`Invalid scope "${scope}". Valid options: project, global`);
  }

  console.log(`\n🗑️  Removing skill: ${skillName}`);
  console.log(`   Agent: ${agentConfig.label}`);
  console.log(`   Scope: ${scope}\n`);

  // Determine target directory
  const targetBaseDir =
    scope === "project" ? path.resolve(process.cwd(), agentConfig.projectDir) : agentConfig.globalDir;
  const resolvedBase = path.resolve(targetBaseDir);
  const targetDir = path.resolve(targetBaseDir, skillName);
  if (!targetDir.startsWith(resolvedBase + path.sep)) {
    throw new Error("Refusing to remove outside the agent skills directory");
  }

  // Check if skill exists
  try {
    await fs.access(targetDir);
  } catch {
    console.log(`⚠️  Skill not found at: ${targetDir}`);
    console.log('   Nothing to remove.\n');
    return;
  }

  // Verify it's a directory
  const stats = await fs.stat(targetDir);
  if (!stats.isDirectory()) {
    throw new Error(`Expected directory but found file: ${targetDir}`);
  }

  // Remove the directory
  console.log('🗑️  Removing files...');
  await fs.rm(targetDir, { recursive: true, force: true });

  console.log(`\n✅ Successfully removed skill from: ${targetDir}\n`);
}

export async function removeCommand(args) {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  if (!parsed.skillName) {
    console.error('Error: Missing required argument <skill-name>');
    console.error('Run "npx aiskill remove --help" for usage information');
    process.exit(1);
  }

  await removeSkill(parsed.skillName, parsed.agent, parsed.scope);
}
