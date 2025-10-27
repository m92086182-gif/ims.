// API base URL - إصلاح الاتصال
const API_BASE_URL = window.location.origin + '/api';

// نظام التخزين المحلي (يعمل بدون سيرفر)
const LOCAL_STORAGE = {
    get: (key) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },
    set: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },
    add: (key, item) => {
        const data = LOCAL_STORAGE.get(key);
        const newItem = {
            id: Date.now().toString(),
            ...item,
            timestamp: new Date().toISOString()
        };
        data.unshift(newItem);
        LOCAL_STORAGE.set(key, data);
        return newItem;
    }
};

// API Functions محسنة
async function apiRequest(endpoint, options = {}) {
    try {
        console.log('🔗 إرسال طلب API:', endpoint);
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ استجابة API ناجحة:', endpoint);
        return data;
        
    } catch (error) {
        console.error('❌ فشل طلب API:', endpoint, error);
        
        // Fallback to local storage if API fails
        if (endpoint === '/requests' && options.method === 'GET') {
            const localData = LOCAL_STORAGE.get('requests');
            return { success: true, requests: localData };
        }
        
        if (endpoint === '/notifications/count' && options.method === 'GET') {
            const localData = LOCAL_STORAGE.get('notifications');
            return { success: true, count: localData.length };
        }
        
        showToast('حدث خطأ في الاتصال بالسيرفر', true);
        throw error;
    }
}

// تحديث وظيفة تحميل طلبات الأدمن
async function loadAdminRequests() {
    try {
        console.log('🔄 جلب طلبات الأدمن...');
        const data = await apiRequest('/requests');
        
        if (!data.success) {
            throw new Error('Failed to load requests');
        }
        
        const requestsContainer = document.getElementById('requestsContainer');
        requestsContainer.innerHTML = '';

        if (!data.requests || data.requests.length === 0) {
            requestsContainer.innerHTML = `
                <div style="text-align: center; color: #777; padding: 40px; background: #f8f9fa; border-radius: 10px;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; color: #ddd;"></i>
                    <h3>لا توجد طلبات جديدة</h3>
                    <p>سيظهر هنا أي طلبات جديدة من المستخدمين</p>
                </div>
            `;
            return;
        }

        console.log('📋 عرض الطلبات:', data.requests.length);

        data.requests.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.className = 'request-item';
            requestElement.innerHTML = `
                <div class="request-info">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 1.1rem;">${request.name}</strong>
                            <span style="background: ${request.type === 'account' ? '#3498db' : '#e74c3c'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 10px;">
                                ${request.type === 'account' ? 'إنشاء حساب' : 'طلب أرقام'}
                            </span>
                        </div>
                        <small style="color: #666;">${new Date(request.timestamp).toLocaleString('ar-EG')}</small>
                    </div>
                    
                    ${request.phone ? `<div><i class="fas fa-phone"></i> ${request.phone}</div>` : ''}
                    ${request.country ? `<div><i class="fas fa-globe"></i> ${request.country}</div>` : ''}
                    ${request.quantity ? `<div><i class="fas fa-hashtag"></i> ${request.quantity} رقم</div>` : ''}
                    ${request.range ? `<div><i class="fas fa-list"></i> ${request.range}</div>` : ''}
                    
                    ${request.status !== 'pending' ? `
                        <div style="margin-top: 10px; padding: 8px; background: ${request.status === 'accepted' ? '#d4edda' : '#f8d7da'}; border-radius: 5px; border: 1px solid ${request.status === 'accepted' ? '#c3e6cb' : '#f5c6cb'};">
                            <strong>الحالة:</strong> ${request.status === 'accepted' ? 'مقبول' : 'مرفوض'}
                            ${request.adminMessage ? `<br><strong>الرسالة:</strong> ${request.adminMessage}` : ''}
                        </div>
                    ` : ''}
                </div>
                ${request.status === 'pending' ? `
                    <div class="request-actions">
                        <button class="btn accept-btn" data-id="${request.id}" style="padding: 8px 15px; background: #2ecc71;">
                            <i class="fas fa-check"></i> قبول
                        </button>
                        <button class="btn reject-btn" data-id="${request.id}" style="padding: 8px 15px; background: #e74c3c;">
                            <i class="fas fa-times"></i> رفض
                        </button>
                    </div>
                ` : ''}
            `;
            requestsContainer.appendChild(requestElement);
        });

        // إضافة event listeners للأزرار
        document.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = e.target.closest('button').dataset.id;
                await handleRequestAction(requestId, 'accept');
            });
        });

        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const requestId = e.target.closest('button').dataset.id;
                await handleRequestAction(requestId, 'reject');
            });
        });

    } catch (error) {
        console.error('❌ خطأ في تحميل الطلبات:', error);
        const requestsContainer = document.getElementById('requestsContainer');
        requestsContainer.innerHTML = `
            <div style="text-align: center; color: #e74c3c; padding: 20px; background: #f8d7da; border-radius: 10px;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>خطأ في تحميل الطلبات</h3>
                <p>تعذر الاتصال بالسيرفر. يرجى المحاولة مرة أخرى.</p>
            </div>
        `;
    }
}

