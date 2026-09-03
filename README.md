# 闪记

开会用的 Markdown 笔记：打开就能写。当前段落是原文，点开别的段或离开后立刻变成排版后的样子（标题、列表、强调、待办、代码、引用）。

## Windows 安装

请重新运行 [`release/FlashNote-Setup.exe`](release/FlashNote-Setup.exe) 覆盖安装（不需要管理员）。旧版如果还是纯文本记事本，装完就会回到所写即所见。

- 装到 `%LOCALAPPDATA%\Programs\FlashNote\`
- 桌面和开始菜单会出现「闪记」
- 笔记存在 WebView2 配置里：`%LOCALAPPDATA%\FlashNote\webview2`
- 卸载：Windows 设置 → 应用 → 闪记

便携版：[`release/FlashNote.exe`](release/FlashNote.exe)

从源码重新打包：`bash scripts/build-windows.sh`

需要本机已安装 Microsoft Edge 或 [WebView2 运行时](https://go.microsoft.com/fwlink/p/?LinkId=2124703)。

以前纯文本版写在 `%LOCALAPPDATA%\FlashNote\notes\` 里的 `.md` 不会自动导入，可用记事本打开后复制进来。

## 用法

启动后光标已经在编辑区。用 Markdown 写，当前段保持原文，其它段即时渲染。

| 按键 | 作用 |
| --- | --- |
| `Ctrl+N` | 新会议笔记 |
| `Ctrl+K` | 搜索 / 跳转 |
| `Ctrl+\` | 显示或隐藏目录 |
| `Ctrl+Shift+F` | 专注模式 |
| `Ctrl+Shift+T` | 下一主题 |
| `Ctrl+;` | 插入当前时间 |
| `Ctrl+E` | 导出 Markdown |
| `Ctrl+S` | 立即保存 |

写法：`# 标题`、`**强调**`、`` `代码` ``、`- 列表`、`- [ ] 待办`、`> 引用`

主题：日光、墨夜、羊皮纸、林间、深海、樱花、石墨、高对比。

## 开发预览（浏览器）

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:47821`。Windows 上请用安装包。
