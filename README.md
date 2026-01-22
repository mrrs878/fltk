# FLTK 示例项目

这是一个使用 FLTK 图形用户界面工具包的基本 C++ 项目。

## 项目结构

- `src/main.cpp`: 主程序入口点
- `CMakeLists.txt`: 构建配置文件
- `build/`: 编译输出目录（在构建时自动生成）
- `.vscode/`: VSCode配置文件
- `package_app.sh`: macOS应用程序打包脚本
- `package_linux.sh`: Linux应用程序打包脚本

## 如何构建项目

### 方法一：使用命令行

1. 确保你已经安装了必要的构建工具（如 CMake 和编译器）。
2. 在项目根目录下执行以下命令：

```bash
mkdir -p build
cd build
cmake ..
make
```

### 方法二：使用 VSCode 的 CMake 插件

1. 安装 VSCode 的 "CMake Tools" 扩展
2. 打开项目根目录
3. VSCode 会自动检测到 CMakeLists.txt 文件
4. 按 `Ctrl+Shift+P` 或 `Cmd+Shift+P` 打开命令面板
5. 输入 "CMake: Configure" 并执行
6. 输入 "CMake: Build" 来构建项目

或者，您可以使用 VSCode 底部状态栏中的 CMake 控件：
- 点击 "Unconfigured" 并选择 "Configure"
- 点击 "No Kit" 选择合适的编译器套件
- 点击 "Debug" 或 "Release" 选择构建类型
- 点击 "Build" 按钮构建项目

## 打包应用程序

### macOS 打包

运行打包脚本：

```bash
./package_app.sh
```

这将在 `build/` 目录中创建一个 `HelloFLTK.app` 包，可以直接双击运行。

### Linux 打包

运行打包脚本：

```bash
./package_linux.sh
```

这将在 `dist/` 目录中创建一个包含应用程序和必要文件的标准Linux包结构。

## 运行程序

### 命令行方式
```bash
./build/hello_fltk
```

### macOS 应用方式
```bash
open ./build/HelloFLTK.app
```

### VSCode 调试方式
按 `F5` 或点击 "Run and Debug" 按钮即可运行和调试应用程序。

## 任务和快捷键

- `Tasks: Run Task` -> 选择 "cmake configure" 来配置项目
- `Tasks: Run Task` -> 选择 "cmake build" 来构建项目
- `F5` -> 自动构建并启动调试会话

## FLTK 介绍

Fast Light Toolkit (FLTK) 是一个跨平台的 C++ GUI 工具包，提供了一组丰富的界面组件，包括：
- 基本控件：按钮、滑块、输入框等
- 高级控件：浏览器、菜单、编辑器等
- OpenGL 支持
- 图像支持

FLTK 设计为轻量级且高效，特别适合图形密集型应用或资源受限的环境。