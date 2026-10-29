#!/usr/bin/env python3
"""
Auditoria mecânica de integridade das regras (guardrails G12 e G16).

Não julga se a regra é boa — verifica se ela ainda aponta para algo que EXISTE.
É a única metade do problema que máquina resolve, e é a que mais machuca: uma skill que
aponta para uma pasta apagada continua mandando criar arquivo lá até alguém notar.

Regra de projeto: relatório que ninguém lê é pior que nenhum. Só reporta o que dá para agir.

Uso:  auditar-referencias.py [raiz-do-repo] [--json] [--tudo] [--sem-home]
      --tudo      inclui docs (por padrão só o que INSTRUI: skill, hook, CLAUDE.md, AGENTS.md)
      --sem-home  pula caminhos com ~/ (são da máquina do usuário; o CI não tem como conferir)
Saída: exit 1 se houver achado em algo que instrui.
"""
import os, re, sys, json, glob

RAIZ = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else '.')
# Regras de fora do repo (guardrails, perfis) são pessoais: os globs vêm do config local,
# ignorado pelo git. Ex.: "auditorAcervos": {"guardrail": ["~/regras/*.md"], "perfil": [...]}
try:
    ACERVOS = json.load(open(os.path.join(RAIZ, 'dev-valley.config.local.json'), encoding='utf-8')).get('auditorAcervos', {})
except Exception:
    ACERVOS = {}
TUDO = '--tudo' in sys.argv
SEM_HOME = '--sem-home' in sys.argv

ALVOS = [('skill', '.claude/commands/*.md'), ('skill', '.claude/skills/*/SKILL.md'),
         ('hook', '.claude/hooks/*.sh'), ('instrucao', 'CLAUDE.md'), ('instrucao', 'AGENTS.md'),
         ('instrucao', 'server/agents/*.md')]
ALVOS_DOC = [('doc', 'docs-dev/*.md'), ('doc', 'docs-dev/guias/*.md'), ('doc', 'README.md'),
             ('doc', 'PROGRESS.md'), ('doc', 'PENDENCIAS.md')]
ALVOS_IA = [(tipo, os.path.expanduser(g)) for tipo in ('guardrail', 'perfil') for g in ACERVOS.get(tipo, [])]
INSTRUEM = ('skill', 'hook', 'instrucao', 'guardrail')

RAIZES = ['', 'server', 'server/src', 'web', 'web/src', 'web/src/game', 'web/src/ui', 'docs-dev', 'docs-dev/guias']
EXTS = ('.md', '.java', '.ts', '.html', '.scss', '.css', '.sql', '.yml', '.yaml', '.json',
        '.sh', '.py', '.webmanifest', '.xml', '.txt', '.png', '.svg')

RE_CAMINHO = re.compile(r'`([~A-Za-z0-9_][^`\s]*?/[^`\s]*?)`')
# Uma regra pode citar um caminho morto DE PROPÓSITO ("a pasta X foi apagada, não recriar").
# Nesse caso a própria frase diz que morreu — e essa menção é útil, não é dívida.
RE_HISTORICA = re.compile(r'não existe|nunca existiu|apagad|removid|deletad|não readicionar|'
                          r'descontinuad|aposentad|saiu de|deixou de|foi extint|era anterior|'
                          r'movid|renomead|virou|era o |era a |não recriar|não usar', re.I)
RE_SIMBOLO = re.compile(r'`([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+){1,5})`')

def alvos():
    out = []
    for grupo in [ALVOS] + ([ALVOS_DOC] if TUDO else []) + [ALVOS_IA]:
        for tipo, p in grupo:
            for f in sorted(glob.glob(p if p.startswith('/') else os.path.join(RAIZ, p))):
                out.append((tipo, f))
    return out

def indice_simbolos():
    idx = set()
    for base, exts in (('backend/src', ('.java',)), ('frontend/src', ('.ts',))):
        for r, _, fs in os.walk(os.path.join(RAIZ, base)):
            for f in fs:
                if f.endswith(exts):
                    n = f.rsplit('.', 1)[0]
                    idx.add(n)
                    # detalhe-pedido.component -> DetalhePedidoComponent
                    idx.add(''.join(p.capitalize() for p in re.split(r'[-.]', n)))
    return idx

