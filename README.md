# 教师研修网自动看课脚本

适用于 [中国教师研修网](https://ipx.yanxiu.com)（`*.yanxiu.com`）的油猴脚本，帮助自动完成网课学习。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-一键安装-green?style=for-the-badge)](https://raw.githubusercontent.com/AGkite/yanxiu/main/yanxiu.user.js)

## 功能

- 课程列表页自动点击「继续看课」
- 视频自动静音播放，支持倍速（默认 2 倍）
- 自动处理「继续计时」弹窗、课程评分、视频弹题
- 播完自动切下一节，或返回列表继续下一门课
- 防止重复打开多个视频标签页

## 一键安装（推荐）

> 安装前请先完成下方「第一步：安装 Tampermonkey」。

**[点击这里一键安装脚本](https://raw.githubusercontent.com/AGkite/yanxiu/main/yanxiu.user.js)**

安装步骤：

1. 点击上方链接
2. Tampermonkey 会弹出安装页面，点击 **「安装」**
3. 打开研修网课程列表页并刷新，右上角出现绿色 `[研修网刷课]` 提示即表示生效

## 零基础完整教程

### 第一步：安装 Tampermonkey（篡改猴）

任选一种浏览器，安装扩展：

| 浏览器 | 安装方式 |
|--------|----------|
| Chrome / Edge | [Chrome 网上应用店 - Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox 附加组件 - Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) |

安装后，浏览器工具栏会出现 Tampermonkey 图标（黑色方块）。

### 第二步：安装本脚本

方式 A（推荐）：点击 README 顶部的 **[一键安装链接](https://raw.githubusercontent.com/AGkite/yanxiu/main/yanxiu.user.js)**

方式 B（手动）：

1. 打开 [yanxiu.user.js 源码](https://github.com/AGkite/yanxiu/blob/main/yanxiu.user.js)
2. 点击右上角 **Raw**（原始数据）
3. Tampermonkey 会自动识别并提示安装

### 第三步：开始使用

1. 登录 [教师研修网](https://ipx.yanxiu.com)
2. 进入项目的 **课程学习** 列表页（URL 通常含 `/training/member`）
3. **保持列表页开着**，不要手动点进视频
4. 脚本会自动打开视频页并完成学习，右上角可查看运行状态

## 使用说明

### 推荐用法

```
课程列表页（保持打开） → 脚本自动点「继续看课」 → 视频页自动播放
→ 学完自动下一节 / 返回列表 → 继续下一门课
```

### 状态面板

脚本运行后，页面右上角会显示绿色提示，例如：

```
[研修网刷课] 已点击继续看课（进度 96%） | 倍速 2x
[研修网刷课] 已有视频页在学习，等待完成 | 倍速 2x
[研修网刷课] 当前视频已学完，点击下一节 | 倍速 2x
```

### 修改倍速

编辑 `yanxiu.user.js` 第 22 行：

```javascript
const PLAYBACK_RATE = 2;  // 改为 1、1.5、2 等，建议不超过 2
```

在 Tampermonkey 中：点击扩展图标 → **管理面板** → 找到本脚本 → **编辑** → 修改后 **Ctrl+S 保存**。

### 自动更新

脚本已配置 `@updateURL`，Tampermonkey 会定期检查 GitHub 上的新版本。也可在管理面板中手动点击 **检查更新**。

## 常见问题

**Q：脚本没有反应？**

- 确认 Tampermonkey 中脚本已启用（开关为绿色）
- 确认当前网址是 `*.yanxiu.com`
- 刷新页面，查看右上角是否有绿色状态面板
- 按 F12 打开控制台，搜索 `[研修网刷课]` 查看日志

**Q：刷新列表页弹出两个视频标签？**

- 请更新到最新版脚本（v2.2+），已修复重复点击问题
- 关闭多余视频标签，只保留列表页和视频页各一个

**Q：学时没有增加？**

- 倍速过高可能导致不计学时，建议设为 1~2 倍
- 确保视频页处于前台或未被浏览器节流

**Q：一键安装链接打不开？**

- 确认已在 GitHub 创建了 `AGkite/yanxiu` 仓库并推送代码
- 仓库需为 **Public（公开）**，否则 raw 链接无法访问

## 支持的页面

| 页面类型 | URL 示例 |
|----------|----------|
| 新版课程列表 | `/train2/workspace/.../training/member` |
| 新版视频页 | `/train2/workspace/.../training/...` |
| 旧版课程列表 | `/train/guide/course/list` |
| 旧版视频页 | `/grain/course/.../detail` |

## 开发者

- 作者：[AGkite](https://github.com/AGkite)
- 仓库：[github.com/AGkite/yanxiu](https://github.com/AGkite/yanxiu)
- 问题反馈：[Issues](https://github.com/AGkite/yanxiu/issues)

### 本地开发 & 推送到 GitHub

```bash
git clone https://github.com/AGkite/yanxiu.git
cd yanxiu

# 修改 yanxiu.user.js 后
git add .
git commit -m "update script"
git push
```

首次推送（本地已有代码时）：

```bash
cd c:\github\yanxiu
git init
git branch -M main
git add .
git commit -m "init: 教师研修网自动看课脚本"
git remote add origin https://github.com/AGkite/yanxiu.git
git push -u origin main
```

> 请先在 GitHub 网页上创建空仓库 `yanxiu`（不要勾选 README，避免冲突）。

## 免责声明

本脚本仅供学习与技术交流，请遵守研修网及相关平台的使用规定。使用本脚本产生的任何后果由使用者自行承担。

## License

[MIT](LICENSE)
