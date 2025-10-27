const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));

// تخزين البيانات في الذاكرة
let requests = [];
let notifications = [];
let supportMessages = [];

// Routes
// الحصول على جميع الطلبات
app.get('/api/requests', (req, res) => {
    try {
        console.log('📨 جلب الطلبات - العدد:', requests.length);
        res.json({
            success: true,
            requests: requests.reverse() // أحدث الطلبات أولاً
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
        const { type, name, phone, country, quantity, range } = req.body;
        
        console.log('📝 طلب جديد:', { type, name, phone, country, quantity, range });
        
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
            status: 'pending',
            timestamp: new Date().toISOString(),
            receivedAt: new Date().toLocaleString('ar-EG')
        };
        
        requests.push(newRequest);
        
        // إضافة إشعار جديد
        const notificationMessage = type === 'account' 
            ? `طلب جديد: ${name} - إنشاء حساب (${phone})`
            : `طلب جديد: ${name} - أرقام ${country} (${quantity} رقم)`;
        
        const newNotification = {
            id: Date.now().toString(),
            message: notificationMessage,
            type: 'request',
            timestamp: new Date().toISOString(),
            requestId: newRequest.id
        };
        
        notifications.push(newNotification);
        
        console.log('✅ طلب مضاف بنجاح:', {
            id: newRequest.id,
            type: newRequest.type,
            name: newRequest.name,
            totalRequests: requests.length
        });
        
        res.json({
            success: true,
            message: 'تم إرسال الطلب بنجاح',
            request: newRequest,
            requestId: newRequest.id
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
        
        console.log(`🔄 معالجة طلب: ${id} - ${action}`);
        
        const requestIndex = requests.findIndex(req => req.id === id);
        
        if (requestIndex === -1) {
            console.log('❌ الطلب غير موجود:', id);
            return res.status(404).json({
                success: false,
                message: 'الطلب غير موجود'
            });
        }
        
        const request = requests[requestIndex];
        
        if (action === 'accept') {
            requests[requestIndex].status = 'accepted';
            requests[requestIndex].processedAt = new Date().toLocaleString('ar-EG');
            requests[requestIndex].adminMessage = adminMessage;
            
            const acceptNotification = {
                id: Date.now().toString(),
                message: `تم قبول طلب ${request.name}`,
                type: 'success',
                timestamp: new Date().toISOString(),
                requestId: request.id
            };
            notifications.push(acceptNotification);
            
            console.log('✅ طلب مقبول:', request.name);
            
        } else if (action === 'reject') {
            requests[requestIndex].status = 'rejected';
            requests[requestIndex].processedAt = new Date().toLocaleString('ar-EG');
            requests[requestIndex].adminMessage = adminMessage;
            
            const rejectNotification = {
                id: Date.now().toString(),
                message: `تم رفض طلب ${request.name}`,
                type: 'error',
                timestamp: new Date().toISOString(),
                requestId: request.id
            };
            notifications.push(rejectNotification);
            
            console.log('❌ طلب مرفوض:', request.name);
        } else {
            return res.status(400).json({
                success: false,
                message: 'إجراء غير صحيح'
            });
        }
        
        res.json({
            success: true,
            message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح`,
            request: requests[requestIndex]
        });
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// الحصول على الإشعارات
app.get('/api/notifications', (req, res) => {
    try {
        console.log('🔔 جلب الإشعارات - العدد:', notifications.length);
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
        const count = notifications.length;
        console.log('🔢 عدد الإشعارات:', count);
        res.json({
            success: true,
            count: count
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
        const { message, userName, userPhone } = req.body;
        
        console.log('💬 رسالة دعم جديدة:', { userName, userPhone, message });
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        const supportMessage = {
            id: Date.now().toString(),
            message,
            userName: userName || 'مستخدم',
            userPhone: userPhone || 'غير معروف',
            timestamp: new Date().toISOString()
        };
        
        supportMessages.push(supportMessage);
        
        const supportNotification = {
            id: Date.now().toString(),
            message: `رسالة دعم جديدة من ${userName || 'مستخدم'}: ${message.substring(0, 50)}...`,
            type: 'support',
            timestamp: new Date().toISOString()
        };
        
        notifications.push(supportNotification);
        
        console.log('✅ رسالة دعم مضافة بنجاح');
        
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

// إرسال رسالة أدمن
app.post('/api/admin/message', (req, res) => {
    try {
        const { message, schedule } = req.body;
        
        console.log('📢 رسالة أدمن:', message);
        
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
        
        console.log('✅ رسالة أدمن مضافة بنجاح');
        
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
            supportMessages: supportMessages.length,
            serverTime: new Date().toLocaleString('ar-EG')
        };
        
        console.log('📊 إحصائيات:', stats);
        
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

// مسح جميع البيانات (للتطوير فقط)
app.delete('/api/clear-data', (req, res) => {
    try {
        const previousRequests = requests.length;
        const previousNotifications = notifications.length;
        
        requests = [];
        notifications = [];
        supportMessages = [];
        
        console.log('🗑️ تم مسح جميع البيانات');
        
        res.json({
            success: true,
            message: 'تم مسح جميع البيانات',
            cleared: {
                requests: previousRequests,
                notifications: previousNotifications
            }
        });
        
    } catch (error) {
        console.error('❌ خطأ في مسح البيانات:', error);
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
    const healthInfo = {
        success: true,
        message: 'السيرفر يعمل بشكل صحيح',
        timestamp: new Date().toLocaleString('ar-EG'),
        data: {
            requests: requests.length,
            notifications: notifications.length,
            supportMessages: supportMessages.length
        }
    };
    
    console.log('❤️ Health check:', healthInfo);
    
    res.json(healthInfo);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ==================================');
    console.log('🚀 السيرفر يعمل على http://localhost:' + PORT);
    console.log('📧 نقاط API متاحة على http://localhost:' + PORT + '/api');
    console.log('❤️  Health check: http://localhost:' + PORT + '/api/health');
    console.log('📊 الإحصائيات: http://localhost:' + PORT + '/api/stats');
    console.log('🚀 ==================================');
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
    console.log('❌ Endpoint غير موجود:', req.url);
    res.status(404).json({
        success: false,
        message: 'Endpoint غير موجود'
    });
});
