const {app, Menu, ipcMain, globalShortcut, shell, dialog} = require('electron');
const path = require('path');
const crypto = require('crypto');
const {spawn} = require('child_process');
const fs = require('fs');

let mainWindow
//记录解析视频列表数据
let new_list_titles = {}
//记录下载进程对象
let spawnList = {}

const isDev = process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'dev';


const appInfo = () => {
    let appInfo = {
        x: undefined,
        y: undefined,
        width: 1366,
        height: 820
    };

    const appInfoFile = path.join(app.getPath('userData'), 'app_info.json');
    try {
        const state = JSON.parse(fs.readFileSync(appInfoFile, 'utf-8'));
        Object.assign(appInfo, state);
    } catch (err) {
    }

    return {
        x: appInfo.x,
        y: appInfo.y,
        width: appInfo.width,
        height: appInfo.height,
        saveWindowState: (window) => {
            const bounds = window.getBounds();
            appInfo['x'] = bounds.x
            appInfo['y'] = bounds.y
            appInfo['width'] = bounds.width
            appInfo['height'] = bounds.height
            fs.writeFileSync(appInfoFile, JSON.stringify(appInfo));
        }
    };
};


//加载html
function loadHtml(win) {
    if (isDev) {
        win.loadURL("http://127.0.0.1:8080").then()
    } else {
        win.loadFile('public/dist/index.html').then()
    }
}

// 注册热键功能(createWindow后才能生效)
function initGlobalShortcut(win) {
    globalShortcut.register("F10", () => {
        win.toggleDevTools(); // 切换开发工具
    });
    globalShortcut.register("F11", () => {
        const isFullScreen = win.isFullScreen();
        win.setFullScreen(!isFullScreen); // 切换全屏状态
    });
}

// 注册createWindow前Event
function initCreateBeforeEvent(port) {
    ipcMain.handle('getPort', () => {
        return port
    })
}

// 注册createWindow后Event
function initCreateAfterEvent(win) {
    win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        // 请求的 url => details.url
        // 请求的 method => details.method
        if (details.method !== 'GET' && details.method !== 'POST') {
            callback({cancel: false});
            return
        }
        if (!details.url.startsWith("https://m1-a1.cloud.nnpp.vip:2223/api/v/?z=")) {
            callback({cancel: false});
            return
        }
        callback({cancel: false});

        require('axios').get(details.url).then(response => {
            getVideoList(response.data)
        })
    })
}

//============嗅探下载视频 start============
function downloadVideo(win, data) {

    const url = data['url']

    let appPath = path.dirname(app.getAppPath())
    if (isDev) {
        appPath = app.getAppPath()
    }

    let save_dir = app.getPath("downloads")

    let exePath = appPath + "\\extraResources\\N_m3u8DL-RE.exe"
    if (isDev) {
        exePath = appPath + "\\build\\extraResources\\N_m3u8DL-RE.exe"
    }

    const rFileName = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);

    const fileName = data['name'] ? data['name'] : rFileName

    const downloadFilePath = save_dir + "\\" + fileName + ".mp4"

    if (isFileExist(win, downloadFilePath, fileName)) {
        let new_data = {"percent": 100, "speed": ""}
        new_data["url"] = url
        new_data["fileName"] = fileName
        mainWindow.webContents.send('on-update-download-progress', new_data)
        return;
    }

    console.info("start download...");
    console.info(url, fileName);
    const args = [
        '--save-dir', save_dir,
        '--tmp-dir', save_dir,
        '--save-name', fileName,
        '--no-log',
        url]
    const process = spawn(exePath, args)
    process.stdout.on("data", (data) => {
        const new_data = getDownloadInfo(data)
        if (new_data) {
            // console.log(new_data)
            new_data["url"] = url
            new_data["fileName"] = fileName
            new_data["type"] = 2
            mainWindow.webContents.send('on-update-download-progress', new_data)
        }
    })
    process.stdout.on("end", () => {
        if (isFileExist(win, downloadFilePath, fileName)) {
            let new_data = {"percent": 100, "speed": ""}
            new_data["url"] = url
            new_data["fileName"] = fileName
            mainWindow.webContents.send('on-update-download-progress', new_data)
        }
    })
    process.on("exit", (code) => {
        if (code === 1) {
            mainWindow.webContents.send('on-update-download-progress', {})
            const options = {
                title: "温馨提示",
                message: fileName + ",下载错误,请检测网络或重试!",
                buttons: ["知道了"]
            }
            dialog.showMessageBox(win, options).then()
        }
    })
    spawnList[url] = process
}

