/// <reference types="jest" />

declare module 'fs' {
  export function readFileSync(path: string, encoding: BufferEncoding): string;
}

declare module 'path' {
  export function join(...paths: string[]): string;
}

declare const __dirname: string;
