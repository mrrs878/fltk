/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-22 10:05:13
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-22 11:50:48
 */
#include <FL/Fl.H>
#include <FL/Fl_Window.H>
#include <FL/Fl_Box.H>
#include <FL/Fl_Button.H>
#include <FL/Fl_Choice.H>
#include <iostream>
#include <string>

// 回调函数：当按钮被点击时调用
void button_callback(Fl_Widget* widget, void* data) {
    Fl_Box* box = reinterpret_cast<Fl_Box*>(data);
    box->label("Hello World!");
    widget->window()->redraw();
}

// 回调函数：当下拉选择项改变时调用
void choice_callback(Fl_Widget* widget, void* data) {
    Fl_Choice* choice = reinterpret_cast<Fl_Choice*>(widget);
    const char* selected_item = choice->text();
    
    Fl_Box* box = reinterpret_cast<Fl_Box*>(data);
    std::string new_label = "Selected: ";
    new_label += selected_item ? selected_item : "Nothing";
    box->label(new_label.c_str());
    widget->window()->redraw();
}

int main(int argc, char **argv) {
    // 创建主窗口（增加高度以适应所有控件）
    Fl_Window *window = new Fl_Window(320, 250, "Hello FLTK - C++ Version");

    // 创建信息显示框
    Fl_Box *infoBox = new Fl_Box(20, 30, 280, 40, "Click the button or select an option below");
    infoBox->box(FL_UP_BOX);
    infoBox->labelsize(14);
    infoBox->labelfont(FL_BOLD);
    infoBox->labelcolor(fl_rgb_color(0, 100, 200));

    // 创建下拉选择控件
    Fl_Choice *choice = new Fl_Choice(100, 90, 120, 30, "Options:");
    choice->add("Option 1");
    choice->add("Option 2");
    choice->add("Option 3");
    choice->add("Option 4");
    choice->value(0);             // 设置默认选中项
    
    // 设置选择回调函数
    choice->callback(choice_callback, (void*)infoBox);

    // 创建交互按钮
    Fl_Button *button = new Fl_Button(100, 140, 120, 40, "Click me!");
    button->callback(button_callback, (void*)infoBox);

    // 创建状态显示框
    Fl_Box *statusBox = new Fl_Box(20, 190, 280, 30, "Status: Ready");
    statusBox->labelsize(12);
    statusBox->align(FL_ALIGN_LEFT | FL_ALIGN_INSIDE);

    window->end();
    window->show(argc, argv);

    // 启动事件循环
    return Fl::run();
}