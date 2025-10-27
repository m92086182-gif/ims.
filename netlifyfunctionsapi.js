// netlify/functions/api.js
const { v4: uuidv4 } = require('uuid');

// تخزين البيانات في الذاكرة (في production استخدم قاعدة بيانات حقيقية)
let requests = [];
let notifications = [];

exports.handler = async (event, context) => {
    const path = event.path.replace(/\/\.netlify\/functions\/api/, '');
    const method = event.httpMethod;
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
    };

    // Handle preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        let body = {};
        if (event.body) {
            body = JSON.parse(event.body);
        }

        console.log(`📨 ${method} ${path}`, body);

        // Routes
        if (path === '/requests' && method === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    requests: requests.reverse()
                })
            };
        }

        if (path === '/requests' && method === 'POST') {
            const { type, name, phone, country, quantity, range } = body;
            
            if (!type || !name) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'البيانات غير مكتملة'
                    })
                };
            }

            const newRequest = {
                id: uuidv4(),
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

            // إضافة إشعار
            const notificationMessage = type === 'account' 
                ? `طلب جديد: ${name} - إنشاء حساب`
                : `طلب جديد: ${name} - أرقام ${country}`;

            const newNotification = {
                id: uuidv4(),
                message: notificationMessage,
                type: 'request',
                timestamp: new Date().toISOString(),
                requestId: newRequest.id
            };

            notifications.push(newNotification);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'تم إرسال الطلب بنجاح',
                    request: newRequest
                })
            };
        }

        if (path.startsWith('/requests/') && method === 'POST') {
            const parts = path.split('/');
            const id = parts[2];
            const action = parts[3];

            const requestIndex = requests.findIndex(req => req.id === id);
            
            if (requestIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'الطلب غير موجود'
                    })
                };
            }

            const request = requests[requestIndex];

            if (action === 'accept') {
                requests[requestIndex].status = 'accepted';
                
                const acceptNotification = {
                    id: uuidv4(),
                    message: `تم قبول طلب ${request.name}`,
                    type: 'success',
                    timestamp: new Date().toISOString()
                };
                notifications.push(acceptNotification);

            } else if (action === 'reject') {
                requests[requestIndex].status = 'rejected';
                
                const rejectNotification = {
                    id: uuidv4(),
                    message: `تم رفض طلب ${request.name}`,
                    type: 'error',
                    timestamp: new Date().toISOString()
                };
                notifications.push(rejectNotification);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح`
                })
            };
        }

        if (path === '/notifications' && method === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    notifications: notifications.reverse()
                })
            };
        }

        if (path === '/notifications/count' && method === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    count: notifications.length
                })
            };
        }

        if (path === '/support' && method === 'POST') {
            const { message, userName, userPhone } = body;

            if (!message) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'الرسالة مطلوبة'
                    })
                };
            }

            const supportNotification = {
                id: uuidv4(),
                message: `رسالة دعم جديدة من ${userName || 'مستخدم'}: ${message.substring(0, 50)}...`,
                type: 'support',
                timestamp: new Date().toISOString()
            };

            notifications.push(supportNotification);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'تم إرسال رسالة الدعم بنجاح'
                })
            };
        }

        if (path === '/admin/message' && method === 'POST') {
            const { message } = body;

            if (!message) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: 'الرسالة مطلوبة'
                    })
                };
            }

            const adminNotification = {
                id: uuidv4(),
                message: `رسالة أدمن: ${message}`,
                type: 'admin',
                timestamp: new Date().toISOString()
            };

            notifications.push(adminNotification);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'تم إرسال الرسالة بنجاح'
                })
            };
        }

        if (path === '/health' && method === 'GET') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'السيرفر يعمل بشكل صحيح',
                    timestamp: new Date().toISOString(),
                    data: {
                        requests: requests.length,
                        notifications: notifications.length
                    }
                })
            };
        }

        // 404 - Not Found
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Endpoint غير موجود'
            })
        };

    } catch (error) {
        console.error('❌ Server error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'حدث خطأ في السيرفر'
            })
        };
    }
};