/**
 * 待办助手服务入口
 * 1. 提供静态资源 public/
 * 2. 提供 /api/todos 系列接口
 * 3. 定时将内存变更写回 JSON（每 5 秒检查 dirty）
 */
const path = require('path');
const express = require('express');
const store = require('./persistence/store');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../../public');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/api/todos', todosRouter);

// 定时持久化
setInterval(() => {
  if (store.isDirty()) store.save();
}, 5000);

app.listen(PORT, () => {
  console.log('待办助手已启动: http://127.0.0.1:' + PORT);
});
