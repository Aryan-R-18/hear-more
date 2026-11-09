import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBuild() {
  console.log('--- 1. Building Viewer & Side Panel HTML pages ---');
  await build({
    root: __dirname,
    plugins: [react()],
    resolve: {
      alias: {
        '@kinetic-lyrics/shared': path.resolve(__dirname, '../shared/src/index.ts')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          viewer: path.resolve(__dirname, 'viewer.html'),
          sidepanel: path.resolve(__dirname, 'sidepanel.html')
        }
      }
    }
  });

  console.log('\n--- 2. Building Background Service Worker (ES Module) ---');
  await build({
    root: __dirname,
    resolve: {
      alias: {
        '@kinetic-lyrics/shared': path.resolve(__dirname, '../shared/src/index.ts')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/background.ts'),
        formats: ['es'],
        fileName: () => 'background.js'
      }
    }
  });

  console.log('\n--- 3. Building Content Script (Standalone IIFE) ---');
  await build({
    root: __dirname,
    resolve: {
      alias: {
        '@kinetic-lyrics/shared': path.resolve(__dirname, '../shared/src/index.ts')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: path.resolve(__dirname, 'src/content.ts'),
        name: 'KineticLyricsContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  console.log('\n--- 4. Copying manifest.json and icons to dist/ ---');
  const distDir = path.resolve(__dirname, 'dist');
  fs.copyFileSync(
    path.resolve(__dirname, 'manifest.json'),
    path.resolve(distDir, 'manifest.json')
  );

  const iconsSrcDir = path.resolve(__dirname, 'icons');
  const iconsDistDir = path.resolve(distDir, 'icons');
  if (!fs.existsSync(iconsDistDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
  }

  for (const iconFile of fs.readdirSync(iconsSrcDir)) {
    fs.copyFileSync(
      path.resolve(iconsSrcDir, iconFile),
      path.resolve(iconsDistDir, iconFile)
    );
  }

  console.log('\nExtension build complete! Unpacked extension is ready in: extension/dist');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
