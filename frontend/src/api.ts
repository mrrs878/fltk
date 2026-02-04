/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-02-02 20:00:00
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-02-03 16:34:09
 */

// 定义全局 API 接口
declare global {
    interface Window {
        getDevices: () => Promise<string>;
        execAdbCommand: (params: string) => Promise<string>;
        connectDevice: (params: string) => Promise<string>;
        captureScreen: (params: string) => Promise<string>;
        rebootDevice: (params: string) => Promise<string>;
        sendKeyEvent: (params: string) => Promise<string>;
        chooseDirectory: (params: string) => Promise<string>;
        startLogcat: (params: string) => Promise<string>;
        stopLogcat: (params: string) => Promise<string>;
        getLogcatLines: (params: string) => Promise<string>;
        startRecording: (params: string) => Promise<string>;
        stopRecording: (params: string) => Promise<string>;
        chooseFile: (params: string) => Promise<string>;
        pushFile: (params: string) => Promise<string>;
        pullFile: (params: string) => Promise<string>;
        getInstalledApps: (params: string) => Promise<string>;
        getPackagePid: (params: string) => Promise<string>;
        listDeviceFiles: (params: string) => Promise<string>;
    }
}

// API 响应类型
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface Device {
    id: string;
    name: string;
    status: string;
    model?: string;
    version?: string;
    product?: string;
}

export interface DevicesResponse {
    devices: Array<Device>;
}

export interface CommandResponse {
    output: string;
    command: string;
}

// API 调用封装
export class AdbApi {
    // 安全解析 API 返回值
    private static parseResult(result: any): any {
        if (typeof result === 'string') {
            try {
                return JSON.parse(result);
            } catch (e) {
                console.error('Failed to parse result:', result, e);
                return { success: false, error: 'Invalid JSON response: ' + result };
            }
        }
        return result;
    }

    // 获取设备列表
    static async getDevices(): Promise<ApiResponse<DevicesResponse>> {
        try {
            const result = await window.getDevices();
            const data = this.parseResult(result);
            
            if (data.success) {
                return { success: true, data: { devices: data.devices } };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    // 执行 ADB 命令
    static async execCommand(
        command: string,
        deviceId?: string
    ): Promise<ApiResponse<CommandResponse>> {
        try {
            const params = JSON.stringify({
                command,
                deviceId: deviceId || "",
            });
            const result = await window.execAdbCommand(params);
            const data = this.parseResult(result);
            if (data.success) {
                return {
                    success: true,
                    data: { output: data.output, command: data.command },
                };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    // 连接设备
    static async connectDevice(host: string): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({ host });
            const result = await window.connectDevice(params);
            const data = this.parseResult(result);
            if (data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async disconnectDevice(host: string): Promise<ApiResponse> {
        return this.execCommand(`disconnect ${host}`);
    }

    static async getPackages(deviceId: string): Promise<ApiResponse<Array<string>>> {
        const result = await this.execCommand("shell pm list packages", deviceId);
        if (result.success && result.data) {
            const packages = result.data.output
                .split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim())
                .filter(pkg => pkg.length > 0);
            return { success: true, data: packages };
        }
        return { success: false, error: result.error };
    }

    static async installApp(deviceId: string, apkPath: string): Promise<ApiResponse> {
        return this.execCommand(`install "${apkPath}"`, deviceId);
    }

    static async uninstallApp(deviceId: string, packageName: string): Promise<ApiResponse> {
        return this.execCommand(`uninstall ${packageName}`, deviceId);
    }

    static async clearAppData(deviceId: string, packageName: string): Promise<ApiResponse> {
        return this.execCommand(`shell pm clear ${packageName}`, deviceId);
    }

    static async forceStopApp(deviceId: string, packageName: string): Promise<ApiResponse> {
        return this.execCommand(`shell am force-stop ${packageName}`, deviceId);
    }

    static async startRecording(deviceId: string): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({ deviceId });
            const result = await window.startRecording(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async stopRecording(deviceId: string, savePath?: string): Promise<ApiResponse<{path: string}>> {
        try {
            const params = JSON.stringify({ deviceId, savePath: savePath || "" });
            const result = await window.stopRecording(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { path: data.path }, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async rebootDevice(deviceId: string, mode: '' | 'recovery' | 'bootloader' = ''): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({ deviceId, mode });
            const result = await window.rebootDevice(params);
            const data = this.parseResult(result);
            return data.success 
                ? { success: true, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async rebootBootloader(deviceId: string): Promise<ApiResponse> {
        return this.rebootDevice(deviceId, 'bootloader');
    }

    static async rebootRecovery(deviceId: string): Promise<ApiResponse> {
        return this.rebootDevice(deviceId, 'recovery');
    }

    static async captureScreen(deviceId: string, savePath?: string): Promise<ApiResponse<{path: string}>> {
        try {
            const params = JSON.stringify({ deviceId, savePath: savePath || "" });
            const result = await window.captureScreen(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { path: data.path }, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async chooseDirectory(): Promise<ApiResponse<{path: string}>> {
        try {
            const params = JSON.stringify({});
            const result = await window.chooseDirectory(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { path: data.path } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async startLogcat(deviceId: string): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({ deviceId });
            const result = await window.startLogcat(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async stopLogcat(): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({});
            const result = await window.stopLogcat(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async getLogcatLines(lastIndex: number = 0): Promise<ApiResponse<{lines: Array<string>, newIndex: number, total: number, isRunning: boolean}>> {
        try {
            const params = JSON.stringify({ lastIndex });
            const result = await window.getLogcatLines(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { lines: data.lines, newIndex: data.newIndex, total: data.total, isRunning: data.isRunning } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async chooseFile(): Promise<ApiResponse<{path: string}>> {
        try {
            const params = JSON.stringify({});
            const result = await window.chooseFile(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { path: data.path } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async pushFile(deviceId: string, localPath: string, remotePath: string): Promise<ApiResponse> {
        try {
            const params = JSON.stringify({ deviceId, localPath, remotePath });
            const result = await window.pushFile(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async pullFile(deviceId: string, remotePath: string, localPath?: string): Promise<ApiResponse<{path: string}>> {
        try {
            const params = JSON.stringify({ deviceId, remotePath, localPath: localPath || "" });
            const result = await window.pullFile(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { path: data.path }, message: data.message }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async getInstalledApps(deviceId: string): Promise<ApiResponse<{packages: Array<{packageName: string, displayName: string}>}>> {
        try {
            const params = JSON.stringify({ deviceId });
            const result = await window.getInstalledApps(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { packages: data.packages } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async getPackagePid(deviceId: string, packageName: string): Promise<ApiResponse<{pid: string, running: boolean}>> {
        try {
            const params = JSON.stringify({ deviceId, packageName });
            const result = await window.getPackagePid(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { pid: data.pid, running: data.running } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    static async listDeviceFiles(deviceId: string, path: string = "/sdcard/"): Promise<ApiResponse<{files: Array<{name: string, isDirectory: boolean, path: string}>, currentPath: string}>> {
        try {
            const params = JSON.stringify({ deviceId, path });
            const result = await window.listDeviceFiles(params);
            const data = this.parseResult(result);
            return data.success
                ? { success: true, data: { files: data.files, currentPath: data.currentPath } }
                : { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }
}
