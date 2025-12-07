// Vercel 빌드 스크립트: public 폴더 확인
import { existsSync } from 'fs';
import { readdirSync } from 'fs';

const publicDir = './public';
const soundDir = './public/sound';

if (!existsSync(publicDir)) {
  console.error('❌ public 폴더가 없습니다!');
  process.exit(1);
}

if (!existsSync(soundDir)) {
  console.error('❌ public/sound 폴더가 없습니다!');
  process.exit(1);
}

const soundFiles = readdirSync(soundDir);
console.log(`✅ public/sound 폴더 확인: ${soundFiles.length}개 파일`);
console.log(`📁 파일 목록: ${soundFiles.join(', ')}`);

console.log('✅ 빌드 완료: public 폴더 준비됨');

