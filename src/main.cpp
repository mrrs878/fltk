/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-22 10:05:13
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-27 20:07:39
 */

#include "webview-core/webview/webview.h"
#include <iostream>

int main() {
    // Create a webview window
    webview::webview w(true, nullptr);

    if (!w.window().ok()) {
        std::cout << "window not ok" << std::endl;
        return 1;
    }

    w.set_title("QuickADB");
    w.set_size(800, 600, WEBVIEW_HINT_NONE);
    w.set_html(R"(
        <!DOCTYPE html>
        <html>
        <head>
            <title>QuickADB</title>
        </head>
        <body>
            <h1>Welcome to QuickADB</h1>
            <p>This is a simple webview application.</p>
        </body>
        </html>
    )");
    w.run();
    return 0;
}
