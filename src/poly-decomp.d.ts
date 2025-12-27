declare module 'poly-decomp' {
  export function decomp(vertices: number[][]): number[][][];
  export function quickDecomp(vertices: number[][]): number[][][];
  export function isSimple(vertices: number[][]): boolean;
  export function removeCollinearVertices(vertices: number[][], precision?: number): number[][];
  export function removeDuplicateVertices(vertices: number[][], precision?: number): number[][];
  export function makeCCW(vertices: number[][]): number[][];
}

