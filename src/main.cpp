/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-22 10:05:13
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-02-05 19:53:26
 */

// 必须在所有 include 之前定义，避免 Windows.h 定义 min/max 宏
#ifdef _WIN32
#define NOMINMAX
#endif

#include "webview-core/webview/webview.h"
#include "nlohmann/json.hpp"
#include <iostream>
#include <filesystem>
#include <array>
#include <memory>
#include <sstream>
#include <cstdio>
#include <thread>
#include <mutex>
#include <chrono>
#include <ctime>
#include <sys/stat.h>
#include <algorithm>

using json = nlohmann::json;

#ifdef _WIN32
#include <windows.h>
#include <direct.h>
#include <shlobj.h>
#pragma comment(linker, "/SUBSYSTEM:windows /ENTRY:mainCRTStartup")
#define PATH_SEP "\\"
#define popen _popen
#define pclose _pclose
#elif defined(__APPLE__)
#include <mach-o/dyld.h>
#include <libgen.h>
#define PATH_SEP "/"
#else
#include <unistd.h>
#include <limits.h>
#define PATH_SEP "/"
#endif

#define log_info(msg) std::cout << "[INFO] " << msg << std::endl;
#define log_error(msg) std::cout << "[ERROR] " << msg << std::endl;


std::string folder_path(const std::string& url)
{
    std::string filePath;
    constexpr std::string_view prefix = "file://";
    if (url.substr(0, prefix.size()) == prefix) {
        filePath = url.substr(prefix.size());
    } else {
        filePath = std::string(url);
    }

    auto pos = filePath.rfind('/');
    if (pos == std::string::npos) {
        return "";
    }

    return filePath.substr(0, pos);
}

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

std::string get_desktop_path()
{
#ifdef _WIN32
    char path[MAX_PATH];
    if (SHGetFolderPathA(NULL, CSIDL_DESKTOPDIRECTORY, NULL, 0, path) == S_OK)
    {
        return std::string(path);
    }
    return "";
#elif defined(__APPLE__)
    const char *home = getenv("HOME");
    if (home)
    {
        return std::string(home) + "/Desktop";
    }
    return "";
#else
    const char *home = getenv("HOME");
    if (home)
    {
        return std::string(home) + "/Desktop";
    }
    return "";
#endif
}

std::string exec_command(const std::string &cmd)
{
    std::array<char, 128> buffer;
    std::string result;
    
    // 确保在有效目录中执行命令，避免 "getcwd: cannot access parent directories" 错误
    std::string safe_cmd = cmd;
#ifdef _WIN32
    safe_cmd = "cd %TEMP% && " + cmd;
#else
    safe_cmd = "cd /tmp && " + cmd;
#endif
    
    std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(safe_cmd.c_str(), "r"), pclose);

    if (!pipe)
    {
        return R"({"error": "Failed to execute command"})";
    }

    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr)
    {
        result += buffer.data();
    }

    return result;
}

std::string get_adb_path()
{
    std::string exe_dir = get_exe_dir();
#ifdef _WIN32
    return exe_dir + "\\resources\\adb\\win\\adb.exe";
#elif defined(__APPLE__)
    return exe_dir + "/resources/adb/mac/adb";
#else
    return exe_dir + "/resources/adb/linux/adb";
#endif
}

