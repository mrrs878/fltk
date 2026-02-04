<!--
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-22 10:15:12
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-27 19:48:15
-->
# QuickADB

一个ADB的图形化工具，基于webview框架开发，支持 macOS 和 Windows 平台。

## 主要功能

1. 设备管理：连接、断开和查看已连接的ADB设备。

2. 应用管理：安装、卸载和查看设备上的应用程序。

3. 文件传输：在本地计算机和ADB设备之间传输文件。

4. 命令执行：直接在ADB设备上执行ADB命令。

5. 日志查看：实时查看设备日志输出。

## 安装说明

### macOS

下载 `QuickADB-macOS.zip` 后解压，如果提示"应用已损坏"，请按以下步骤操作：

**方法一（推荐）：右键打开**
1. 右键点击 `quick_adb.app`
2. 选择"打开"（不是双击）
3. 在弹出对话框中点击"打开"
4. 之后可以正常双击启动

**方法二：终端命令**
```bash
xattr -cr /path/to/quick_adb.app
```

**原因说明：**
由于应用未经过 Apple 公证，macOS Gatekeeper 会阻止运行。上述方法可以移除隔离属性或添加安全例外。

### Windows

下载 `QuickADB-Windows.zip` 后解压，直接运行 `quick_adb.exe` 即可。
