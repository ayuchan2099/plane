/**
 * 飞机大战 - 完整后端服务器
 * 包含微信登录和公告系统
 * 
 * 使用说明：
 * 1. 安装依赖：npm install express cors axios
 * 2. 配置微信AppID和AppSecret（环境变量或直接修改代码）
 * 3. 运行：node server.js
 * 4. 生产环境建议使用PM2：pm2 start server.js --name plane-server
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// 配置中间件
app.use(cors({
    origin: '*', // 生产环境建议限制为特定域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
    next();
});

// ⚠️ 重要：配置你的微信小游戏 AppID 和 AppSecret
// 方式1：使用环境变量（推荐）
const WECHAT_APPID = process.env.WECHAT_APPID || '你的APPID';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '你的SECRET';

// 方式2：直接在这里填写（不推荐，安全性低）
// const WECHAT_APPID = 'wx1116882ff98d8f09'; // 从project.config.json看到的
// const WECHAT_SECRET = '你的SECRET';

// ==================== 健康检查 ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        message: '服务器运行正常',
        domain: 'www.xinguolv.top'
    });
});

// ==================== 根路径 ====================
app.get('/', (req, res) => {
    res.json({
        message: '飞机大战 API 服务器',
        version: '1.0.0',
        domain: 'www.xinguolv.top',
        endpoints: {
            health: '/health',
            wechatLogin: '/api/wechat/login',
            announcements: '/api/announcements',
            adminAnnouncements: '/api/admin/announcements'
        },
        config: {
            appid: WECHAT_APPID ? (WECHAT_APPID.length > 10 ? WECHAT_APPID.substring(0, 10) + '...' : WECHAT_APPID) : '未配置'
        }
    });
});

// ==================== 微信登录接口 ====================
/**
 * POST /api/wechat/login
 * 微信小游戏登录接口
 */
app.post('/api/wechat/login', async (req, res) => {
    const { code } = req.body;

    // 验证参数
    if (!code) {
        return res.status(400).json({
            success: false,
            error: '缺少code参数'
        });
    }

    // 检查配置
    if (!WECHAT_APPID || WECHAT_APPID === '你的APPID' || !WECHAT_SECRET || WECHAT_SECRET === '你的SECRET') {
        console.error('❌ 微信AppID或Secret未配置！');
        return res.status(500).json({
            success: false,
            error: '服务器配置错误：微信AppID或Secret未配置'
        });
    }

    try {
        // 向微信服务器换取openid和session_key
        const response = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
            params: {
                appid: WECHAT_APPID,
                secret: WECHAT_SECRET,
                js_code: code,
                grant_type: 'authorization_code'
            },
            timeout: 5000
        });

        const { openid, session_key, unionid, errcode, errmsg } = response.data;

        // 检查微信返回的错误
        if (errcode) {
            console.error('微信API错误:', errcode, errmsg);
            return res.status(400).json({
                success: false,
                error: `微信API错误: ${errmsg || '未知错误'}`,
                errcode
            });
        }

        if (!openid) {
            return res.status(400).json({
                success: false,
                error: '未获取到openid'
            });
        }

        // 成功返回（不要返回session_key给前端）
        res.json({
            success: true,
            openid,
            unionid: unionid || null
        });

    } catch (error) {
        console.error('微信登录请求失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || '请求微信服务器失败'
        });
    }
});

// ==================== 公告系统 ====================

