// Ambient declarations for dependencies that ship no TypeScript types.
declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }
  function nspell(aff: unknown, dic?: unknown): NSpell;
  export default nspell;
}

declare module 'dictionary-en';
