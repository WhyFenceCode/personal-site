// Minimal types for the parts of opentype.js used by components/ui/Signature.astro (the package ships none).
declare module 'opentype.js' {
  interface Path { toPathData(decimals?: number): string; getBoundingBox(): { x1: number; y1: number; x2: number; y2: number } }
  interface Font { getPath(text: string, x: number, y: number, size: number): Path; getPaths(text: string, x: number, y: number, size: number): Path[] }
  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