// 模拟数据库（实际应用中应该使用MySQL/MongoDB等）
let announcements = [
    {
        id: 'announce_001',
        type: 'important',
        title: '欢迎游玩飞机大战！',
        content: '感谢您体验由宁夏恒昌信息技术有限公司开发的飞机大战游戏！\n\n游戏特色：\n✨ 动态难度系统\n🎮 8种敌机类型\n🏆 成就系统\n📊 数据统计\n✈️ 多种战机皮肤',
        image: '',
        link: '',
        linkText: '',
        showOnce: false,
        priority: 100,
        startTime: Date.now() - 86400000,
        endTime: Date.now() + 86400000 * 30,
        buttons: [
            { text: '开始游戏', action: 'close' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'announce_002',
        type: 'event',
        title: '🎉 限时活动',
        content: '活动期间，每日签到可获得双倍金币！',
        image: '',
        link: '',
        linkText: '',
        showOnce: false,
        priority: 90,
        startTime: Date.now(),
        endTime: Date.now() + 86400000 * 7,
        buttons: [
            { text: '知道了', action: 'close' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
];

/**
 * GET /api/announcements
 * 获取公告列表（客户端调用）
 */
app.get('/api/announcements', (req, res) => {
    const now = Date.now();
    
    // 返回有效期内的公告，按优先级排序
    const activeAnnouncements = announcements
        .filter(a => a.startTime <= now && a.endTime >= now)
        .sort((a, b) => b.priority - a.priority);

    res.json({
        success: true,
        announcements: activeAnnouncements,
        total: activeAnnouncements.length
    });
});

/**
 * POST /api/admin/announcements
 * 创建新公告（管理员调用）
 */
app.post('/api/admin/announcements', (req, res) => {
    const {
        type,
        title,
        content,
        image,
        link,
        linkText,
        showOnce,
        priority,
        duration // 持续天数
    } = req.body;

    // 验证必填字段
    if (!type || !title || !content) {
        return res.status(400).json({
            success: false,
            message: '类型、标题和内容为必填项'
        });
    }

    // 生成公告ID
    const id = `announce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建公告对象
    const announcement = {
        id,
        type: type || 'normal',
        title,
        content,
        image: image || '',
        link: link || '',
        linkText: linkText || '',
        showOnce: showOnce || false,
        priority: priority || 50,
        startTime: Date.now(),
        endTime: Date.now() + (duration || 30) * 86400000, // 默认30天
        buttons: [
            { text: '知道了', action: 'close' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // 添加到数据库
    announcements.push(announcement);

    res.json({
        success: true,
        message: '公告创建成功',
        announcement
    });
});

/**
 * PUT /api/admin/announcements/:id
 * 更新公告（管理员调用）
 */
app.put('/api/admin/announcements/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const index = announcements.findIndex(a => a.id === id);
    
    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: '公告不存在'
        });
    }

    // 更新公告
    announcements[index] = {
        ...announcements[index],
        ...updates,
        updatedAt: Date.now()
    };

    res.json({
        success: true,
        message: '公告更新成功',
        announcement: announcements[index]
    });
});

/**
 * DELETE /api/admin/announcements/:id
 * 删除公告（管理员调用）
 */
app.delete('/api/admin/announcements/:id', (req, res) => {
    const { id } = req.params;

    const index = announcements.findIndex(a => a.id === id);
    
    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: '公告不存在'
        });
    }

    // 删除公告
    announcements.splice(index, 1);

    res.json({
        success: true,
        message: '公告删除成功'
    });
});

/**
 * GET /api/admin/announcements
 * 获取所有公告（管理员调用，包括过期的）
 */
app.get('/api/admin/announcements', (req, res) => {
    res.json({
        success: true,
        announcements: announcements,
        total: announcements.length
    });
});

// ==================== 启动服务器 ====================
const PORT = process.env.PORT || 3001; // 改为3001避免端口冲突
const HOST = process.env.HOST || '0.0.0.0'; // 允许外部访问

const server = app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 飞机大战 API 服务器启动成功！');
    console.log('='.repeat(60));
    console.log(`📡 监听地址: ${HOST}:${PORT}`);
    console.log(`\n🔗 API地址:`);
    console.log(`   健康检查: http://localhost:${PORT}/health`);
    console.log(`   微信登录: http://localhost:${PORT}/api/wechat/login`);
    console.log(`   公告列表: http://localhost:${PORT}/api/announcements`);
    
    // 检查配置
    if (!WECHAT_APPID || WECHAT_APPID === '你的APPID' || !WECHAT_SECRET || WECHAT_SECRET === '你的SECRET') {
        console.log('\n⚠️  警告：微信AppID或Secret未配置！');
        console.log('   请设置环境变量：');
        console.log('   export WECHAT_APPID=你的APPID');
        console.log('   export WECHAT_SECRET=你的SECRET');
        console.log('   或者在代码中直接配置');
    } else {
        console.log(`\n✅ 微信配置已加载`);
    }
    
    console.log('\n💡 提示:');
    console.log('   1. 确保域名 www.xinguolv.top 已指向此服务器');
    console.log('   2. 确保已配置HTTPS（SSL证书）');
    console.log('   3. 确保防火墙已允许端口 ' + PORT);
    console.log('   4. 生产环境建议使用PM2管理进程');
    console.log('='.repeat(60) + '\n');
});

// 错误处理
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ 错误: 端口 ${PORT} 已被占用`);
        console.error(`   请使用其他端口或关闭占用该端口的程序`);
    } else {
        console.error('❌ 服务器启动失败:', error);
    }
    process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('\n收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

// ==================== Vercel 部署支持 ====================
// Vercel 环境：导出 app（作为 serverless function）
// 本地环境：已在上面的代码中启动服务器
if (process.env.VERCEL || !process.env.PORT) {
    module.exports = app;
}
