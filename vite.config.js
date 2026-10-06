import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트는 /<저장소명>/ 하위 경로로 서빙된다.
// 탭 전환은 location.hash 로만 하므로 404.html 우회가 필요 없다.
// 빌드마다 BUILD_ID 를 앱에 넣고 version.json 으로도 내보낸다 → 열려 있는 옛 화면이 새 배포를 알아챈다.
const BUILD_ID = String(Date.now())

export default defineConfig({
  base: '/godsaeng/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    { name: 'version-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) }) } },
  ],
})
