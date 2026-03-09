/**
 * postinstall：将 SortableJS 的 UMD 文件复制到 public/vendor，供前端直接引用，实现开箱即用。
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const vendorDir = path.join(projectRoot, 'public', 'vendor');

function main() {
  fs.mkdirSync(vendorDir, { recursive: true });
  let sortablePath;
  try {
    sortablePath = require.resolve('sortablejs');
  } catch (_) {
    return;
  }
  fs.copyFileSync(sortablePath, path.join(vendorDir, 'Sortable.min.js'));
}

main();
