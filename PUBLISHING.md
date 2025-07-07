# 发布指南

本文档详细说明如何将 OpenAI CLI Agent 发布到 npm 和 GitHub。

## 📋 发布前检查清单

在发布之前，请确保以下项目已完成：

- [ ] 代码已提交并推送到主分支
- [ ] 所有功能都已测试完成
- [ ] 版本号已更新 (`package.json` 中的 `version` 字段)
- [ ] `CHANGELOG.md` 已更新当前版本的变更
- [ ] `README.md` 包含最新的使用说明
- [ ] 构建测试通过 (`npm run build`)

## 🔧 首次发布设置

### 1. npm 账户设置

```bash
# 登录 npm 账户
npm login

# 验证登录状态
npm whoami
```

### 2. GitHub 仓库设置

```bash
# 添加远程仓库
git remote add origin https://github.com/MayDay-wpf/openai-cli.git

# 推送代码到 GitHub
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 3. GitHub Secrets 配置

在 GitHub 仓库设置中添加以下 Secrets：

#### 设置 NPM_TOKEN：

1. **登录 npm 并创建 Token**：
   ```bash
   npm login  # 先登录
   ```
   
2. **访问 npm Token 设置页面**：
   - 打开 https://www.npmjs.com/settings/tokens
   - 点击 "Generate New Token"
   - 选择 "Automation" 类型（用于 CI/CD）
   - 复制生成的令牌（格式类似：npm_xxxxxxxxxxxxxxxxxxxx）

3. **在 GitHub 仓库中添加 Secret**：
   - 进入你的 GitHub 仓库
   - 点击 Settings → Secrets and variables → Actions
   - 点击 "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: 粘贴你复制的 npm token
   - 点击 "Add secret"

#### 验证 Token 设置：

你可以在本地测试 token 是否有效：
```bash
export NODE_AUTH_TOKEN=你的npm_token
npm whoami
```

## 🚀 发布流程

### 方法 1: 手动发布

```bash
# 1. 更新版本号
npm version patch  # 修订版本 (1.0.0 -> 1.0.1)
# 或
npm version minor  # 次版本 (1.0.0 -> 1.1.0)
# 或
npm version major  # 主版本 (1.0.0 -> 2.0.0)

# 2. 构建项目
npm run build

# 3. 发布到 npm
npm publish

# 4. 推送标签到 GitHub
git push origin --tags
```

### 方法 2: 自动化发布 (推荐)

```bash
# 1. 更新版本并创建 git 标签
npm version patch  # 或 minor/major

# 2. 推送标签到 GitHub (这会触发自动发布)
git push origin --tags
```

GitHub Actions 会自动：
- 构建项目
- 发布到 npm
- 创建 GitHub Release

## 📝 版本管理

### 语义化版本规则

- **patch** (1.0.0 -> 1.0.1): 向后兼容的 bug 修复
- **minor** (1.0.0 -> 1.1.0): 向后兼容的新功能
- **major** (1.0.0 -> 2.0.0): 不兼容的 API 变更

### 发布示例

```bash
# 修复 bug
npm version patch
git push origin --tags

# 新增功能
npm version minor
git push origin --tags

# 重大更新
npm version major
git push origin --tags
```

## 🔍 发布验证

发布完成后，验证发布是否成功：

```bash
# 检查 npm 包
npm info openai-cli-unofficial

# 全局安装测试
npm install -g openai-cli-unofficial
openai-cli --version

# 卸载测试版本
npm uninstall -g openai-cli-unofficial
```

## 📊 发布状态监控

- **npm 包状态**: https://www.npmjs.com/package/openai-cli-unofficial
- **GitHub Releases**: https://github.com/MayDay-wpf/openai-cli/releases
- **GitHub Actions**: https://github.com/MayDay-wpf/openai-cli/actions

## 🛠️ 常见问题

### 发布失败

1. **npm 登录问题**：
   ```bash
   npm logout
   npm login
   ```

2. **权限问题**：
   确保你是包的维护者，或者使用不同的包名

3. **版本冲突**：
   ```bash
   npm version patch --force
   ```

### 自动发布失败

1. 检查 GitHub Actions 日志
2. 确认 `NPM_TOKEN` Secret 配置正确
3. 确认 npm 包名称可用

## 📞 获取帮助

如果遇到发布问题：

1. 检查 [npm 官方文档](https://docs.npmjs.com/)
2. 查看 [GitHub Actions 文档](https://docs.github.com/en/actions)
3. 在项目 Issues 中提问 