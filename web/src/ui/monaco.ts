export type Monaco = typeof import('monaco-editor');
let monacoPromise: Promise<Monaco> | null = null;

/** O Monaco é pesado, então só carrega na primeira vez que alguém precisa dele. */
export function loadMonaco(): Promise<Monaco> {
  monacoPromise ??= (async () => {
    const [monaco, { default: EditorWorker }] = await Promise.all([
      import('monaco-editor'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    ]);
    (self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };
    return monaco;
  })();
  return monacoPromise;
}

export function languageFor(monaco: Monaco, file: string) {
  const ext = '.' + file.split('.').pop()!.toLowerCase();
  return monaco.languages.getLanguages().find((l) => l.extensions?.includes(ext))?.id ?? 'plaintext';
}
