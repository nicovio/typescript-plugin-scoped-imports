import path from "node:path";

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function toDirectoryPath(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function toPosixAbsolute(value: string): string {
  return normalizePath(path.resolve(value));
}
