import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// As texturas moram num gerenciador só, de todas as cenas, e o `add()` de textures.ts APAGA a que já existe com o mesmo
// nome. Duas peças com o mesmo nome em arquivos diferentes = a segunda some com a primeira, e a cena que ainda a desenha
// quebra (`glTexture` de null). Foi assim que o banco do porão derrubou a volta para o mapa (banco da praça, 03/11/2026).
const DIR = path.resolve(import.meta.dirname, '../src/game');

test('nome de textura fixo não se repete entre os arquivos de desenho', () => {
  const onde = new Map<string, string[]>();
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    // add(scene, 'x', …) e geradores com o nome no 2º argumento: monitor(scene, 'monitorOn', …)
    for (const m of src.matchAll(/\b\w+\(scene, '([\w-]+)'/g)) {
      const lista = onde.get(m[1]!) ?? [];
      lista.push(f);
      onde.set(m[1]!, lista);
    }
  }
  const repetidos = [...onde].filter(([, fs]) => fs.length > 1).map(([k, fs]) => `${k}: ${fs.join(', ')}`);
  assert.deepEqual(repetidos, []);
  assert.ok(onde.has('bench') && onde.has('poraoBench'), 'a varredura achou os nomes');
});
