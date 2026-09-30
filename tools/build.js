// 배포용 한 파일 만들기: index.html이 불러오는 style.css와 js/*.js를 모두 안에 넣어 dist/아베르니아.html 하나로 만든다.
// 서버 없이 더블클릭으로 열린다. 저장은 브라우저(localStorage)에 된다.
// 실행: node tools/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
// 파일 안의 "</script" 가 태그를 닫아 버리지 않게 한다
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${safe(read(href))}\n</style>`);
let count = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  count++;
  return `<script>/* ${src} */\n${safe(read(src))}\n</script>`;
});

const out = path.join(root, 'dist', '아베르니아.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out} (스크립트 ${count}개, ${Math.round(Buffer.byteLength(html) / 1024)}KB)`);
