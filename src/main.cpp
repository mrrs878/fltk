/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-22 10:05:13
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-28 11:59:16
 */

#include "webview-core/webview/webview.h"
#include <iostream>
#include <filesystem>

#ifdef _WIN32
#include <windows.h>
#pragma comment(linker, "/SUBSYSTEM:windows /ENTRY:mainCRTStartup")
#define PATH_SEP "\\"
#elif defined(__APPLE__)
#include <mach-o/dyld.h>
#include <libgen.h>
#define PATH_SEP "/"
#else
#include <unistd.h>
#include <limits.h>
#define PATH_SEP "/"
#endif

std::string get_exe_dir()
{
#ifdef _WIN32
    char path[MAX_PATH] = {0};
    GetModuleFileNameA(NULL, path, MAX_PATH);
    std::string str(path);
    size_t pos = str.find_last_of("\\/");
    return (pos == std::string::npos) ? "." : str.substr(0, pos);
#elif defined(__APPLE__)
    char result[PATH_MAX];
    uint32_t size = sizeof(result);
    if (_NSGetExecutablePath(result, &size) == 0)
    {
        std::string str(result);
        // On macOS, executable is in MyApp.app/Contents/MacOS/myapp
        // Resources are in MyApp.app/Contents/Resources/
        size_t pos = str.find("/Contents/MacOS");
        if (pos != std::string::npos)
        {
            // Return Contents/Resources/ directory
            return str.substr(0, pos) + "/Contents/Resources";
        }
        // Fallback: just return exe directory
        pos = str.find_last_of('/');
        return (pos == std::string::npos) ? "." : str.substr(0, pos);
    }
    return ".";
#else
    char result[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", result, PATH_MAX);
    if (count != -1)
    {
        result[count] = '\0';
        std::string str(result);
        size_t pos = str.find_last_of('/');
        return (pos == std::string::npos) ? "." : str.substr(0, pos);
    }
    return ".";
#endif
}

int main()
{
    // Create a webview window
    webview::webview w(true, nullptr);

    if (!w.window().ok())
    {
        std::cout << "window not ok" << std::endl;
        return 1;
    }

    w.set_title("QuickADB");
    w.set_size(800, 600, WEBVIEW_HINT_NONE);

    std::string exe_dir = get_exe_dir();
    std::string html_path = "file://" + exe_dir + PATH_SEP + "frontend" + PATH_SEP + "index.html";

    std::cout << "[DEBUG] Loading: " << html_path << std::endl;

    w.navigate(html_path.c_str());
    w.run();
    return 0;
}
