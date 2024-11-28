import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['src/index.ts'],
  dts: true,
  clean: true,
  format: ['cjs', 'esm'],
  sourcemap: false,
  treeshake: true
})