/**
 * Manifest y cargador en caliente de todos los archivos del proyecto Guardabosques Sumapaz
 * Utiliza las importaciones ?raw de Vite para empaquetar exactamente los archivos reales del disco
 * en un archivo ZIP 100% funcional y garantizado libre de errores mediante JSZip.
 */

import mainPy from '../main.py?raw';
import requirementsTxt from '../requirements.txt?raw';
import readmeMd from '../README.md?raw';
import setupProjectPy from '../setup_project.py?raw';
import iniciarWindowsBat from '../iniciar_windows.bat?raw';
import iniciarWindowsPs1 from '../iniciar_windows.ps1?raw';
import metadataJson from '../metadata.json?raw';
import packageJson from '../package.json?raw';
import tsconfigJson from '../tsconfig.json?raw';
import viteConfigTs from '../vite.config.ts?raw';
import rootIndexHtml from '../index.html?raw';
import envExample from '../.env.example?raw';
import gitignore from '../.gitignore?raw';

import staticIndexHtml from '../static/index.html?raw';
import staticAppJs from '../static/app.js?raw';
import staticStyleCss from '../static/style.css?raw';

import srcAppTsx from './App.tsx?raw';
import srcMainTsx from './main.tsx?raw';
import srcIndexCss from './index.css?raw';

export interface ProjectFile {
  name: string;
  path: string;
  category: 'backend' | 'frontend' | 'docs' | 'config';
  language: string;
  content: string;
}

export const PROJECT_FILES: ProjectFile[] = [
  {
    name: 'iniciar_windows.bat',
    path: 'iniciar_windows.bat',
    category: 'config',
    language: 'bat',
    content: iniciarWindowsBat
  },
  {
    name: 'iniciar_windows.ps1',
    path: 'iniciar_windows.ps1',
    category: 'config',
    language: 'powershell',
    content: iniciarWindowsPs1
  },
  {
    name: 'main.py',
    path: 'main.py',
    category: 'backend',
    language: 'python',
    content: mainPy
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    category: 'backend',
    language: 'text',
    content: requirementsTxt
  },
  {
    name: 'setup_project.py',
    path: 'setup_project.py',
    category: 'backend',
    language: 'python',
    content: setupProjectPy
  },
  {
    name: 'README.md',
    path: 'README.md',
    category: 'docs',
    language: 'markdown',
    content: readmeMd
  },
  {
    name: 'static/index.html',
    path: 'static/index.html',
    category: 'frontend',
    language: 'html',
    content: staticIndexHtml
  },
  {
    name: 'static/app.js',
    path: 'static/app.js',
    category: 'frontend',
    language: 'javascript',
    content: staticAppJs
  },
  {
    name: 'static/style.css',
    path: 'static/style.css',
    category: 'frontend',
    language: 'css',
    content: staticStyleCss
  },
  {
    name: 'src/App.tsx',
    path: 'src/App.tsx',
    category: 'frontend',
    language: 'typescript',
    content: srcAppTsx
  },
  {
    name: 'src/main.tsx',
    path: 'src/main.tsx',
    category: 'frontend',
    language: 'typescript',
    content: srcMainTsx
  },
  {
    name: 'src/index.css',
    path: 'src/index.css',
    category: 'frontend',
    language: 'css',
    content: srcIndexCss
  },
  {
    name: 'package.json',
    path: 'package.json',
    category: 'config',
    language: 'json',
    content: packageJson
  },
  {
    name: 'tsconfig.json',
    path: 'tsconfig.json',
    category: 'config',
    language: 'json',
    content: tsconfigJson
  },
  {
    name: 'vite.config.ts',
    path: 'vite.config.ts',
    category: 'config',
    language: 'typescript',
    content: viteConfigTs
  },
  {
    name: 'index.html',
    path: 'index.html',
    category: 'frontend',
    language: 'html',
    content: rootIndexHtml
  },
  {
    name: '.env.example',
    path: '.env.example',
    category: 'config',
    language: 'text',
    content: envExample
  },
  {
    name: '.gitignore',
    path: '.gitignore',
    category: 'config',
    language: 'text',
    content: gitignore
  },
  {
    name: 'metadata.json',
    path: 'metadata.json',
    category: 'config',
    language: 'json',
    content: metadataJson
  }
];
