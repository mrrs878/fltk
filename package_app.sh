#!/bin/bash

# FLTK应用程序打包脚本
APP_NAME="HelloFLTK"
EXECUTABLE="hello_fltk"
BUILD_DIR="build"
APP_DIR="${BUILD_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
FRAMEWORKS_DIR="${CONTENTS_DIR}/Frameworks"

echo "开始打包 ${APP_NAME}..."

# 创建.app目录结构
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"
mkdir -p "${FRAMEWORKS_DIR}"

# 复制可执行文件
cp "${BUILD_DIR}/${EXECUTABLE}" "${MACOS_DIR}/"

# 创建Info.plist
cat > "${CONTENTS_DIR}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleExecutable</key>
    <string>${EXECUTABLE}</string>
    <key>CFBundleGetInfoString</key>
    <string>HelloFLTK Application</string>
    <key>CFBundleIconFile</key>
    <string>app.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.example.${APP_NAME}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>NSAppleScriptEnabled</key>
    <string>YES</string>
    <key>NSMainNibFile</key>
    <string>MainMenu</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# 创建一个默认图标（如果不存在）
if [ ! -f "${RESOURCES_DIR}/app.icns" ]; then
    # 创建一个简单的占位符图标
    echo "警告: 未找到app.icns图标文件。请添加一个自定义图标到 ${RESOURCES_DIR}/app.icns"
    touch "${RESOURCES_DIR}/app.icns"
fi

# 对于FLTK应用，我们不需要特殊的框架，但如果需要包含库，可以在这里处理
echo "${APP_NAME}.app 已经创建在 ${BUILD_DIR} 目录中"

# 显示.app包的结构
echo "应用程序包结构:"
find "${APP_DIR}" -print | sed 's/^/  /'

echo "打包完成!"
echo "您可以在 ${APP_DIR} 中找到您的应用程序"
echo "要运行应用程序，请执行: open ${APP_DIR}"