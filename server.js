const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// تخزين البيانات في الذاكرة (في production استخدم قاعدة بيانات حقيقية)
let requests = [];
let notifications = [];
let supportMessages = [];

// Routes
// الحصول على جميع الطلبات
app.get('/api/requests', (req, res) => {
    res.json({
        success: true,
        requests: requests.reverse() // أحدث الطلبات أولاً
    });
});

// إضافة طلب جديد
app.post('/api/requests', (req, res) => {
    const { type, name, phone, country, quantity, range } = req.body;
    
    const newRequest = {
        id: Date.now().toString(),
        type,
        name,
        phone: phone || null,
        country: country || null,
        quantity: quantity || null,
        range: range || null,
        status: 'pending',
        timestamp: new Date().toISOString()
    };
    
    requests.push(newRequest);
    
    // إضافة إشعار جديد
    const notificationMessage = type === 'account' 
        ? `طلب جديد: ${name} - إنشاء حساب`
        : `طلب جديد: ${name} - أرقام (${country})`;
    
    const newNotification = {
        id: Date.now().toString(),
        message: notificationMessage,
        type: 'request',
        timestamp: new Date().toISOString()
    };
    
    notifications.push(newNotification);
    
    res.json({
        success: true,
        message: 'تم إرسال الطلب بنجاح',
        request: newRequest
    });
});

// معالجة طلب (قبول/رفض)
app.post('/api/requests/:id/:action', (req, res) => {
    const { id, action } = req.params;
    const requestIndex = requests.findIndex(req => req.id === id);
    
    if (requestIndex === -1) {
        return res.status(404).json({
            success: false,
            message: 'الطلب غير موجود'
        });
    }
    
    if (action === 'accept') {
        requests[requestIndex].status = 'accepted';
        
        // إضافة إشعار بالقبول
        const acceptNotification = {
            id: Date.now().toString(),
            message: `تم قبول طلب ${requests[requestIndex].name}`,
            type: 'success',
            timestamp: new Date().toISOString()
        };
        notifications.push(acceptNotification);
        
    } else if (action === 'reject') {
        requests[requestIndex].status = 'rejected';
        
        // إضافة إشعار بالرفض
        const rejectNotification = {
            id: Date.now().toString(),
            message: `تم رفض طلب ${requests[requestIndex].name}`,
            type: 'error',
            timestamp: new Date().toISOString()
        };
        notifications.push(rejectNotification);
    }
    
    res.json({
        success: true,
        message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح`
    });
});

// الحصول على الإشعارات
app.get('/api/notifications', (req, res) => {
    res.json({
        success: true,
        notifications: notifications.reverse() // أحدث الإشعارات أولاً
    });
});

// عدد الإشعارات
app.get('/api/notifications/count', (req, res) => {
    res.json({
        success: true,
        count: notifications.length
    });
});

// إرسال رسالة دعم
app.post('/api/support', (req, res) => {
    const { message } = req.body;
    
    const supportMessage = {
        id: Date.now().toString(),
        message,
        timestamp: new Date().toISOString()
    };
    
    supportMessages.push(supportMessage);
    
    // إضافة إشعار برسالة الدعم
    const supportNotification = {
        id: Date.now().toString(),
        message: `رسالة دعم جديدة: ${message.substring(0, 50)}...`,
        type: 'support',
        timestamp: new Date().toISOString()
    };
    
    notifications.push(supportNotification);
    
    res.json({
        success: true,
        message: 'تم إرسال رسالة الدعم بنجاح'
    });
});

// إرسال رسالة أدمن
app.post('/api/admin/message', (req, res) => {
    const { message, schedule } = req.body;
    
    const adminMessage = {
        id: Date.now().toString(),
        message,
        schedule: schedule || null,
        timestamp: new Date().toISOString()
    };
    
    // إضافة إشعار برسالة الأدمن
    const adminNotification = {
        id: Date.now().toString(),
        message: `رسالة أدمن: ${message.substring(0, 50)}...`,
        type: 'admin',
        timestamp: new Date().toISOString()
    };
    
    notifications.push(adminNotification);
    
    res.json({
        success: true,
        message: 'تم إرسال الرسالة بنجاح'
    });
});

// الحصول على رسائل الدعم
app.get('/api/support', (req, res) => {
    res.json({
        success: true,
        messages: supportMessages.reverse()
    });
});

// Route for serving the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📧 API endpoints available at http://localhost:${PORT}/api`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
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
