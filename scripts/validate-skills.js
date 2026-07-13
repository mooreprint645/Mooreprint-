'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skillsRoot = path.join(root, 'skills');
const errors = [];

const requiredFiles = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/architecture.md',
  'docs/superpowers/README.md',
  '.github/pull_request_template.md',
  'skills/README.md'
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Falta el archivo requerido: ${relativePath}`);
  }
}

if (!fs.existsSync(skillsRoot)) {
  errors.push('Falta el directorio skills/.');
} else {
  const directories = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  const names = new Set();

  for (const directory of directories) {
    const skillPath = path.join(skillsRoot, directory, 'SKILL.md');
    const relativeSkillPath = path.relative(root, skillPath);

    if (!fs.existsSync(skillPath)) {
      errors.push(`${directory}: falta SKILL.md`);
      continue;
    }

    const source = fs.readFileSync(skillPath, 'utf8');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);

    if (!frontmatter) {
      errors.push(`${relativeSkillPath}: frontmatter YAML inválido o ausente`);
      continue;
    }

    const name = frontmatter[1].match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*([^\r\n]+)$/m)?.[1]?.trim();
    const body = source.slice(frontmatter[0].length).trim();

    if (!name) errors.push(`${relativeSkillPath}: falta name`);
    if (!description) errors.push(`${relativeSkillPath}: falta description`);

    if (name) {
      if (!/^[a-z0-9-]+$/.test(name)) {
        errors.push(`${relativeSkillPath}: name debe usar minúsculas, números y guiones`);
      }
      if (name !== directory) {
        errors.push(`${relativeSkillPath}: name (${name}) no coincide con la carpeta (${directory})`);
      }
      if (names.has(name)) {
        errors.push(`${relativeSkillPath}: name duplicado (${name})`);
      }
      names.add(name);
    }

    if (description) {
      if (!description.startsWith('Use when ')) {
        errors.push(`${relativeSkillPath}: description debe comenzar con "Use when "`);
      }
      if (description.length > 500) {
        errors.push(`${relativeSkillPath}: description supera 500 caracteres`);
      }
    }

    if (!body) errors.push(`${relativeSkillPath}: el cuerpo está vacío`);
  }

  if (directories.length === 0) errors.push('No hay skills locales para validar.');
}

if (errors.length) {
  console.error('Validación de skills fallida:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const skillCount = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).length;

console.log(`Validación correcta: ${skillCount} skills y archivos de organización presentes.`);
