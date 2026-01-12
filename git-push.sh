#!/bin/bash

# 快速 git add, commit, push 脚本
# 使用方法: ./git-push.sh "commit message"
# 或者: ./git-push.sh (会使用默认的 commit message)

COMMIT_MSG="${1:-Update changes}"

echo "📦 正在执行 git add ."
git add .

echo "💾 正在提交: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

echo "🚀 正在推送到 origin main"
git push origin main

echo "✅ 完成！"
