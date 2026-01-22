#!/bin/bash

# Linux FLTK应用程序打包脚本
APP_NAME="hello_fltk"
EXECUTABLE="hello_fltk"
BUILD_DIR="build"
PACKAGE_DIR="dist/${APP_NAME}_linux_x64"
BIN_DIR="${PACKAGE_DIR}/bin"
SHARE_DIR="${PACKAGE_DIR}/share"
ICON_DIR="${SHARE_DIR}/icons"
APPLICATION_DIR="${SHARE_DIR}/applications"

echo "开始打包 ${APP_NAME} for Linux..."

# 创建包目录结构
mkdir -p "${BIN_DIR}"
mkdir -p "${ICON_DIR}"
mkdir -p "${APPLICATION_DIR}"

# 复制可执行文件
cp "${BUILD_DIR}/${EXECUTABLE}" "${BIN_DIR}/"

# 创建桌面入口文件
cat > "${APPLICATION_DIR}/${APP_NAME}.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Hello FLTK
Comment=A sample FLTK application
Exec=${BIN_DIR}/${EXECUTABLE}
Icon=${ICON_DIR}/app.png
Terminal=false
Categories=Utility;
EOF

# 创建一个默认图标（PNG格式）
if [ ! -f "${ICON_DIR}/app.png" ]; then
    # 创建一个简单的占位符图标
    echo "警告: 未找到app.png图标文件。请添加一个自定义图标到 ${ICON_DIR}/app.png"
    touch "${ICON_DIR}/app.png"
fi

# 创建README文件
cat > "${PACKAGE_DIR}/README.txt" << EOF
Hello FLTK Application
======================

如何运行:
1. 确保系统已安装必要的库
2. 运行: ./bin/${EXECUTABLE}

依赖:
- FLTK库 (通常位于 /usr/lib 或 /usr/local/lib)
- X11开发库
- OpenGL库 (如果使用)
EOF

# 创建安装脚本
cat > "${PACKAGE_DIR}/install.sh" << EOF
#!/bin/bash
# 简单的安装脚本

INSTALL_DIR="/opt/hello_fltk"
sudo mkdir -p "\$INSTALL_DIR"
sudo cp -r bin share "\$INSTALL_DIR/"

# 创建桌面快捷方式
sudo cp "\$INSTALL_DIR/share/applications/${APP_NAME}.desktop" "/usr/share/applications/"
sudo update-desktop-database

echo "安装完成! 您可以在应用程序菜单中找到 ${APP_NAME} 或运行 /opt/hello_fltk/bin/${EXECUTABLE}"
EOF

chmod +x "${PACKAGE_DIR}/install.sh"

echo "${APP_NAME} Linux包已经创建在 ${PACKAGE_DIR} 目录中"

# 显示包结构
echo "包结构:"
find "${PACKAGE_DIR}" -print | sed 's/^/  /'

echo "打包完成!"
echo "您可以在 ${PACKAGE_DIR} 中找到您的Linux应用程序包"