std::string get_devices(const std::string &req)
{
    try
    {
        std::string adb_path = get_adb_path();
        std::string cmd = "\"" + adb_path + "\" devices -l";
        std::string output = exec_command(cmd);

        json devices = json::array();
        std::istringstream stream(output);
        std::string line;

        // 跳过第一行 "List of devices attached"
        std::getline(stream, line);

        while (std::getline(stream, line))
        {
            line.erase(line.find_last_not_of(" \t\r\n") + 1);

            if (line.empty())
                continue;

            // 查找第一个空格或制表符（兼容 Mac/Windows/Linux）
            // Windows 通常用制表符，Mac/Linux 可能用空格
            size_t tab_pos = line.find('\t');
            size_t space_pos = line.find_first_of("  "); // 查找连续的空格
            size_t pos = std::string::npos;

            if (tab_pos != std::string::npos && space_pos != std::string::npos)
            {
                pos = std::min(tab_pos, space_pos);
            }
            else if (tab_pos != std::string::npos)
            {
                pos = tab_pos;
            }
            else if (space_pos != std::string::npos)
            {
                pos = space_pos;
            }

            if (pos == std::string::npos)
                continue;

            std::string device_id = line.substr(0, pos);
            std::string rest = line.substr(pos);

            // 跳过多余的空格和制表符
            size_t start = rest.find_first_not_of(" \t");
            if (start == std::string::npos)
                continue;

            rest = rest.substr(start);

            // 解析状态和其他信息
            std::string device_status = "offline";
            std::string model = "";
            std::string product = "";

            if (rest.find("device") == 0)
            {
                device_status = "device";

                // 提取 model 信息
                size_t model_pos = rest.find("model:");
                if (model_pos != std::string::npos)
                {
                    size_t start = model_pos + 6;
                    size_t end = rest.find(' ', start);
                    if (end == std::string::npos)
                        end = rest.length();
                    model = rest.substr(start, end - start);
                }

                // 提取 product 信息
                size_t product_pos = rest.find("product:");
                if (product_pos != std::string::npos)
                {
                    size_t start = product_pos + 8;
                    size_t end = rest.find(' ', start);
                    if (end == std::string::npos)
                        end = rest.length();
                    product = rest.substr(start, end - start);
                }
            }
            else if (rest.find("offline") == 0)
            {
                device_status = "offline";
            }

            json device = {
                {"id", device_id},
                {"status", device_status},
                {"model", model},
                {"product", product}};

            devices.push_back(device);
        }

        json result = {
            {"success", true},
            {"devices", devices}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        std::cerr << "[ERROR] Exception in get_devices: " << e.what() << std::endl;
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string exec_adb_command(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string command = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
            {
                device_id = j["deviceId"].get<std::string>();
            }
            if (j.contains("command"))
            {
                command = j["command"].get<std::string>();
            }
        }

        if (command.empty())
        {
            json error = {{"success", false}, {"error", "Command is empty"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string full_cmd = "\"" + adb_path + "\"";

        if (!device_id.empty())
        {
            full_cmd += " -s " + device_id;
        }

        full_cmd += " " + command;

        std::string output = exec_command(full_cmd);

        json result = {
            {"success", true},
            {"output", output},
            {"command", full_cmd}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string connect_device(const std::string &req)
{
    try
    {
        std::cout << "[connect_device] Received: " << req << std::endl;

        auto j = json::parse(req);

        // webview.bind 将参数包装成数组包含JSON字符串
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string address = "";

        // 尝试不同的字段名
        if (j.is_object())
        {
            if (j.contains("address"))
            {
                address = j["address"].get<std::string>();
            }
            else if (j.contains("host"))
            {
                address = j["host"].get<std::string>();
            }
        }

        log_info("[connect_device] Connecting to device at address: " + address);

        if (address.empty())
        {
            json error = {{"success", false}, {"error", "Address is empty"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string cmd = "\"" + adb_path + "\" connect " + address;
        std::string output = exec_command(cmd);

        bool success = output.find("connected") != std::string::npos;

        json result = {
            {"success", success},
            {"message", output}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        log_error(std::string("[connect_device] Exception: ") + e.what());
        json error = {
            {"success", false},
            {"error", std::string("Exception: ") + e.what()}};
        return error.dump();
    }
}

std::string capture_screen(const std::string &req)
{
    try
    {
        json j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string save_path = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
            {
                device_id = j["deviceId"].get<std::string>();
            }
            if (j.contains("savePath"))
            {
                save_path = j["savePath"].get<std::string>();
            }
        }

        if (save_path.empty())
        {
            save_path = get_desktop_path();
            if (save_path.empty())
            {
                save_path = get_exe_dir();
            }
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id;

#ifdef _WIN32
        _mkdir(save_path.c_str());
#else
        mkdir(save_path.c_str(), 0755);
#endif

        auto now = std::time(nullptr);
        char timestamp[64];
        std::strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", std::localtime(&now));
        std::string local_path = save_path + PATH_SEP + "screenshot_" + std::string(timestamp) + ".png";

        std::string remote_path = "/sdcard/screenshot_temp.png";
        std::string cmd_capture = "\"" + adb_path + "\" " + device_arg + " shell screencap -p " + remote_path;
        std::string output1 = exec_command(cmd_capture);

        std::string cmd_pull = "\"" + adb_path + "\" " + device_arg + " pull " + remote_path + " \"" + local_path + "\"";
        std::string output2 = exec_command(cmd_pull);

        bool file_exists = false;
#ifdef _WIN32
        struct _stat buffer;
        file_exists = (_stat(local_path.c_str(), &buffer) == 0);
#else
        struct stat buffer;
        file_exists = (stat(local_path.c_str(), &buffer) == 0);
#endif

        bool success = file_exists || output2.find("pulled") != std::string::npos;

        json result = {
            {"success", success},
            {"message", success ? "截图已保存到: " + local_path : "截图失败: " + output2},
            {"path", local_path}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

static FILE *recording_pipe = nullptr;
static std::thread recording_thread;
static bool recording_running = false;

std::string start_recording(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        if (j.is_object() && j.contains("deviceId"))
        {
            device_id = j["deviceId"].get<std::string>();
        }

        if (recording_running)
        {
            json error = {
                {"success", false},
                {"error", "Recording is already running"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";

        std::string cmd_rm = "\"" + adb_path + "\" " + device_arg + "shell rm -f /sdcard/recording.mp4";
        exec_command(cmd_rm);

        std::string cmd = "\"" + adb_path + "\" " + device_arg + "shell screenrecord --time-limit 180 /sdcard/recording.mp4";

        recording_running = true;

        // 在新线程中运行录屏命令，以避免阻塞主线程
        recording_thread = std::thread([cmd]()
                                       {
            recording_pipe = popen(cmd.c_str(), "r");
            if (!recording_pipe)
            {
                recording_running = false;
                return;
            }
            
            // 等待录屏完成
            pclose(recording_pipe);
            recording_pipe = nullptr;
            recording_running = false; });

        recording_thread.detach();

        json result = {
            {"success", true},
            {"message", "Recording started"}};
        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string stop_recording(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string save_path = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
            {
                device_id = j["deviceId"].get<std::string>();
            }
            if (j.contains("savePath") && !j["savePath"].is_null())
            {
                save_path = j["savePath"].get<std::string>();
            }
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";

        // 停止录屏进程（发送Ctrl+C）
        std::string cmd_kill = "\"" + adb_path + "\" " + device_arg + "shell pkill -2 screenrecord";
        exec_command(cmd_kill);

        // 等待文件写入完成
        std::this_thread::sleep_for(std::chrono::seconds(2));

        recording_running = false;

        // 准备保存路径
        if (save_path.empty())
        {
            save_path = get_desktop_path();
        }

        time_t now = time(0);
        struct tm *ltm = localtime(&now);
        char timestamp[64];
        strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", ltm);

        std::string filename = "recording_" + std::string(timestamp) + ".mp4";
        std::string local_path = save_path + PATH_SEP + filename;

        std::string cmd_pull = "\"" + adb_path + "\" " + device_arg + "pull /sdcard/recording.mp4 \"" + local_path + "\"";
        std::string output = exec_command(cmd_pull);

        bool file_exists = false;
#ifdef _WIN32
        struct _stat buffer;
        file_exists = (_stat(local_path.c_str(), &buffer) == 0);
#else
        struct stat buffer;
        file_exists = (stat(local_path.c_str(), &buffer) == 0);
#endif

        bool success = file_exists || output.find("pulled") != std::string::npos;

        json result = {
            {"success", success},
            {"message", success ? "录屏已保存到: " + local_path : "拉取录屏失败: " + output},
            {"path", local_path}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

// Logcat相关的全局变量
static FILE *logcat_pipe = nullptr;
static std::thread logcat_thread;
static bool logcat_running = false;
static std::vector<std::string> logcat_buffer;
static std::mutex logcat_mutex;
static const size_t MAX_LOGCAT_BUFFER = 1000;
static size_t logcat_write_count = 0; // 总写入行数计数器

// 启动logcat
std::string start_logcat(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        if (j.is_object() && j.contains("deviceId"))
        {
            device_id = j["deviceId"].get<std::string>();
        }

        if (logcat_running)
        {
            json error = {
                {"success", false},
                {"error", "Logcat is already running"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";
        // 添加 -T '$(date +"%m-%d %H:%M:%S.000")' 参数，只显示从启动时刻开始的新日志
        std::string cmd = "\"" + adb_path + "\" " + device_arg + "logcat -v time -T 1";

        // 清空buffer
        {
            std::lock_guard<std::mutex> lock(logcat_mutex);
            logcat_buffer.clear();
            logcat_write_count = 0; // 重置计数器
        }

        logcat_running = true;

        // 在新线程中运行logcat，以避免阻塞主线程
        logcat_thread = std::thread([cmd]()
                                    {
            logcat_pipe = popen(cmd.c_str(), "r");
            if (!logcat_pipe)
            {
                logcat_running = false;
                return;
            }
            
            char buffer[1024];
            while (logcat_running && fgets(buffer, sizeof(buffer), logcat_pipe) != nullptr)
            {
                std::string line(buffer);
                // 移除尾部换行
                if (!line.empty() && line.back() == '\n')
                {
                    line.pop_back();
                }
                
                std::lock_guard<std::mutex> lock(logcat_mutex);
                logcat_buffer.push_back(line);
                logcat_write_count++; // 增加写入计数
                
                // 限制buffer大小
                if (logcat_buffer.size() > MAX_LOGCAT_BUFFER)
                {
                    logcat_buffer.erase(logcat_buffer.begin());
                }
            }
            
            if (logcat_pipe)
            {
                pclose(logcat_pipe);
                logcat_pipe = nullptr;
            } });

        logcat_thread.detach();

        json result = {
            {"success", true},
            {"message", "Logcat started"}};
        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

// 停止logcat
std::string stop_logcat(const std::string &req)
{
    try
    {
        if (!logcat_running)
        {
            json result = {
                {"success", true},
                {"message", "Logcat is not running"}};
            return result.dump();
        }

        logcat_running = false;

        // 给线程一些时间来清理
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        json result = {
            {"success", true},
            {"message", "Logcat stopped"}};
        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

// 获取logcat日志行（增量模式）
std::string get_logcat_lines(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        // 处理webview的数组格式
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        size_t lastIndex = 0; // 上次读取的写入计数位置
        if (j.is_object() && j.contains("lastIndex"))
        {
            lastIndex = j["lastIndex"].get<size_t>();
        }

        std::lock_guard<std::mutex> lock(logcat_mutex);

        json lines = json::array();
        size_t bufferSize = logcat_buffer.size();
        size_t currentWriteCount = logcat_write_count;

        // 计算需要读取的范围
        // 如果lastIndex < currentWriteCount - bufferSize，说明有日志被覆盖了
        size_t startOffset = 0;
        if (currentWriteCount > bufferSize)
        {
            size_t oldestIndex = currentWriteCount - bufferSize;
            if (lastIndex < oldestIndex)
            {
                // 有日志被覆盖，从最老的开始读
                startOffset = 0;
                lastIndex = oldestIndex;
            }
            else
            {
                startOffset = lastIndex - oldestIndex;
            }
        }
        else
        {
            startOffset = lastIndex;
        }

        // 返回从startOffset之后的新日志
        for (size_t i = startOffset; i < bufferSize; i++)
        {
            lines.push_back(logcat_buffer[i]);
        }

        json result = {
            {"success", true},
            {"lines", lines},
            {"newIndex", currentWriteCount}, // 返回当前写入计数
            {"total", (int)bufferSize},
            {"isRunning", logcat_running}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string get_installed_apps(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        if (j.is_object() && j.contains("deviceId"))
        {
            device_id = j["deviceId"].get<std::string>();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";
        std::string cmd = "\"" + adb_path + "\" " + device_arg + "shell pm list packages 2>&1";

        std::string output = exec_command(cmd);

        json packages = json::array();
        std::istringstream stream(output);
        std::string line;

        while (std::getline(stream, line))
        {
            line.erase(line.find_last_not_of(" \t\r\n") + 1);

            if (line.empty())
                continue;

            // 格式: package:com.example.app
            if (line.find("package:") == 0)
            {
                std::string package_name = line.substr(8);
                
                // 提取简短名称（最后一部分）
                std::string display_name = package_name;
                size_t last_dot = package_name.find_last_of('.');
                if (last_dot != std::string::npos && last_dot < package_name.length() - 1)
                {
                    display_name = package_name.substr(last_dot + 1);
                }
                
                json app_info = {
                    {"packageName", package_name},
                    {"displayName", display_name}
                };
                packages.push_back(app_info);
            }
        }

        json result = {
            {"success", true},
            {"packages", packages}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

std::string get_package_pid(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string package_name = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
                device_id = j["deviceId"].get<std::string>();
            if (j.contains("packageName"))
                package_name = j["packageName"].get<std::string>();
        }

        if (package_name.empty())
        {
            json error = {{"success", false}, {"error", "Package name is required"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";

        std::string cmd = "\"" + adb_path + "\" " + device_arg + "shell pidof " + package_name + " 2>&1";
        std::string output = exec_command(cmd);

        output.erase(output.find_last_not_of(" \t\r\n") + 1);

        if (!output.empty() && output.find("not found") == std::string::npos)
        {
            json result = {
                {"success", true},
                {"pid", output},
                {"running", true}};
            return result.dump();
        }

        log_info("[get_package_pid] pidof failed, trying ps grep: " + package_name);
        std::string ps_cmd = "\"" + adb_path + "\" " + device_arg + "shell \"ps | grep " + package_name + "\" 2>&1";
        std::string ps_output = exec_command(ps_cmd);

        log_info("[get_package_pid] ps output: " + ps_output);

        if (!ps_output.empty() && ps_output.find("not found") == std::string::npos)
        {
            // 格式: USER PID PPID VSZ RSS WCHAN PC S NAME
            std::istringstream stream(ps_output);
            std::string line;
            std::string pids = "";

            while (std::getline(stream, line))
            {
                if (line.empty() || line.find("grep") != std::string::npos)
                    continue;

                std::istringstream line_stream(line);
                std::string user, pid;
                line_stream >> user >> pid;

                if (!pid.empty() && pid.find_first_not_of("0123456789") == std::string::npos)
                {
                    if (!pids.empty())
                        pids += " ";
                    pids += pid;
                }
            }

            if (!pids.empty())
            {
                log_info("[get_package_pid] Found PIDs via ps: " + pids);
                json result = {
                    {"success", true},
                    {"pid", pids},
                    {"running", true}};
                return result.dump();
            }
        }

        json result = {
            {"success", true},
            {"pid", ""},
            {"running", false}};
        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

std::string list_device_files(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string path = "/sdcard/";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
                device_id = j["deviceId"].get<std::string>();
            if (j.contains("path"))
                path = j["path"].get<std::string>();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";
        std::string cmd = "\"" + adb_path + "\" " + device_arg + "shell ls -la \"" + path + "\"";

        std::string output = exec_command(cmd);

        json files = json::array();
        std::istringstream stream(output);
        std::string line;

        while (std::getline(stream, line))
        {
            line.erase(line.find_last_not_of(" \t\r\n") + 1);

            if (line.empty() || line.find("total ") == 0)
                continue;

            // drwxrwxrwx 或 -rw-rw-rw-
            if (line.length() > 10)
            {
                char type = line[0];
                bool is_dir = (type == 'd');

                size_t last_space = line.rfind(' ');
                if (last_space != std::string::npos)
                {
                    std::string filename = line.substr(last_space + 1);

                    // 忽略 . 和 ..
                    if (filename == "." || filename == "..")
                        continue;

                    json file_info = {
                        {"name", filename},
                        {"isDirectory", is_dir},
                        {"path", path + (path.back() == '/' ? "" : "/") + filename}};

                    files.push_back(file_info);
                }
            }
        }

        json result = {
            {"success", true},
            {"files", files},
            {"currentPath", path}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

std::string open_folder(const std::string &req) 
{
    try 
    {
        auto j = json::parse(req);
        std::string file_path = "";
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            file_path = j[0].get<std::string>();
        } else {
            json error = {{"success", false}, {"error", "Invalid request"}};
            return error.dump();
        }
        
        // 移除 file:// 前缀
        if (file_path.find("file://") == 0)
        {
            file_path = file_path.substr(7);
        }
        
        if (file_path.empty())
        {
            json error = {{"success", false}, {"error", "Invalid file path"}};
            return error.dump();
        }
        
#ifdef _WIN32
        // Windows: 使用 explorer /select, 打开文件夹并选中文件
        std::string command = "explorer /select,\"" + file_path + "\"";
#elif defined(__APPLE__)
        // macOS: 使用 open -R 在 Finder 中打开并选中文件
        std::string command = "open -R \"" + file_path + "\"";
#else
        log_info("open_folder not implemented on this platform");
        json error = {{"success", false}, {"error", "Not supported on this platform"}};
        return error.dump();
#endif
        std::string output = exec_command(command);
        log_info("open_folder command: " + command);
        log_info("open_folder output: " + output);
        bool success = output.empty() || output.find("error") == std::string::npos;
        json result = {
            {"success", success},
            {"message", success ? "已打开文件夹并选中文件" : "打开失败: " + output}
        };
        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string choose_directory(const std::string &req)
{
    try
    {
        std::string default_path = get_desktop_path();

#ifdef __APPLE__
        std::string cmd = "osascript -e 'tell application \"System Events\"' -e 'activate' -e 'set chosenFolder to choose folder with prompt \"选择截图保存位置\"' -e 'POSIX path of chosenFolder' -e 'end tell' 2>/dev/null";
        std::string result = exec_command(cmd);

        result.erase(std::remove(result.begin(), result.end(), '\n'), result.end());
        result.erase(std::remove(result.begin(), result.end(), '\r'), result.end());

        if (!result.empty() && result != "")
        {
            json response = {
                {"success", true},
                {"path", result}};
            return response.dump();
        }
#elif defined(_WIN32)
        std::string cmd = "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '选择截图保存位置'; $dialog.SelectedPath = '" + default_path + "'; if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.SelectedPath }\"";
        std::string result = exec_command(cmd);

        result.erase(std::remove(result.begin(), result.end(), '\n'), result.end());
        result.erase(std::remove(result.begin(), result.end(), '\r'), result.end());

        if (!result.empty())
        {
            json response = {
                {"success", true},
                {"path", result}};
            return response.dump();
        }
#endif

        json error = {
            {"success", false},
            {"error", "User cancelled or directory selection failed"}};
        return error.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string choose_file(const std::string &req)
{
    try
    {
#ifdef __APPLE__
        std::string cmd = "osascript -e 'tell application \"System Events\"' -e 'activate' -e 'set chosenFile to choose file with prompt \"选择要推送的文件\"' -e 'POSIX path of chosenFile' -e 'end tell' 2>/dev/null";
        std::string result = exec_command(cmd);

        result.erase(std::remove(result.begin(), result.end(), '\n'), result.end());
        result.erase(std::remove(result.begin(), result.end(), '\r'), result.end());

        if (!result.empty() && result != "")
        {
            json response = {
                {"success", true},
                {"path", result}};
            return response.dump();
        }
#elif defined(_WIN32)
        // Windows使用PowerShell打开文件选择对话框
        std::string cmd = "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Title = '选择要推送的文件'; if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.FileName }\"";
        std::string result = exec_command(cmd);

        result.erase(std::remove(result.begin(), result.end(), '\n'), result.end());
        result.erase(std::remove(result.begin(), result.end(), '\r'), result.end());

        if (!result.empty())
        {
            json response = {
                {"success", true},
                {"path", result}};
            return response.dump();
        }
#endif

        json error = {
            {"success", false},
            {"error", "User cancelled or file selection failed"}};
        return error.dump();
    }
    catch (const std::exception &e)
    {
        json error = {
            {"success", false},
            {"error", e.what()}};
        return error.dump();
    }
}

std::string push_file(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string local_path = "";
        std::string remote_path = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
                device_id = j["deviceId"].get<std::string>();
            if (j.contains("localPath"))
                local_path = j["localPath"].get<std::string>();
            if (j.contains("remotePath"))
                remote_path = j["remotePath"].get<std::string>();
        }

        if (local_path.empty() || remote_path.empty())
        {
            json error = {{"success", false}, {"error", "localPath and remotePath are required"}};
            return error.dump();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";
        std::string cmd = "\"" + adb_path + "\" " + device_arg + "push \"" + local_path + "\" \"" + remote_path + "\" 2>&1";

        std::string output = exec_command(cmd);
        log_info("[push_file] Command output: " + output);
        bool success = output.find("pushed") != std::string::npos || output.find("1 file") != std::string::npos;

        json result = {
            {"success", success},
            {"message", success ? "文件已推送" : "推送失败: " + output}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

std::string pull_file(const std::string &req)
{
    try
    {
        auto j = json::parse(req);

        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string device_id = "";
        std::string remote_path = "";
        std::string local_path = "";

        if (j.is_object())
        {
            if (j.contains("deviceId"))
                device_id = j["deviceId"].get<std::string>();
            if (j.contains("remotePath"))
                remote_path = j["remotePath"].get<std::string>();
            if (j.contains("localPath"))
                local_path = j["localPath"].get<std::string>();
        }

        if (remote_path.empty())
        {
            json error = {{"success", false}, {"error", "remotePath is required"}};
            return error.dump();
        }

        // 如果没有指定本地路径，保存到桌面
        if (local_path.empty())
        {
            local_path = get_desktop_path();
        }

        std::string adb_path = get_adb_path();
        std::string device_arg = device_id.empty() ? "" : "-s " + device_id + " ";
        std::string cmd = "\"" + adb_path + "\" " + device_arg + "pull \"" + remote_path + "\" \"" + local_path + "\" 2>&1";

        std::string output = exec_command(cmd);
        bool success = output.find("pulled") != std::string::npos;

        json result = {
            {"success", success},
            {"message", success ? "文件已拉取到: " + local_path : "拉取失败: " + output},
            {"path", local_path}};

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

// 复制文件到剪切板
std::string copy_file_to_clipboard(const std::string &req)
{
    try
    {
        auto j = json::parse(req);
        
        if (j.is_array() && !j.empty() && j[0].is_string())
        {
            std::string nested_str = j[0].get<std::string>();
            j = json::parse(nested_str);
        }

        std::string file_path = "";
        if (j.is_object() && j.contains("filePath"))
        {
            file_path = j["filePath"].get<std::string>();
        }

        if (file_path.empty())
        {
            json error = {{"success", false}, {"error", "filePath is required"}};
            return error.dump();
        }

        // 移除 file:// 前缀
        if (file_path.find("file://") == 0)
        {
            file_path = file_path.substr(7);
        }

        // 检查文件是否存在
        if (!std::filesystem::exists(file_path))
        {
            json error = {{"success", false}, {"error", "File not found: " + file_path}};
            return error.dump();
        }

#ifdef __APPLE__
        // macOS: 使用 osascript 调用 AppleScript 复制文件
        std::string cmd = "osascript -e 'set the clipboard to (read (POSIX file \"" + file_path + "\") as «class PNGf»)' 2>&1";
        
        // 对于图片文件，使用更简单的方法
        std::string ext = std::filesystem::path(file_path).extension().string();
        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
        
        if (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif")
        {
            // 对于图片，使用 osascript
            cmd = "osascript -e 'set the clipboard to (read (POSIX file \"" + file_path + "\") as JPEG picture)' 2>&1";
        }
        else if (ext == ".mp4" || ext == ".mov" || ext == ".avi")
        {
            // 视频文件复制为文件引用
            cmd = "osascript -e 'set the clipboard to (POSIX file \"" + file_path + "\")' 2>&1";
        }
        
        std::string output = exec_command(cmd);
        bool success = output.empty() || output.find("error") == std::string::npos;
        
#elif defined(_WIN32)
        // Windows: 使用 PowerShell 复制文件
        std::string ext = std::filesystem::path(file_path).extension().string();
        std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
        
        std::string ps_cmd;
        if (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".bmp" || ext == ".gif")
        {
            // 图片文件：复制图像数据
            ps_cmd = "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; "
                    "$img = [System.Drawing.Image]::FromFile('" + file_path + "'); "
                    "[System.Windows.Forms.Clipboard]::SetImage($img); "
                    "$img.Dispose()\"";
        }
        else
        {
            // 其他文件：复制文件引用
            ps_cmd = "powershell -Command \"Set-Clipboard -Path '" + file_path + "'\"";
        }
        
        std::string output = exec_command(ps_cmd);
        bool success = output.find("error") == std::string::npos && output.find("Exception") == std::string::npos;
#else
        // Linux: 不支持
        json error = {{"success", false}, {"error", "Clipboard operation not supported on this platform"}};
        return error.dump();
#endif

        json result = {
            {"success", success},
            {"message", success ? "已复制到剪切板" : "复制失败: " + output}
        };

        return result.dump();
    }
    catch (const std::exception &e)
    {
        json error = {{"success", false}, {"error", e.what()}};
        return error.dump();
    }
}

// 清理函数
void cleanup_on_exit()
{
    log_info("Cleaning up resources...");
    
    // 停止 logcat
    if (logcat_running)
    {
        log_info("Stopping logcat...");
        logcat_running = false;
        
        if (logcat_pipe)
        {
            pclose(logcat_pipe);
            logcat_pipe = nullptr;
        }
        
        // 等待线程结束
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    // 可选：停止 adb server（如果你希望完全清理）
    // 注释掉是因为其他工具可能正在使用 adb server
    // std::string adb_path = get_adb_path();
    // exec_command("\"" + adb_path + "\" kill-server");
    
    log_info("Cleanup completed");
}

int main()
{
    // 注册退出时清理函数
    std::atexit(cleanup_on_exit);
    
    // Create a webview window
    // Debug 模式启用开发者工具，Release 模式禁用右键菜单和开发者选项
#ifdef NDEBUG
    webview::webview w(false, nullptr);  // Release: 禁用调试
#else
    webview::webview w(true, nullptr);   // Debug: 启用调试
#endif

    if (!w.window().ok())
    {
        std::cout << "window not ok" << std::endl;
        return 1;
    }

    w.set_title("QuickADB");
    w.set_size(900, 600, WEBVIEW_HINT_NONE);

    std::string exe_dir = get_exe_dir();
    std::string html_path = "file://" + exe_dir + PATH_SEP + "frontend" + PATH_SEP + "index.html";

    std::cout << "[DEBUG] Loading: " << html_path << std::endl;

    w.bind("getDevices", get_devices);
    w.bind("execAdbCommand", exec_adb_command);
    w.bind("connectDevice", connect_device);
    w.bind("captureScreen", capture_screen);
    w.bind("startLogcat", start_logcat);
    w.bind("openFolder", open_folder);
    w.bind("stopLogcat", stop_logcat);
    w.bind("getLogcatLines", get_logcat_lines);
    w.bind("startRecording", start_recording);
    w.bind("stopRecording", stop_recording);
    w.bind("chooseFile", choose_file);
    w.bind("pushFile", push_file);
    w.bind("pullFile", pull_file);
    w.bind("getInstalledApps", get_installed_apps);
    w.bind("getPackagePid", get_package_pid);
    w.bind("listDeviceFiles", list_device_files);
    w.bind("copyFileToClipboard", copy_file_to_clipboard);

    std::cout << "[DEBUG] API bindings registered" << std::endl;

    w.navigate(html_path.c_str());
    w.run();
    
    // webview 退出后也会触发清理
    return 0;
}
