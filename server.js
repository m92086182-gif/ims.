const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));

// تخزين البيانات
let requests = [];
let notifications = [];
let supportMessages = [];
let adminSockets = new Set();
let userSockets = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('🔗 عميل متصل جديد');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'admin_connect') {
                // اتصال أدمن
                adminSockets.add(ws);
                console.log('🛠️ أدمن متصل');
                
                // إرسال البيانات الحالية للأدمن
                ws.send(JSON.stringify({
                    type: 'initial_data',
                    requests: requests,
                    notifications: notifications
                }));
            }
            else if (data.type === 'user_connect') {
                // اتصال مستخدم عادي
                userSockets.set(data.userId, ws);
                console.log('👤 مستخدم متصل:', data.userId);
            }
            else if (data.type === 'new_message') {
                // رسالة جديدة من الدعم
                handleNewMessage(data);
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة رسالة WebSocket:', error);
        }
    });
    
    ws.on('close', () => {
        adminSockets.delete(ws);
        for (let [userId, socket] of userSockets.entries()) {
            if (socket === ws) {
                userSockets.delete(userId);
                break;
            }
        }
        console.log('🔌 عميل انقطع');
    });
});

// معالجة الرسائل الجديدة
function handleNewMessage(data) {
    const { message, userName, userPhone, type } = data;
    
    // حفظ الرسالة في قاعدة البيانات
    const newMessage = {
        id: Date.now().toString(),
        message,
        userName: userName || 'مستخدم',
        userPhone: userPhone || 'غير معروف',
        type: type || 'support',
        timestamp: new Date().toISOString(),
        status: 'new'
    };
    
    if (type === 'support') {
        supportMessages.push(newMessage);
    }
    
    // إضافة إشعار جديد
    const notification = {
        id: Date.now().toString(),
        message: type === 'support' 
            ? `رسالة دعم جديدة من ${userName}`
            : `طلب جديد: ${userName} - ${type === 'account' ? 'إنشاء حساب' : 'طلب أرقام'}`,
        type: type === 'support' ? 'support' : 'request',
        timestamp: new Date().toISOString(),
        data: newMessage
    };
    
    notifications.push(notification);
    
    // إرسال الإشعار لجميع الأدمن المتصلين
    broadcastToAdmins({
        type: 'new_notification',
        notification: notification
    });
    
    // إرسال تأكيد للمستخدم
    if (data.userId && userSockets.has(data.userId)) {
        const userWs = userSockets.get(data.userId);
        userWs.send(JSON.stringify({
            type: 'message_sent',
            message: 'تم إرسال رسالتك بنجاح وسيتم الرد قريباً'
        }));
    }
    
    console.log('📨 رسالة جديدة:', {
        type: type,
        user: userName,
        message: message.substring(0, 50) + '...'
    });
}