SIMB = indice_simbolos() if os.path.isdir(os.path.join(RAIZ, 'backend/src')) else set()

def caminho_existe(c):
    c = c.lstrip('./').rstrip('/')
    if c.startswith('~'):
        return os.path.exists(os.path.expanduser(c))
    return any(os.path.exists(os.path.join(RAIZ, r, c)) for r in RAIZES)

def caminho_auditavel(c):
    if not (c.endswith('/') or c.endswith(EXTS)):
        return False                                   # método, lista de enum, rota de API
    if '/' not in c.rstrip('/'):
        return False                                   # segmento único: ambíguo (pode ser de outro repo)
    if SEM_HOME and c.startswith('~'):
        return False                                   # ~/.claude/...: existe só na máquina do usuário
    if c.startswith(('http', '/api', 'api/')) or '${' in c or '<' in c or '*' in c:
        return False
    if '...' in c:
        return False                                   # caminho estilizado: test/.../Foo.java
    if '[' in c or '{' in c:
        return False                                   # placeholder: docs-dev/[módulo]/[feature]/...
    if any(seg.isupper() and len(seg) > 2 for seg in c.split('/')):
        return False                                   # STATUS_A/STATUS_B
    return True

def parecido(nome):
    p = nome[:6]
    return next((s for s in SIMB if s.startswith(p) and s != nome), None)

achados = []
for tipo, arq in alvos():
    try:
        texto = open(arq, encoding='utf-8').read()
    except Exception:
        continue
    rel = os.path.relpath(arq, RAIZ) if arq.startswith(RAIZ) else arq.replace(os.path.expanduser('~'), '~')
    for m in RE_CAMINHO.finditer(texto):
        c = m.group(1)
        if tipo in ('guardrail', 'perfil') and not c.startswith('~'):
            continue                                    # guardrail cita caminho genérico de propósito
        if caminho_auditavel(c) and not caminho_existe(c):
            ini = texto.rfind('\n', 0, texto.rfind('\n', 0, m.start())) + 1
            fim = texto.find('\n', m.end());  fim = fim if fim > 0 else len(texto)
            if RE_HISTORICA.search(texto[ini:fim]):
                continue                               # citada como história, não como instrução
            achados.append((tipo, rel, texto[:m.start()].count('\n') + 1, 'caminho', c, ''))
    if tipo in ('skill', 'instrucao') and SIMB:
        for m in RE_SIMBOLO.finditer(texto):
            n = m.group(1)
            if n in SIMB:
                continue
            p = parecido(n)
            if p:                                       # só reporta se HÁ algo parecido: sinal de renomeação
                ini = texto.rfind('\n', 0, m.start()) + 1
                fim = texto.find('\n', m.end());  fim = fim if fim > 0 else len(texto)
                if RE_HISTORICA.search(texto[ini:fim]):
                    continue
                achados.append((tipo, rel, texto[:m.start()].count('\n') + 1, 'símbolo', n, p))

if '--json' in sys.argv:
    print(json.dumps([dict(zip(('tipo','arquivo','linha','classe','ref','parecido'), a)) for a in achados],
                     ensure_ascii=False, indent=2))
    sys.exit(0)

ordem = {'skill': 0, 'hook': 1, 'instrucao': 2, 'guardrail': 3, 'perfil': 4, 'doc': 5}
achados.sort(key=lambda a: (ordem.get(a[0], 9), a[1], a[2]))
if not achados:
    print('✅ Nenhuma referência morta no que instrui.'); sys.exit(0)
GRAV = {'skill': 'GRAVE — skill instrui, não informa', 'hook': 'GRAVE — hook executa',
        'instrucao': 'ALTO — é a lei do projeto', 'guardrail': 'ALTO — vale em todo projeto'}
print(f'⚠️  {len(achados)} referência(s) mortas:\n')
atual = None
for tipo, arq, lin, classe, ref, par in achados:
    if tipo != atual:
        atual = tipo
        print(f'── {tipo.upper()}  ({GRAV.get(tipo, "informativo")})')
    extra = f'  → existe algo parecido: {par}' if par else ''
    print(f'   {arq}:{lin}  {classe} "{ref}"{extra}')
sys.exit(1 if any(a[0] in INSTRUEM for a in achados) else 0)
