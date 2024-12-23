//添加子进程
const express = require('express');
const cors = require('cors');
const {glob} = require('glob');
const path = require('path');
const fs = require('fs');

let videoDir = "C:\\Users\\Administrator\\Downloads"
let localIp = "127.0.0.1"

const PORT_RANGE_START = 3300; // 端口范围起始值
const PORT_RANGE_END = 5000; // 端口范围结束值

let port = PORT_RANGE_START

// 使用glob搜索视频文件
getVideoFiles = async () => {
    const files = await glob(videoDir + "/*.*");
    return files.filter(file => {
        if (!isFile(file)) {
            return false
        }
        return file && file.endsWith(".mp4");
    }).map((file) => {
        const fileName = path.basename(file);
        return {
            title: fileName,
            url: `http://${localIp}:${port}/${encodeURIComponent(fileName)}`,
        };
    }).sort((a, b) => a['title'].localeCompare(b['title']))
};

function isFile(path) {
    try {
        const stats = fs.statSync(path);
        return stats.isFile()
    } catch (err) {
    }
    return false
}

function init() {
    return new Promise((resolve, reject) => {
        const app = express();
        // 启用 CORS
        app.use(cors());
        app.get("/api", async (req, res) => {
            const videos = await getVideoFiles();
            res.json(videos);
        });
        app.use('/', express.static(videoDir));
        // 尝试在指定范围内启动服务器
        const server = app.listen(port, "0.0.0.0", () => {
            console.log(`Server is listening on port ${port}`);
            resolve(port)
        });
        // 监听端口占用错误
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                // 端口被占用，尝试下一个端口
                port++;
                if (port <= PORT_RANGE_END) {
                    // 如果在范围内，则重新尝试
                    server.close(); // 关闭当前服务器
                    init().then(re => {
                        resolve(re)
                    });
                } else {
                    // 超出范围，报错处理
                    console.error('No available ports');
                    process.exit(1); // 或者其他错误处理
                    reject(false)
                }
            } else {
                // 其他错误处理
                console.error('An error occurred', error);
                process.exit(1);
                reject(false)
            }
        });
    })
}

module.exports = {init}
