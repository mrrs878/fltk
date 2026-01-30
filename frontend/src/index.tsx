/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-28 19:45:52
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-01-30 10:58:15
 */

import { createStore } from "solid-js/store";
import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";

// 定义类型
type Device = {
  id: string;
  name: string;
  status: string;
  model?: string;
  version?: string;
};

type LogLevel = 'Verbose' | 'Debug' | 'Info' | 'Warn' | 'Error';

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  pid?: string;
};

type Tab = 'device-management' | 'logcat' | 'quick-actions';

// 主应用状态
const [state, setState] = createStore({
  devices: [] as Device[],
  selectedDevice: null as string | null,
  logs: [] as LogEntry[],
  logFilter: {
    packageName: '',
    keywords: '',
    logLevel: 'Verbose' as LogLevel,
  },
  isLogging: false,
  screenshots: [] as string[],
});

const Layout = (props) => {
  return (
    <div class="app-container">
      <TopBar />
      <SideBar setActiveTab={props.setActiveTab} activeTab={props.activeTab} />
      <main>
        {props.children}
      </main>
    </div>
  );
};

const TopBar = () => {
  return (
    <header>
      <h2>Quick ADB</h2>
    </header>
  );
};

const SideBar = (props) => {
  return (
    <div class="sidebar">
      <button 
        class={`nav-btn ${props.activeTab === 'device-management' ? 'active' : ''}`}
        onClick={() => props.setActiveTab('device-management')}
      >
        设备管理
      </button>
      <button 
        class={`nav-btn ${props.activeTab === 'logcat' ? 'active' : ''}`}
        onClick={() => props.setActiveTab('logcat')}
      >
        日志查看
      </button>
      <button 
        class={`nav-btn ${props.activeTab === 'quick-actions' ? 'active' : ''}`}
        onClick={() => props.setActiveTab('quick-actions')}
      >
        便捷操作
      </button>
    </div>
  );
};

