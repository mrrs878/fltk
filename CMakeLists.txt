cmake_minimum_required(VERSION 3.10)
project(fltk_example_project)

set(CMAKE_CXX_STANDARD 11)

set(FLTK_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/fltk_src)

set(FLTK_BUILD_FORMS ON CACHE BOOL "Build FLTK Forms library")

add_subdirectory(${FLTK_SOURCE_DIR} EXCLUDE_FROM_ALL)

# WIN32 flag makes it a GUI application on Windows (no console window)
# On other platforms, this flag is ignored
add_executable(hello_fltk WIN32
    src/main.cpp
)

target_link_libraries(hello_fltk fltk fltk_images)

if(WIN32)
    target_link_libraries(hello_fltk opengl32)
elseif(APPLE)
    target_link_libraries(hello_fltk "-framework Cocoa")
else()
    target_link_libraries(hello_fltk X11 Xext Xft Xinerama dl pthread)
endif()