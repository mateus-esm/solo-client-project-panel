export type ComprovanteEntry = { buffer: Buffer; filename: string; mimeType: string };

export const comprovanteStore = new Map<number, ComprovanteEntry>();
