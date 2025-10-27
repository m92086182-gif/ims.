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
        res.json({
            success: true,
            requests: requests.reverse()
        });
    } catch (error) {
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
    } catch (error) {
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
        const requestIndex = requests.findIndex(req => req.id === id);
        
        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الطلب غير موجود'
            });
        }
        
        if (action === 'accept') {
            requests[requestIndex].status = 'accepted';
            
            const acceptNotification = {
                id: Date.now().toString(),
                message: `تم قبول طلب ${requests[requestIndex].name}`,
                type: 'success',
                timestamp: new Date().toISOString()
            };
            notifications.push(acceptNotification);
            
        } else if (action === 'reject') {
            requests[requestIndex].status = 'rejected';
            
            const rejectNotification = {
                id: Date.now().toString(),
                message: `تم رفض طلب ${requests[requestIndex].name}`,
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
        
        res.json({
            success: true,
            message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح`
        });
    } catch (error) {
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
        res.status(500).json({
            success: false,
            message: 'خطأ في السيرفر'
        });
    }
});

// إرسال رسالة دعم
app.post('/api/support', (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        const supportMessage = {
            id: Date.now().toString(),
            message,
            timestamp: new Date().toISOString()
        };
        
        supportMessages.push(supportMessage);
        
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
    } catch (error) {
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
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'الرسالة مطلوبة'
            });
        }
        
        const adminNotification = {
            id: Date.now().toString(),
            message: `رسالة أدمن: ${message.substring(0, 50)}...`,
            type: 'admin',
            timestamp: new Date().toISOString(),
            schedule: schedule || null
        };
        
        notifications.push(adminNotification);
        
        res.json({
            success: true,
            message: 'تم إرسال الرسالة بنجاح'
        });
    } catch (error) {
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
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
    console.log(`📧 نقاط API متاحة على http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
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