// بث البيانات لجميع الأدمن
function broadcastToAdmins(data) {
    const message = JSON.stringify(data);
    adminSockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

// Routes
// الحصول على جميع الطلبات
app.get('/api/requests', (req, res) => {
    try {
        res.json({
            success: true,
            requests: requests.reverse()
        });
    } catch (error) {
        console.error('❌ خطأ في جلب الطلبات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// إضافة طلب جديد
app.post('/api/requests', (req, res) => {
    try {
        const { type, name, phone, country, quantity, range, userId } = req.body;
        
        if (!type || !name) {
            return res.status(400).json({
                success: false,
                message: 'البيانات غير مكتملة'
            });
        }
        
        const newRequest = {
            id: Date.now().toString(),
            type,
            name,
            phone: phone || null,
            country: country || null,
            quantity: quantity || null,
            range: range || null,
            userId: userId || null,
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        
        requests.push(newRequest);
        
        // إرسال إشعار فوري عبر WebSocket
        handleNewMessage({
            type: type,
            message: type === 'account' ? 'طلب إنشاء حساب جديد' : `طلب أرقام لـ ${country}`,
            userName: name,
            userPhone: phone,
            userId: userId
        });
        
        res.json({
            success: true,
            message: 'تم إرسال الطلب بنجاح',
            request: newRequest
        });
        
    } catch (error) {
        console.error('❌ خطأ في إضافة طلب:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// معالجة طلب (قبول/رفض)
app.post('/api/requests/:id/:action', (req, res) => {
    try {
        const { id, action } = req.params;
        const { adminMessage } = req.body;
        
        const requestIndex = requests.findIndex(req => req.id === id);
        
        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الطلب غير موجود'
            });
        }
        
        const request = requests[requestIndex];
        
        if (action === 'accept') {
            requests[requestIndex].status = 'accepted';
            
            // إرسال رسالة قبول للمستخدم
            if (request.userId && userSockets.has(request.userId)) {
                const userWs = userSockets.get(request.userId);
                userWs.send(JSON.stringify({
                    type: 'request_accepted',
                    message: adminMessage || `تم قبول طلبك بنجاح! ${request.type === 'account' ? 'سيتم التواصل معك قريباً' : 'سيتم إرسال الأرقام قريباً'}`,
                    request: request
                }));
            }
            
            const acceptNotification = {
                id: Date.now().toString(),
                message: `تم قبول طلب ${request.name}`,
                type: 'success',
                timestamp: new Date().toISOString()
            };
            notifications.push(acceptNotification);
            
        } else if (action === 'reject') {
            requests[requestIndex].status = 'rejected';
            
            // إرسال رسالة رفض للمستخدم
            if (request.userId && userSockets.has(request.userId)) {
                const userWs = userSockets.get(request.userId);
                userWs.send(JSON.stringify({
                    type: 'request_rejected',
                    message: adminMessage || 'نأسف، تم رفض طلبك',
                    request: request
                }));
            }
            
            const rejectNotification = {
                id: Date.now().toString(),
                message: `تم رفض طلب ${request.name}`,
                type: 'error',
                timestamp: new Date().toISOString()
            };
            notifications.push(rejectNotification);
        } else {
            return res.status(400).json({
                success: false,
                message: 'إجراء غير صحيح'
            });
        }
        
        // إرسال تحديث للأدمن
        broadcastToAdmins({
            type: 'request_updated',
            request: requests[requestIndex]
        });
        
        res.json({
            success: true,
            message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح`
        });
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// إرسال رسالة من الأدمن للمستخدم
app.post('/api/send-message', (req, res) => {
    try {
        const { userId, message, requestId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        // البحث عن المستخدم
        if (userId && userSockets.has(userId)) {
            const userWs = userSockets.get(userId);
            userWs.send(JSON.stringify({
                type: 'admin_message',
                message: message,
                timestamp: new Date().toISOString()
            }));
            
            // تسجيل الرسالة
            const adminMessage = {
                id: Date.now().toString(),
                from: 'admin',
                to: userId,
                message: message,
                timestamp: new Date().toISOString()
            };
            
            console.log('📤 رسالة أدمن مرسلة:', { to: userId, message: message.substring(0, 50) + '...' });
            
            res.json({
                success: true,
                message: 'تم إرسال الرسالة بنجاح'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'المستخدم غير متصل حالياً'
            });
        }
        
    } catch (error) {
        console.error('❌ خطأ في إرسال رسالة:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// الحصول على الإشعارات
app.get('/api/notifications', (req, res) => {
    try {
        res.json({
            success: true,
            notifications: notifications.reverse()
        });
    } catch (error) {
        console.error('❌ خطأ في جلب الإشعارات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// عدد الإشعارات
app.get('/api/notifications/count', (req, res) => {
    try {
        res.json({
            success: true,
            count: notifications.length
        });
    } catch (error) {
        console.error('❌ خطأ في جلب عدد الإشعارات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// إرسال رسالة دعم
app.post('/api/support', (req, res) => {
    try {
        const { message, userName, userPhone, userId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        // استخدام WebSocket لإرسال الرسالة
        handleNewMessage({
            type: 'support',
            message: message,
            userName: userName || 'مستخدم',
            userPhone: userPhone || 'غير معروف',
            userId: userId
        });
        
        res.json({
            success: true,
            message: 'تم إرسال رسالة الدعم بنجاح'
        });
        
    } catch (error) {
        console.error('❌ خطأ في إرسال رسالة دعم:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// إرسال رسالة أدمن عامة
app.post('/api/admin/message', (req, res) => {
    try {
        const { message, schedule } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        const adminNotification = {
            id: Date.now().toString(),
            message: `رسالة أدمن: ${message}`,
            type: 'admin',
            timestamp: new Date().toISOString(),
            schedule: schedule || null
        };
        
        notifications.push(adminNotification);
        
        // بث الرسالة لجميع المستخدمين المتصلين
        const broadcastMessage = JSON.stringify({
            type: 'admin_broadcast',
            message: message,
            timestamp: new Date().toISOString()
        });
        
        userSockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(broadcastMessage);
            }
        });
        
        // إرسال للأدمن أيضاً
        broadcastToAdmins({
            type: 'new_notification',
            notification: adminNotification
        });
        
        res.json({
            success: true,
            message: 'تم إرسال الرسالة بنجاح'
        });
        
    } catch (error) {
        console.error('❌ خطأ في إرسال رسالة أدمن:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// الحصول على إحصائيات
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalRequests: requests.length,
            pendingRequests: requests.filter(req => req.status === 'pending').length,
            acceptedRequests: requests.filter(req => req.status === 'accepted').length,
            rejectedRequests: requests.filter(req => req.status === 'rejected').length,
            totalNotifications: notifications.length,
            connectedAdmins: adminSockets.size,
            connectedUsers: userSockets.size,
            supportMessages: supportMessages.length
        };
        
        res.json({
            success: true,
            stats: stats
        });
        
    } catch (error) {
        console.error('❌ خطأ في جلب الإحصائيات:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// Route for serving the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'السيرفر يعمل بشكل صحيح',
        timestamp: new Date().toISOString(),
        connections: {
            admins: adminSockets.size,
            users: userSockets.size
        }
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
    console.log(`📡 WebSocket server running on ws://localhost:${PORT}`);
    console.log(`📧 نقاط API متاحة على http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        message: 'حدث خطأ في السيرفر'
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint غير موجود'
    });
});