function getDownloadInfo(data) {
    let new_data = data.toString().trim()
    if (new_data && new_data.startsWith("Vid")) {
        let dataSp = new_data.split(' ')
        let percent
        let speed
        if (dataSp.length === 8) {
            percent = dataSp[4]
            speed = dataSp[6]
        }
        if (dataSp.length === 11) {
            percent = dataSp[7]
            speed = dataSp[9]
        }
        percent = percent.split('.')[0];
        percent = parseInt(percent)
        if (percent === 100) {
            return {"percent": 100, "speed": ""}
        }
        if (speed.indexOf("B") > 0) {
            speed = speed.slice(0, speed.indexOf("B") + 1);
        }
        return {"percent": percent, "speed": speed + "ps"}

    }
    return false
}

function isFileExist(win, filePath, fileName) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        console.info("end download");
        const options = {
            title: "温馨提示",
            message: fileName + ",下载完成,是否播放?",
            buttons: ["否", "是"]
        }
        dialog.showMessageBox(win, options).then((value) => {
            if (value.response === 0) {
                return
            }
            const name = path.basename(filePath)
            win.webContents.send('open-web-page', {url: "Video", name: name})
        })
        return true
    } catch (e) {
        return false
    }
}

function getVideoList(res) {
    if (!res) {
        return
    }
    let new_data = {}
    let data = res.data;
    if (!data) {
        return
    }

    for (let i = 0; i < data.length; i++) {
        const name = data[i]['name']
        const list = data[i]['source']['eps']
        for (let j = 0; j < list.length; j++) {
            new_data[list[j]['url']] = name + "_" + replaceEpisodes(re(list[j]['name']), list.length)

            data[i]['source']['eps'][j]['name'] = replaceEpisodes(re(data[i]['source']['eps'][j]['name']), list.length)
        }
    }
    mainWindow.webContents.send('update-list', data)
    new_list_titles = Object.assign({}, new_list_titles, new_data)
    // console.log(new_list_titles)
}

function re(text) {
    text = text.replace(" ", "")
    text = text.replace("话", "集")
    text = text.replace(/\t/g, '');
    return text
}

function replaceEpisodes(str, length) {
    return str.replace(/第(\d+)集/g, function (match, group1) {
        return '第' + group1.padStart(length.toString().length, '0') + '集';
    });
}

//============嗅探下载视频 end============

//初始化Event和Menu,electron和vue交互方法注册
function init(win, path, port) {
    mainWindow = win
    // 监听全屏事件
    win.on('enter-full-screen', () => {
        Menu.setApplicationMenu(null);
    });
    // 监听退出全屏事件
    win.on('leave-full-screen', () => {
        Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    });

    //  初始化菜单
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

    // 拦截新打开窗口
    win.webContents.setWindowOpenHandler(({url}) => {
        win.loadURL(url).then()
        return {action: 'deny'}
    })

    // 全窗口打开url
    ipcMain.on('set-full-screen', (event, isFullScreen, url) => {
        win.loadURL(url).then()
    })
    // 外部打开url
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url).then()
    })

    ipcMain.on('add-download-task', (event, data) => {
        downloadVideo(win, data)
    })

    ipcMain.on('pause-download-task', (event, data) => {
        if (spawnList[data['url']]) {
            spawnList[data['url']].kill()
            spawnList[data['url']] = false
        }
    })

    // 初始化console日志
    initLogFile()
}

//菜单
const menuTemplate = [
    {
        label: '⏮',
        click: async () => {
            mainWindow.webContents.navigationHistory.goBack();
        }
    },
    {
        label: '⏭',
        click: async () => {
            mainWindow.webContents.navigationHistory.goForward();
        }
    },
    {
        label: '🔄',
        click: async () => {
            mainWindow.webContents.reload();
        }
    },
    {
        label: '🏡',
        click: async () => {
            loadHtml(mainWindow)
        }
    },
    {
        label: '⏹',
        click: async () => {
            app.quit();
        }
    }
]

//日志 path：C:\Users\Administrator\AppData\Roaming\VipGo
function initLogFile() {
    const path = require('path')
    const fs = require('fs')
    const util = require('util')
    const os = require('os')

    // 创建一个日志文件的路径
    const logFilePath = path.join(app.getPath('userData'), 'electron.log');

    // console.log(logFilePath)

    // 创建一个可写流用于写入日志文件
    const logStream = fs.createWriteStream(logFilePath, {flags: 'a'});

    // 重定向 console.log, console.error 和 console.warn
    const originalConsoleLog = console.log;
    console.log = (...args) => {
        originalConsoleLog(...args);
        logStream.write(new Date().toLocaleString() + ' LOG: ' + util.format(...args) + os.EOL);
    };

    const originalConsoleError = console.error;
    console.error = (...args) => {
        originalConsoleError(...args);
        logStream.write(new Date().toLocaleString() + ' ERROR: ' + util.format(...args) + os.EOL);
    };

    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
        originalConsoleWarn(...args);
        logStream.write(new Date().toLocaleString() + ' WARN: ' + util.format(...args) + os.EOL);
    };
}

module.exports = {init, initGlobalShortcut, initCreateBeforeEvent, initCreateAfterEvent, loadHtml, appInfo}
