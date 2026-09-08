# 闪记

开会用的 Markdown 笔记。打开后先看到最近笔记；点一篇再写，或新建空白笔记自己起标题。编辑器用 Vditor 即时渲染（类似 Typora）。

## Windows 安装

请重新运行 [`release/FlashNote-Setup.exe`](release/FlashNote-Setup.exe) 覆盖安装（不需要管理员）。

- 装到 `%LOCALAPPDATA%\Programs\FlashNote\`
- 默认笔记目录：`文档\闪记`（可在「设置」里更改）
- 笔记是该目录下的 `.md` 文件，左侧按文件夹显示
- 拖动左侧目录右缘可以调整宽度
- 卸载：Windows 设置 → 应用 → 闪记

便携版：[`release/FlashNote.exe`](release/FlashNote.exe)

从源码重新打包：`bash scripts/build-windows.sh`

需要本机已安装 Microsoft Edge 或 [WebView2 运行时](https://go.microsoft.com/fwlink/p/?LinkId=2124703)。

以前存在浏览器/WebView2 里的笔记，第一次打开新版时会写入当前存储目录。

## 用法

| 按键 | 作用 |
| --- | --- |
| `Ctrl+N` | 新会议笔记 |
| `Ctrl+K` | 搜索 / 跳转 |
| `Ctrl+\` | 显示或隐藏目录 |
| `Ctrl+A` | 全选当前笔记 |
| `Tab` / `Shift+Tab` | 列表缩进 / 取消缩进 |
| `Ctrl+,` | 设置 |
| `Ctrl+Shift+F` | 专注模式 |
| `Ctrl+Shift+T` | 下一主题 |
| `Ctrl+;` | 插入当前时间 |
| `Ctrl+E` | 导出 Markdown |
| `Ctrl+S` | 立即保存 |

写法：`# 标题`、`- 列表`、`- [ ] 待办`、`> 引用`、`**强调**`、`*斜体*`、`` `代码` ``、`~~删除线~~`、`==高亮==`

主题：日光、墨夜、羊皮纸、林间、深海、樱花、石墨、高对比。

## 开发预览（浏览器）

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:47821`。浏览器预览存在本机浏览器存储，不能选文件夹；选目录请用 Windows 安装包。
