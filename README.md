# 闪记

支持 Markdown 的 Windows 记事本：像 txt 一样秒开、自带滚动条，笔记就是本地 `.md` 文件。编辑控件与记事本相同，打字时不会整页重绘。

## Windows 安装

下载 [`release/FlashNote-Setup.exe`](release/FlashNote-Setup.exe)，双击即可（不需要管理员）。

- 装到 `%LOCALAPPDATA%\Programs\FlashNote\`
- 桌面和开始菜单会出现「闪记」
- 笔记存在 `%LOCALAPPDATA%\FlashNote\notes\`，用记事本也能打开
- 卸载：Windows 设置 → 应用 → 闪记

便携版：[`release/FlashNote.exe`](release/FlashNote.exe)

从源码重新打包：`bash scripts/build-windows.sh`

## 用法

打开就能写。左边是笔记列表，右边是带滚动条的编辑区。Markdown 会加粗标题、强调和代码，符号仍留在原文里，和 txt 一样可复制、可搜索。

| 按键 | 作用 |
| --- | --- |
| `Ctrl+N` | 新会议笔记 |
| `Ctrl+S` | 保存（平时已自动保存） |
| `F5` | 插入当前时间（和记事本一样） |
| `F1` | 快捷键 |

写法：`# 标题`、`**强调**`、`` `代码` ``、`- 列表`、`- [ ] 待办`、`> 引用`

主题在菜单「主题」里：日光、墨夜、羊皮纸、林间、深海、樱花、石墨、高对比。

## 开发预览（浏览器）

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:47821`。Windows 上请用安装包，不要走浏览器——那才是记事本级别的启动速度。
