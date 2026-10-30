const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const source = join(root, 'front-end', 'dist');
const destination = join(root, 'public');

if (!existsSync(source)) throw new Error('Build do frontend não encontrado. Execute build:web antes.');
if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
