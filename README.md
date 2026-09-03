# 闪记

开会时立刻打开、立刻记录的 Markdown 笔记。Windows 专用：安装后是一个普通桌面程序，打开就能写。所写即所见——当前段落是 Markdown 原文，离开后马上变成排版后的样子。笔记保存在本机，关窗也不会丢。

## Windows 安装（推荐）

下载仓库里的 [`release/FlashNote-Setup.exe`](release/FlashNote-Setup.exe)，双击即可。

- **不需要管理员权限**
- 安装到 `%LOCALAPPDATA%\Programs\FlashNote\`
- 桌面和开始菜单会出现「闪记」，之后双击就能开会记录
- 卸载：Windows 设置 → 应用 → 闪记，或运行 `FlashNote.exe --uninstall`

不想安装也可以直接双击 [`release/FlashNote.exe`](release/FlashNote.exe)（便携版）。

系统需要已安装 Microsoft Edge 或 [WebView2 运行时](https://go.microsoft.com/fwlink/p/?LinkId=2124703)（Windows 10/11 通常已自带）。

从源码重新打包：

```bash
npm install
bash scripts/build-windows.sh
```

会在 `release/` 下生成 `FlashNote-Setup.exe` 和 `FlashNote.exe`。

## 开发预览

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:47821`。

## 写的时候

- `# 标题`、`- 列表`、`- [ ] 待办`、`**强调**`、`` `代码` ``、`> 引用`
- 回车继续下一段；在列表里回车会自动下一条
- 勾选待办不用进入编辑，点方框即可

## 快捷键

| 按键 | 作用 |
| --- | --- |
| `Ctrl+N` | 新会议笔记（自动带时间标题） |
| `Ctrl+K` | 搜索并跳转 |
| `Ctrl+\` | 显示 / 隐藏目录 |
| `Ctrl+Shift+F` | 专注模式 |
| `Ctrl+Shift+T` | 下一主题 |
| `Ctrl+;` | 插入当前时间 |
| `Ctrl+E` | 导出 `.md` |
| `Ctrl+S` | 立即保存（平时已自动保存） |
| `?` | 快捷键说明 |

## 主题

日光、墨夜、羊皮纸、林间、深海、樱花、石墨、高对比。点右上角「主题」，或 `Ctrl+Shift+T` 循环切换。

## 说明

- 笔记存在本机 WebView2 配置里。卸载程序不会删笔记；清掉 `%LOCALAPPDATA%\FlashNote\webview2` 才会丢掉。
- 重要内容请用导出备份。
