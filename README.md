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

下载 `QuickADB-macOS.zip` 后解压，**必须先运行 `install.command` 脚本**，然后才能打开应用。

**推荐步骤：**
1. 解压 `QuickADB-macOS.zip`
2. **双击运行 `install.command`**（会自动移除隔离属性）
3. 然后双击 `quick_adb.app` 启动应用

**如果双击 `install.command` 不工作：**
```bash
# 在终端中执行
cd /path/to/QuickADB文件夹
chmod +x install.command
./install.command
```

**手动方式（如果脚本失败）：**
```bash
xattr -cr /path/to/quick_adb.app
```

**为什么需要这个步骤？**
macOS 从互联网下载的应用会被添加"隔离属性"，阻止未公证的应用运行。运行 `install.command` 会移除这个限制。

### Windows

下载 `QuickADB-Windows.zip` 后解压，直接运行 `quick_adb.exe` 即可。
