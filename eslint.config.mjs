import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 코드가 아닌 폴더: 작업용 worktree(각자 node_modules 를 가짐), 안드로이드 네이티브 프로젝트, 앱 임시 화면
    ".claude/**",
    "android/**",
    "capacitor-www/**",
  ]),
]);

export default eslintConfig;
