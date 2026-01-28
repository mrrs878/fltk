cmake_minimum_required(VERSION 3.10)
project(quick_adb)

set(CMAKE_CXX_STANDARD 11)

include_directories(
    ${PROJECT_SOURCE_DIR}/include
)

# Find WebView2 on Windows
if(WIN32)
    # Look for WebView2 in packages directory
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
        message(WARNING "WebView2 not found in packages directory. Please run: nuget install Microsoft.Web.WebView2 -OutputDirectory packages")
    endif()
endif()

# Create executable
# MACOSX_BUNDLE creates .app bundle on macOS to hide terminal
if(APPLE)
    add_executable(quick_adb MACOSX_BUNDLE
        src/main.cpp
    )
    # Set macOS bundle properties
    set_target_properties(quick_adb PROPERTIES
        MACOSX_BUNDLE_BUNDLE_NAME "QuickADB"
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.mrrs878.quickadb"
        MACOSX_BUNDLE_BUNDLE_VERSION "1.0"
        MACOSX_BUNDLE_SHORT_VERSION_STRING "1.0"
    )
else()
    add_executable(quick_adb
        src/main.cpp
    )
endif()

if(WIN32)
    target_link_libraries(quick_adb 
        WebView2LoaderStatic
        advapi32 
        ole32 
        shell32 
        shlwapi 
        user32 
        version
    )
elseif(APPLE)
    target_link_libraries(quick_adb "-framework Cocoa" "-framework WebKit")
else()
    # Linux: link GTK and WebKitGTK
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
    pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.0)
    
    include_directories(${GTK3_INCLUDE_DIRS} ${WEBKIT_INCLUDE_DIRS})
    target_link_libraries(quick_adb ${GTK3_LIBRARIES} ${WEBKIT_LIBRARIES})
endif()
