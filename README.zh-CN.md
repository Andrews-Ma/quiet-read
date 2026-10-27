# 轻读提词器 QuietRead

[English](README.md) | 简体中文

QuietRead 是一款离线 macOS 提词器：它按照可调整的速度滚动稿件，在本地保存阅读位置，并提供英文和简体中文界面。首次启动默认使用英文，可在 **Settings → Language → 中文** 切换。

## 使用演示

以下无声动图录制自浏览器中真实运行的阅读界面，示例稿件为专门编写的演示文字。macOS 应用使用相同的阅读界面。

![提词器滚动中文示例稿件](docs/media/demo-zh.gif)

![Teleprompter scrolling an English sample](docs/media/demo-en.gif)

## 主要功能

- 导入 UTF-8 编码的 TXT、Markdown 文件，或直接粘贴文本。
- 自定义 1–1000 字符/分钟的速度范围，六个按钮均匀分布。例如 100–300 对应 100、140、180、220、260、300。
- 按段落、章节或进度条定位；调整字号、静默倒计时和专注阅读视图。
- 在本地保存最近稿件、阅读位置与设置，并提供进度备份恢复和存储错误提示。
- 无需联网、账号或麦克风权限；程序不录音，也不跟踪语音。

## 下载 macOS 预览版

[下载 Apple 芯片 Mac 预览版](https://github.com/Andrews-Ma/quiet-read/releases/tag/v3.2.0-preview.1)，需要 macOS 15 或更新版本。解压后可将 `QuietRead.app` 拖入“应用程序”。**此预览版仅经临时签名，尚未经过 Apple 公证**，下载后可能被 macOS 阻止打开；请查看发布说明和 [Apple 官方指引](https://support.apple.com/102445)。

## 系统要求与构建

需要 Apple 芯片 Mac、macOS 15 或更新版本、Xcode 或 Xcode 命令行工具，以及 Python 3。运行 JavaScript 测试还需要 Node.js。

在源码目录执行：

```sh
python3 scripts/build.py
```

生成的 `build/QuietRead.app` 可从 Finder 打开；`build/QuietRead.html` 可在浏览器中打开。构建脚本不会安装应用。应用使用本机 ad-hoc 签名；向其他 Mac 分发可能需要合适的 Apple 签名与公证。目前仓库以源码和自行构建为主。

查看 `python3 scripts/build.py --help` 可了解输出目录、应用名称、bundle identifier 和存储目录等选项。默认 bundle identifier 是示例值，分发自己的构建前应改为由自己控制的标识符。

## 稿件与隐私

TXT 按空行分段；Markdown 标题用于章节导航，不会作为正文朗读。代码块标记会隐藏，内部内容保留。录音前请检查导入结果。可用 `<!-- CONTENT START -->` 和 `<!-- CONTENT END -->` 标记限定导入内容，也兼容旧版中文内容标记。

滚动时进度约每两秒保存一次，导航或修改设置后也会保存；突然中断可能丢失最近尚未保存的位置。macOS 应用默认使用 `~/Library/Application Support/QuietRead/Data/`，浏览器版使用各浏览器的本地存储，两者相互独立。程序不会自行加密这些数据，请自行备份原稿。

## 测试与许可

测试命令及更完整的项目结构参见 [英文 README](README.md)。源码采用 [MIT 许可证](LICENSE)。
