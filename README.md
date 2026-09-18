<p align="center">
  <strong>中文</strong> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="assets/flashnote-hero.svg" alt="闪记：不是笔记软件，是会议外挂" width="100%">
</p>

<h1 align="center">⚡ 闪记</h1>

<p align="center">
  <strong>不是笔记软件。是会议外挂。</strong>
  <br>
  <sub>来无影 · 字有痕 · 去无踪</sub>
</p>

<p align="center">
  <a href="#why">为什么是闪记</a> ·
  <a href="#download">下载安装</a> ·
  <a href="#shortcuts">快捷键</a> ·
  <a href="#development">开发预览</a> ·
  <a href="#license">协议</a>
</p>

---

老板突然点名？你已经写完了。  
同事还在翻备忘录？你已经关了。  
PPT 还在投，字已经落进 Markdown。

> **闪现进场。电光落字。原地蒸发。**

开会最贵的不是时间，是那几秒：**打不开、找不着、关不掉。**  
闪记把它们统统烧掉。

<a id="why"></a>
## ⚡ 为什么是闪记

| | |
| --- | --- |
| **闪开** | 启动就看见最近笔记，不穿菜单，不等灵感 |
| **闪记** | Vditor 即时渲染，像 Typora 一样边写边成形 |
| **闪关** | 内容落地为本地 `.md` 文件，记完就走 |
| **闪找** | `Ctrl+K` 搜索跳转，上一场会议瞬间归位 |
| **闪静** | 专注模式一键清场，只留下正在发生的事 |

笔记保存在你选择的目录里：看得见、带得走，也能交给任何 Markdown 工具继续处理。

<a id="download"></a>
## 🚀 下载安装

### Windows 安装版

**[下载 FlashNote-Setup.exe](release/FlashNote-Setup.exe)**，双击即可安装，不需要管理员权限。再次运行安装程序可以直接覆盖升级。

- 安装位置：`%LOCALAPPDATA%\Programs\FlashNote\`
- 默认笔记目录：`文档\闪记`，可在「设置」中更改
- 左侧目录按文件夹展示笔记，拖动目录右缘可调整宽度
- 卸载方式：Windows 设置 → 应用 → 闪记

不想安装？直接使用 **[便携版 FlashNote.exe](release/FlashNote.exe)**。

> [!NOTE]
> 运行闪记需要 Microsoft Edge 或 [WebView2 运行时](https://go.microsoft.com/fwlink/p/?LinkId=2124703)。

> [!TIP]
> 以前保存在浏览器或 WebView2 中的笔记，会在第一次打开新版时自动写入当前存储目录。

<a id="shortcuts"></a>
## ⌨️ 快捷键

### 闪记核心

| 按键 | 动作 |
| --- | --- |
| `Ctrl+N` | 新建会议笔记 |
| `Ctrl+K` | 搜索 / 跳转 |
| `Ctrl+;` | 插入当前时间 |
| `Ctrl+S` | 立即保存 |
| `Ctrl+E` | 导出 Markdown |
| `Ctrl+\` | 显示 / 隐藏目录 |
| `Ctrl+Shift+F` | 进入专注模式 |

<details>
<summary><strong>展开全部编辑快捷键</strong></summary>

| 按键 | 动作 |
| --- | --- |
| `Ctrl+A` | 全选当前笔记 |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+U` | 下划线 |
| `Ctrl+1` … `Ctrl+6` | 一级到六级标题 |
| `Tab` / `Shift+Tab` | 列表缩进 / 取消缩进 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+Shift+T` | 切换到下一主题 |

</details>

### Markdown，直接写

`# 标题` · `- 列表` · `- [ ] 待办` · `> 引用` · `**强调**` · `*斜体*` · `` `代码` `` · `~~删除线~~` · `==高亮==`

### 八种主题，随时换场

日光 · 墨夜 · 羊皮纸 · 林间 · 深海 · 樱花 · 石墨 · 高对比

<a id="development"></a>
## 🛠 开发预览

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:47821`。

浏览器预览版将笔记保存在浏览器本地存储中，不能选择文件夹。需要将笔记保存为本地 `.md` 文件时，请使用 Windows 安装版。

从源码构建 Windows 版本：

```bash
bash scripts/build-windows.sh
```

<a id="license"></a>
## 📜 开源协议

[MIT License](LICENSE) © 2026 kimroniny

---

<p align="center">
  <strong>会议可以拖。记录不能慢。</strong>
  <br>
  <sub>⚡ 打开比发言快，关掉比散会快。</sub>
</p>
