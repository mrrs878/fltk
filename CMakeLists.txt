cmake_minimum_required(VERSION 3.10)
project(quick_adb)

set(CMAKE_CXX_STANDARD 11)

include_directories(
    ${PROJECT_SOURCE_DIR}/include
)

# WIN32 flag makes it a GUI application on Windows (no console window)
# On other platforms, this flag is ignored
add_executable(quick_adb WIN32
    src/main.cpp
)

if(WIN32)
    target_link_libraries(quick_adb 
        advapi32 
        ole32 
        shell32 
        shlwapi 
        user32 
        version
        windowsapp
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