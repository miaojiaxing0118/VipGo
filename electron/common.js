const {app, Menu, ipcMain, globalShortcut, shell, dialog, AbortController} = require('electron');
const path = require('path');
const EAU = require('electron-asar-hot-updater');
const crypto = require('crypto');
const {spawn} = require('child_process');
const fs = require('fs');
let mainWindow
let new_path

let new_list_titles = {}

let spawnList = {}


const is_dev = () => {
    return process.env.NODE_ENV && process.env.NODE_ENV.trim().trim() === 'dev';
};

function loadHtml(win) {
    if (is_dev()) {
        win.loadURL("http://127.0.0.1:8080").then()
    } else {
        win.loadFile('public/dist/index.html').then()
    }
}

// 注册热键功能
function initGlobalShortcut(win) {
    globalShortcut.register("F10", () => {
        win.toggleDevTools(); // 切换开发工具
    });
    globalShortcut.register("F11", () => {
        const isFullScreen = win.isFullScreen();
        win.setFullScreen(!isFullScreen); // 切换全屏状态
    });
}

// 热更新不使用
function hotUpdate() {
    EAU.init({
        'api': 'http://127.0.0.1:10000/updateApp',
        'server': true,
        'debug': false,
        'headers': {Authorization: 'token'},
        'body': {
            name: app.getName(),
            current: app.getVersion()
        },
    });

    EAU.check(function (error, last, body) {
        if (error) {
            if (error === 'no_update_available') {
                const options = {title: "温馨提示", type: "info", message: "已经是最新版本!"}
                dialog.showMessageBox(options).then()
                return false;
            }
            if (error === 'cannot_connect_to_api') {
                const options = {title: "温馨提示", type: "info", message: "不支持热更新!"}
                dialog.showMessageBox(options).then()
                return false;
            }
            dialog.showErrorBox("", error)
            return false
        }

        EAU.progress(function (state) {
        })

        EAU.download(function (error) {
            if (error) {
                dialog.showErrorBox("", error)
                return false
            }
            setTimeout(() => {
                if (process.platform === 'darwin') {
                    app.relaunch()
                    app.quit()
                } else {
                    app.quit()
                }
            }, 2000);
        })
    })
}

function initCreateBeforeEvent(port) {
    ipcMain.handle('getPort', () => {
        return port
    })
}

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

    // win.webContents.session.webRequest.onCompleted((response) => {
    //         const url = response.url
    //         let title = win.webContents.getTitle().replace(" ", "_")
    //
    //         if (!url.endsWith("index.m3u8") || url.indexOf("/hls/") >= 0) {
    //             return
    //         }
    //         console.log("check m3u8 url")
    //         console.log(url, new_list_titles[url], title)
    //         const options = {
    //             title: "温馨提示",
    //             message: "检测到视频,是否下载?",
    //             buttons: ["否", "是"]
    //         }
    //         dialog.showMessageBox(win, options).then((value) => {
    //             if (value.response === 0) {
    //                 return
    //             }
    //             const fileName = new_list_titles[url] ? new_list_titles[url] : title
    //             downloadVideo(win, {url: url, name: fileName})
    //         })
    //     }
    // )
}

function downloadVideo(win, data) {

    const url = data['url']

    let appPath = path.dirname(app.getAppPath())
    if (is_dev()) {
        appPath = app.getAppPath()
    }

    let save_dir = app.getPath("downloads")

    let exePath = appPath + "\\extraResources\\N_m3u8DL-RE.exe"
    if (is_dev()) {
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
    const args = ['--thread-count', '8',
        '--save-dir', save_dir,
        '--tmp-dir', save_dir,
        '--save-name', fileName,
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
    mainWindow.webContents.send('update-list', data)
    for (let i = 0; i < data.length; i++) {
        const name = data[i]['name']
        const list = data[i]['source']['eps']
        for (let j = 0; j < list.length; j++) {
            new_data[list[j]['url']] = name + "_" + re(list[j]['name'])
        }
    }
    new_list_titles = Object.assign({}, new_list_titles, new_data)
    // console.log(new_list_titles)
}

function re(text) {
    text = text.replace(" ", "")
    text = text.replace(/\t/g, '');
    return text
}

//初始化Event和Menu,electron和vue交互方法注册
function init(win, path, port) {
    // 监听全屏事件
    win.on('enter-full-screen', () => {
        Menu.setApplicationMenu(null);
    });
    // 监听退出全屏事件
    win.on('leave-full-screen', () => {
        Menu.setApplicationMenu(Menu.buildFromTemplate(initMenu(win, path)));
    });

    //  初始化菜单
    Menu.setApplicationMenu(Menu.buildFromTemplate(initMenu(win, path)));

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

    // console日志保证本地文件,路径：C:\Users\Administrator\AppData\Roaming\tool
    initLogFile()
}

function initMenu(window, path) {
    mainWindow = window
    new_path = path
    return template
}

const template = [
    {
        label: '⏮',
        click: async () => {
            mainWindow.webContents.navigationHistory.goBack();
            setTimeout(() => {
                if (mainWindow.webContents.getURL().endsWith("/html/loading.html")) {
                    mainWindow.webContents.navigationHistory.goForward();
                }
            }, 1000)
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
    // {
    //     label: 'ℹ',
    //     click: async () => {
    //         hotUpdate()
    //     }
    // },
    {
        label: '⏹',
        click: async () => {
            app.quit();
        }
    }
]

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

module.exports = {init, initGlobalShortcut, initCreateBeforeEvent, initCreateAfterEvent, loadHtml}
