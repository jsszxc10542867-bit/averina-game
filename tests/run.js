// 시스템 테스트 실행: node tests/run.js
// 게임 스크립트를 브라우저와 같은 순서(index.html)로 한 문맥에 불러온 뒤 tests/spec.js를 돌린다.
// engine.js와 debug/debug.js는 화면(DOM)이 필요해서 빼고 불러온다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/engine\.js|debug\.js/.test(f));
const store = {};
const ctx = {
  console,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
};
ctx.__pending = []; // 비동기 테스트(장면을 흉내 내는 것)는 여기에 약속을 넣는다. 다 끝난 뒤 결과를 적는다
vm.createContext(ctx);
// tests/spec.js가 도구를 정의하므로 먼저, 나머지 spec_*.js는 그 뒤에
const specs = ['tests/spec.js', ...fs.readdirSync(__dirname).filter((f) => /^spec_.+\.js$/.test(f)).sort().map((f) => 'tests/' + f)];
for (const f of [...files, ...specs]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

Promise.all(ctx.__pending).then(() => {
  const results = vm.runInContext('__results', ctx);
  let fail = 0;
  for (const r of results) {
    if (!r.ok) fail++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`);
  }
  console.log(`\n${results.length - fail}/${results.length} 통과`);
  process.exitCode = fail ? 1 : 0;
});
