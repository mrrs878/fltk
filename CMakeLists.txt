cmake_minimum_required(VERSION 3.15)
project(quick_adb VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include_directories(
    ${PROJECT_SOURCE_DIR}/include
)

# ===== WebView2 配置 (Windows) =====
if(WIN32)
    file(GLOB WEBVIEW2_PACKAGES "${PROJECT_SOURCE_DIR}/packages/Microsoft.Web.WebView2.*")
    if(WEBVIEW2_PACKAGES)
        list(GET WEBVIEW2_PACKAGES 0 WEBVIEW2_PACKAGE_DIR)
        set(WEBVIEW2_INCLUDE_DIR "${WEBVIEW2_PACKAGE_DIR}/build/native/include")
        if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            set(WEBVIEW2_LIB_DIR "${WEBVIEW2_PACKAGE_DIR}/build/native/x64")
        else()
            set(WEBVIEW2_LIB_DIR "${WEBVIEW2_PACKAGE_DIR}/build/native/x86")
        endif()
        
        include_directories(${WEBVIEW2_INCLUDE_DIR})
        link_directories(${WEBVIEW2_LIB_DIR})
        message(STATUS "Found WebView2: ${WEBVIEW2_PACKAGE_DIR}")
    else()
        message(WARNING "WebView2 not found. Run: nuget install Microsoft.Web.WebView2 -OutputDirectory packages")
    endif()
endif()

# ===== 源文件配置 =====
set(SOURCES
    src/main.cpp
)

if(APPLE)
    add_executable(quick_adb MACOSX_BUNDLE ${SOURCES})
    
    set_target_properties(quick_adb PROPERTIES
        MACOSX_BUNDLE_BUNDLE_NAME "QuickADB"
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.mrrs878.quickadb"
        MACOSX_BUNDLE_BUNDLE_VERSION "${PROJECT_VERSION}"
        MACOSX_BUNDLE_SHORT_VERSION_STRING "${PROJECT_VERSION}"
        MACOSX_BUNDLE TRUE
        RESOURCE "${PROJECT_SOURCE_DIR}/frontend"
        RESOURCE "${PROJECT_SOURCE_DIR}/resources"
    )
    
    target_link_libraries(quick_adb
        "-framework Cocoa"
        "-framework WebKit"
    )
    
elseif(WIN32)
    # Windows: create console app (WIN32 flag removed to use standard main() entry)
    add_executable(quick_adb ${SOURCES})
    
    target_link_libraries(quick_adb 
        WebView2LoaderStatic
        advapi32 ole32 shell32 shlwapi user32 version
    )
    
    # Copy frontend resources to build directory
    add_custom_command(TARGET quick_adb POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:quick_adb>/frontend
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/frontend $<TARGET_FILE_DIR:quick_adb>/frontend
        COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:quick_adb>/resources
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/resources $<TARGET_FILE_DIR:quick_adb>/resources
        COMMENT "📦 Copying Windows resources..."
    )
    
else()
    add_executable(quick_adb ${SOURCES})
    
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
    pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.0)
    
    include_directories(${GTK3_INCLUDE_DIRS} ${WEBKIT_INCLUDE_DIRS})
    target_link_libraries(quick_adb ${GTK3_LIBRARIES} ${WEBKIT_LIBRARIES})
endif()

file(GLOB_RECURSE FRONTEND_FILES 
    "${PROJECT_SOURCE_DIR}/frontend/*.html"
    "${PROJECT_SOURCE_DIR}/frontend/*.js"
    "${PROJECT_SOURCE_DIR}/frontend/*.css"
    "${PROJECT_SOURCE_DIR}/frontend/*.png"
    "${PROJECT_SOURCE_DIR}/frontend/*.jpg"
    "${PROJECT_SOURCE_DIR}/frontend/*.svg"
)

file(GLOB_RECURSE RESOURCE_FILES 
    "${PROJECT_SOURCE_DIR}/resources/**/*"
)

# macOS: 开发模式使用符号链接，发布模式复制资源
if(APPLE)
    # 检查是否为 Release 构建或 CI 环境
    if(CMAKE_BUILD_TYPE STREQUAL "Release" OR DEFINED ENV{CI})
        # Release/CI 模式：复制文件
        add_custom_command(TARGET quick_adb POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources"
            COMMAND ${CMAKE_COMMAND} -E copy_directory 
                "${PROJECT_SOURCE_DIR}/frontend/dist" 
                "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/frontend"
            COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/resources/adb"
            COMMAND ${CMAKE_COMMAND} -E copy_directory 
                "${PROJECT_SOURCE_DIR}/resources/adb/mac" 
                "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/resources/adb/mac"
            COMMENT "📦 Copying frontend/dist + macOS adb tools (Release mode)"
            VERBATIM
        )
    else()
        # Debug 模式：使用符号链接
        add_custom_command(TARGET quick_adb POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources"
            COMMAND ${CMAKE_COMMAND} -E create_symlink 
                "${PROJECT_SOURCE_DIR}/frontend/dist" 
                "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/frontend"
            COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/resources/adb"
            COMMAND ${CMAKE_COMMAND} -E copy_directory 
                "${PROJECT_SOURCE_DIR}/resources/adb/mac" 
                "$<TARGET_BUNDLE_CONTENT_DIR:quick_adb>/Resources/resources/adb/mac"
            COMMENT "🔗 Creating symlinks to frontend/dist + copying macOS adb tools (Debug mode)"
            VERBATIM
        )
    endif()
    
elseif(WIN32)
    # Copy resources after building
    add_custom_command(TARGET quick_adb POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${PROJECT_SOURCE_DIR}/frontend/dist $<TARGET_FILE_DIR:quick_adb>/frontend
        # Only copy Windows-specific adb tools
        COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:quick_adb>/resources/adb
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${PROJECT_SOURCE_DIR}/resources/adb/win $<TARGET_FILE_DIR:quick_adb>/resources/adb/win
        COMMENT "📦 Copying frontend/dist + Windows adb tools"
        VERBATIM
    )
    
else()
    # Linux: Copy resources after building
    add_custom_command(TARGET quick_adb POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${PROJECT_SOURCE_DIR}/frontend/dist $<TARGET_FILE_DIR:quick_adb>/frontend
        # Linux can use mac tools or add linux-specific tools
        COMMAND ${CMAKE_COMMAND} -E make_directory $<TARGET_FILE_DIR:quick_adb>/resources/adb
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${PROJECT_SOURCE_DIR}/resources/adb/mac $<TARGET_FILE_DIR:quick_adb>/resources/adb/linux
        COMMENT "📦 Copying frontend/dist + Linux adb tools"
        VERBATIM
    )
endif()

add_custom_target(show_paths
    COMMAND ${CMAKE_COMMAND} -E echo "Project Source Dir: ${PROJECT_SOURCE_DIR}"
    COMMAND ${CMAKE_COMMAND} -E echo "Build Dir: ${CMAKE_BINARY_DIR}"
    COMMAND ${CMAKE_COMMAND} -E echo "Exe Output: $<TARGET_FILE:quick_adb>"
)