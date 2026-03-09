#!/usr/bin/env bash
# 待办助手启动脚本，端口 7490。若该端口已被占用则先关闭旧进程再启动。
cd "$(dirname "$0")"
PORT=7490
pid=$(lsof -ti:"$PORT" 2>/dev/null)
if [ -n "$pid" ]; then
  echo "关闭占用端口 $PORT 的进程: $pid"
  kill $pid 2>/dev/null
  sleep 1
  if lsof -ti:"$PORT" >/dev/null 2>&1; then
    kill -9 $pid 2>/dev/null
    sleep 1
  fi
fi
export PORT
exec node src/server/index.js
