import { getDefaultRegistryRef, getDefaultRegistryUrl, normalizeRegistryUrl } from "../lib/config.mjs";
import { fetchRegistryIndex } from "../lib/registry.mjs";

function parseArgs(args) {
  const result = {
    registry: undefined,
    ref: undefined,
    format: 'table', // table or json
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--registry' && i + 1 < args.length) {
      result.registry = args[++i];
    } else if ((arg === '--ref' || arg === '--branch') && i + 1 < args.length) {
      result.ref = args[++i];
    } else if (arg === '--json') {
      result.format = 'json';
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage: npx aiskill list [options]

List all available skills in the registry

Options:
  --registry <url>     Custom registry URL
                       Default: $SKILL_REGISTRY_URL or package repository URL
  --ref <ref>          Git ref (branch or tag) to use
                       Default: $SKILL_REGISTRY_REF or "main"
  --json               Output in JSON format
  --help, -h          Show this help message

Examples:
  npx aiskill list
  npx aiskill list --json
  npx aiskill list --registry https://github.com/your-org/skills-repo --ref main
`);
}

async function fetchSkills(registry, ref) {
  const index = await fetchRegistryIndex(registry, ref);
  return index.skills ?? [];
}

function printTable(skills) {
  if (skills.length === 0) {
    console.log('No skills found in registry.');
    return;
  }

  console.log(`\n📚 Available Skills (${skills.length} total)\n`);

  // Group by category
  const byCategory = {};
  for (const skill of skills) {
    const cat = skill.category || 'uncategorized';
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(skill);
  }

  // Print each category
  for (const [category, categorySkills] of Object.entries(byCategory).sort()) {
    console.log(`\n${category.toUpperCase()}`);
    console.log('─'.repeat(60));

    for (const skill of categorySkills.sort((a, b) => a.id.localeCompare(b.id))) {
      const agents = skill.agents?.length > 0 ? ` [${skill.agents.join(', ')}]` : '';
      console.log(`  ${skill.id.padEnd(30)} ${skill.subcategory}${agents}`);
      if (skill.description) {
        const descText = typeof skill.description === "string"
          ? skill.description
          : (skill.description["en"] || Object.values(skill.description)[0] || "");
        const desc = descText.length > 80
          ? descText.slice(0, 77) + '...'
          : descText;
        console.log(`    ${desc}`);
      }
      console.log();
    }
  }

  console.log(`\nTo install a skill, run: npx aiskill add <skill-name>\n`);
}

export async function listCommand(args) {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  const registry = normalizeRegistryUrl(parsed.registry ?? (await getDefaultRegistryUrl()));
  if (!registry) {
    throw new Error('Registry URL not configured. Set SKILL_REGISTRY_URL or pass --registry.');
  }
  const ref = (parsed.ref ?? getDefaultRegistryRef()).trim() || "main";

  console.log('🔍 Fetching skills from registry...');
  const skills = await fetchSkills(registry, ref);

  if (parsed.format === 'json') {
    console.log(JSON.stringify(skills, null, 2));
  } else {
    printTable(skills);
  }
}