const DeviceManagement = () => {
  const refreshDevices = () => {
    // 模拟获取设备列表
    setState('devices', [
      { id: 'emulator-5554', name: 'Android模拟器', status: '在线', model: 'AOSP', version: '11.0' },
      { id: 'R32D1234567', name: 'Pixel 5', status: '在线', model: 'Pixel 5', version: '12.1' },
      { id: 'G021Z9J00345678', name: 'Galaxy S21', status: '离线', model: 'SM-G991B', version: '13.0' }
    ]);
  };

  const selectDevice = (deviceId: string) => {
    setState('selectedDevice', deviceId);
  };

  onMount(refreshDevices);

  return (
    <div class="device-management">
      <div class="section-header">
        <h3>设备管理</h3>
        <button onClick={refreshDevices} class="btn-primary">刷新设备</button>
      </div>
      
      <div class="device-list">
        {state.devices.map(device => (
          <div 
            class={`device-item ${state.selectedDevice === device.id ? 'selected' : ''}`} 
            onClick={() => selectDevice(device.id)}
          >
            <div class="device-info">
              <h4>{device.name}</h4>
              <p>ID: {device.id}</p>
              <p>型号: {device.model || '未知'} | 版本: {device.version || '未知'}</p>
              <span class={`status ${device.status === '在线' ? 'online' : 'offline'}`}>
                {device.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {state.selectedDevice && (
        <div class="device-actions">
          <button class="btn-secondary">断开连接</button>
          <button class="btn-secondary">重启设备</button>
          <button class="btn-secondary">重启到Bootloader</button>
        </div>
      )}
    </div>
  );
};

const LogcatView = () => {
  const updateLogFilter = (field: keyof typeof state.logFilter, value: any) => {
    setState('logFilter', { [field]: value });
  };

  const toggleLogging = () => {
    setState('isLogging', !state.isLogging);
    // 这里应该调用后端API开始/停止日志记录
  };

  const clearLogs = () => {
    setState('logs', []);
  };

  // 模拟添加日志条目
  const addLogEntry = () => {
    const levels: LogLevel[] = ['Verbose', 'Debug', 'Info', 'Warn', 'Error'];
    const sampleLogs = [
      { timestamp: new Date().toISOString(), level: levels[Math.floor(Math.random() * levels.length)], tag: 'ActivityManager', message: 'Start proc com.example.app for activity: pid=1234 uid=10123' },
      { timestamp: new Date().toISOString(), level: 'Info', tag: 'PackageManager', message: 'Installing new package com.example.newapp' },
      { timestamp: new Date().toISOString(), level: 'Error', tag: 'System', message: 'Critical error occurred in system service' }
    ];
    
    setState('logs', [...sampleLogs]);
  };

  onMount(addLogEntry);

  return (
    <div class="logcat-view">
      <div class="section-header">
        <h3>日志查看</h3>
        <div class="log-controls">
          <button onClick={toggleLogging} class={state.isLogging ? 'btn-warning' : 'btn-primary'}>
            {state.isLogging ? '停止记录' : '开始记录'}
          </button>
          <button onClick={clearLogs} class="btn-secondary">清空日志</button>
        </div>
      </div>
      
      <div class="log-filters">
        <div class="filter-group">
          <label>包名过滤:</label>
          <input 
            type="text" 
            value={state.logFilter.packageName} 
            placeholder="com.example.app"
            onInput={(e) => updateLogFilter('packageName', e.currentTarget.value)} 
          />
        </div>
        
        <div class="filter-group">
          <label>关键词过滤:</label>
          <input 
            type="text" 
            value={state.logFilter.keywords} 
            placeholder="搜索关键词"
            onInput={(e) => updateLogFilter('keywords', e.currentTarget.value)} 
          />
        </div>
        
        <div class="filter-group">
          <label>日志级别:</label>
          <select 
            value={state.logFilter.logLevel} 
            onChange={(e) => updateLogFilter('logLevel', e.currentTarget.value as LogLevel)}
          >
            <option value="Verbose">Verbose</option>
            <option value="Debug">Debug</option>
            <option value="Info">Info</option>
            <option value="Warn">Warn</option>
            <option value="Error">Error</option>
          </select>
        </div>
      </div>
      
      <div class="log-output">
        {state.logs.map(log => (
          <div class={`log-entry log-${log.level.toLowerCase()}`}>
            <span class="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span class="level">{log.level}</span>
            <span class="tag">{log.tag}</span>
            <span class="message">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuickActions = () => {
  const captureScreen = () => {
    alert('正在截取屏幕...');
    // 这里应该调用后端API执行截图操作
  };

  const startRecording = () => {
    alert('开始录制屏幕...');
    // 这里应该调用后端API执行录屏操作
  };

  const installApp = () => {
    alert('请选择APK文件进行安装...');
    // 这里应该打开文件选择器并调用安装API
  };

  const uninstallApp = () => {
    alert('请输入包名卸载应用...');
    // 这里应该弹出输入框获取包名并调用卸载API
  };

  const pushFile = () => {
    alert('请选择要推送的文件...');
  };

  const pullFile = () => {
    alert('请选择要拉取的文件...');
  };

  const clearAppData = () => {
    alert('请输入包名以清除应用数据...');
  };

  const forceStopApp = () => {
    alert('请输入包名以强制停止应用...');
  };

  const rebootDevice = () => {
    if (confirm('确定要重启设备吗？')) {
      alert('正在重启设备...');
    }
  };

  const rebootRecovery = () => {
    if (confirm('确定要重启到恢复模式吗？')) {
      alert('正在重启到恢复模式...');
    }
  };

  return (
    <div class="quick-actions">
      <div class="section-header">
        <h3>便捷操作</h3>
      </div>
      
      <div class="action-category">
        <h4>媒体操作</h4>
        <div class="actions-row">
          <button onClick={captureScreen} class="action-btn btn-primary-light">截取屏幕</button>
          <button onClick={startRecording} class="action-btn btn-primary-light">开始录屏</button>
        </div>
      </div>
      
      <div class="action-category">
        <h4>应用管理</h4>
        <div class="actions-row">
          <button onClick={installApp} class="action-btn btn-success-light">安装应用</button>
          <button onClick={uninstallApp} class="action-btn btn-danger-light">卸载应用</button>
          <button onClick={forceStopApp} class="action-btn btn-warning-light">强制停止应用</button>
          <button onClick={clearAppData} class="action-btn btn-warning-light">清除应用数据</button>
        </div>
      </div>
      
      <div class="action-category">
        <h4>文件传输</h4>
        <div class="actions-row">
          <button onClick={pushFile} class="action-btn btn-secondary-light">推送文件</button>
          <button onClick={pullFile} class="action-btn btn-secondary-light">拉取文件</button>
        </div>
      </div>
      
      <div class="action-category">
        <h4>设备控制</h4>
        <div class="actions-row">
          <button onClick={rebootDevice} class="action-btn btn-danger-light">重启设备</button>
          <button onClick={rebootRecovery} class="action-btn btn-danger-light">重启到恢复模式</button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = createSignal<Tab>('device-management');
  
  return (
    <Layout activeTab={activeTab()} setActiveTab={setActiveTab}>
      {activeTab() === 'device-management' && <DeviceManagement />}
      {activeTab() === 'logcat' && <LogcatView />}
      {activeTab() === 'quick-actions' && <QuickActions />}
    </Layout>
  );
};

render(() => <App />, document.getElementById("solid-app")!);