// معالجة إجراءات الطلبات
async function handleRequestAction(requestId, action) {
    try {
        const adminMessage = prompt(`اكتب رسالة للمستخدم (اختياري):`);
        
        const response = await apiRequest(`/requests/${requestId}/${action}`, {
            method: 'POST',
            body: JSON.stringify({ adminMessage })
        });
        
        if (response.success) {
            showToast(`تم ${action === 'accept' ? 'قبول' : 'رفض'} الطلب بنجاح!`);
            await loadAdminRequests();
            await updateNotificationBadge();
        } else {
            showToast('فشل في معالجة الطلب', true);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الطلب:', error);
        showToast('حدث خطأ في معالجة الطلب', true);
    }
}

// تحديث العداد
async function updateNotificationBadge() {
    try {
        const data = await apiRequest('/notifications/count');
        const badge = document.getElementById('notificationBadge');
        if (data.success) {
            badge.textContent = data.count;
            badge.style.display = data.count > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        // Fallback to local storage
        const notifications = LOCAL_STORAGE.get('notifications');
        const badge = document.getElementById('notificationBadge');
        badge.textContent = notifications.length;
        badge.style.display = notifications.length > 0 ? 'flex' : 'none';
    }
}

// تحديث إرسال الطلبات
accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userName = document.getElementById('userName').value;
    const userPhone = document.getElementById('userPhone').value;
    
    try {
        const response = await apiRequest('/requests', {
            method: 'POST',
            body: JSON.stringify({
                type: 'account',
                name: userName,
                phone: userPhone
            })
        });

        if (response.success) {
            console.log('✅ طلب حساب مضاف بنجاح:', response.requestId);
            accountModal.style.display = 'none';
            successModal.style.display = 'flex';
            accountForm.reset();
            
            // تحديث العداد
            await updateNotificationBadge();
            
            setTimeout(() => {
                successModal.style.display = 'none';
            }, 3000);
        } else {
            showToast('فشل في إرسال الطلب', true);
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال طلب الحساب:', error);
        showToast('حدث خطأ في إرسال الطلب', true);
    }
});

numbersForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const country = document.getElementById('country').value;
    const range = document.getElementById('range').value;
    const quantity = document.getElementById('quantity').value;
    const accountName = document.getElementById('accountName').value;
    
    try {
        const response = await apiRequest('/requests', {
            method: 'POST',
            body: JSON.stringify({
                type: 'numbers',
                name: accountName,
                country: country,
                quantity: parseInt(quantity),
                range: range
            })
        });

        if (response.success) {
            console.log('✅ طلب أرقام مضاف بنجاح:', response.requestId);
            numbersModal.style.display = 'none';
            successModal.style.display = 'flex';
            numbersForm.reset();
            
            // تحديث العداد
            await updateNotificationBadge();
            
            setTimeout(() => {
                successModal.style.display = 'none';
            }, 3000);
        } else {
            showToast('فشل في إرسال الطلب', true);
        }
    } catch (error) {
        console.error('❌ خطأ في إرسال طلب الأرقام:', error);
        showToast('حدث خطأ في إرسال الطلب', true);
    }
});

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 الصفحة محملة - بدء التهيئة');
    await updateNotificationBadge();
    
    // اختبار الاتصال بالسيرفر
    try {
        const health = await apiRequest('/health');
        console.log('✅ الاتصال بالسيرفر نشط:', health);
    } catch (error) {
        console.warn('⚠️ السيرفر غير متوفر، استخدام التخزين المحلي');
    }
});