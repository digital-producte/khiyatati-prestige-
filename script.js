
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed:', error));
    setTimeout(() => {
      if (document.body.classList.contains('auth-loading') && typeof activateOfflineSession === 'function') activateOfflineSession();
    }, 1800);
  });
}
        const defaultGoals = [
            { id: 1, title: 'شراء ماكينة سورجي احترافية (Surjeteuse)', target: 45000, current: 20000 }
        ];
        const defaultCycle = {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
        };

        function readStoredJson(key, fallback) {
            try {
                const storedValue = localStorage.getItem(key);
                return storedValue ? JSON.parse(storedValue) : fallback;
            } catch (error) {
                showAlert(`❌ تعذر قراءة البيانات المحفوظة (${key}). سيتم استخدام البيانات الافتراضية.`);
                return fallback;
            }
        }

        const LOCAL_BACKUP_DB = 'khiyati-local-backup-v1';
        const LOCAL_BACKUP_STORE = 'snapshots';
        function openLocalBackupDb() {
            return new Promise((resolve, reject) => {
                if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
                const request = indexedDB.open(LOCAL_BACKUP_DB, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(LOCAL_BACKUP_STORE, { keyPath: 'uid' });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
            });
        }
        async function saveLocalBackup(uid, data) {
            if (!uid) return false;
            try {
                const db = await openLocalBackupDb();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(LOCAL_BACKUP_STORE, 'readwrite');
                    tx.objectStore(LOCAL_BACKUP_STORE).put({ uid, savedAt: Date.now(), data });
                    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
                });
                db.close();
                return true;
            } catch (error) { console.warn('Local backup failed:', error); return false; }
        }
        async function restoreLocalBackup(uid = activeUid) {
            if (!uid) return false;
            try {
                const db = await openLocalBackupDb();
                const record = await new Promise((resolve, reject) => {
                    const request = db.transaction(LOCAL_BACKUP_STORE, 'readonly').objectStore(LOCAL_BACKUP_STORE).get(uid);
                    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
                });
                db.close();
                if (!record?.data) return false;
                const data = record.data;
                userName = data.userName || userName;
                orders = Array.isArray(data.orders) ? data.orders : orders;
                clients = Array.isArray(data.clients) ? data.clients : clients;
                supplies = Array.isArray(data.supplies) ? data.supplies : supplies;
                inventoryProducts = Array.isArray(data.inventoryProducts) ? data.inventoryProducts : inventoryProducts;
                shoppingItems = Array.isArray(data.shoppingItems) ? data.shoppingItems : shoppingItems;
                workshopLogo = data.workshopLogo || workshopLogo;
                appLanguage = data.appLanguage || appLanguage;
                appCurrency = data.appCurrency || appCurrency;
                goals = Array.isArray(data.goals) ? data.goals : goals;
                expenses = Array.isArray(data.expenses) ? data.expenses : expenses;
                financialArchives = Array.isArray(data.financialArchives) ? data.financialArchives : financialArchives;
                cycle = data.cycle || cycle;
                pricingCalculations = Array.isArray(data.pricingCalculations) ? data.pricingCalculations : pricingCalculations;
                supplyCatalog = Array.isArray(data.supplyCatalog) ? data.supplyCatalog : supplyCatalog;
                purchasedCatalogItems = data.purchasedCatalogItems || purchasedCatalogItems;
                selectedTheme = data.selectedTheme || selectedTheme;
                return true;
            } catch (error) { console.warn('Local backup restore failed:', error); return false; }
        }
        async function clearLocalBackup(uid = activeUid) {
            if (!uid) return;
            try {
                const db = await openLocalBackupDb();
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(LOCAL_BACKUP_STORE, 'readwrite');
                    tx.objectStore(LOCAL_BACKUP_STORE).delete(uid);
                    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
                });
                db.close();
            } catch (error) { console.warn('Local backup cleanup failed:', error); }
        }
        window.restoreIndexedDbBackup = restoreLocalBackup;
        window.clearIndexedDbBackup = clearLocalBackup;

        let userName;
        try {
            userName = localStorage.getItem('momprenuer_user_name') || 'خولة';
        } catch (error) {
            userName = 'خولة';
            showAlert('❌ تعذر قراءة اسم المستخدم المحفوظ.');
        }
        let orders = readStoredJson('momprenuer_orders', []);
        let clients = readStoredJson('momprenuer_clients', []);
        let supplies = readStoredJson('momprenuer_supplies', []);
        let inventoryProducts = readStoredJson('momprenuer_inventory_products', []);
        let shoppingItems = readStoredJson('momprenuer_shopping_items', []);
        let workshopLogo = readStoredJson('momprenuer_workshop_logo', '');
        let sentNotificationKeys = readStoredJson('momprenuer_notification_keys', []);
        let appLanguage = readStoredJson('momprenuer_language', 'ar');
        let appCurrency = readStoredJson('momprenuer_currency', 'DZD');
        if (appCurrency === 'MAD') {
            appCurrency = 'DZD';
            try { localStorage.setItem('momprenuer_currency', JSON.stringify('DZD')); } catch (error) {}
        }
        let goals = readStoredJson('momprenuer_goals', defaultGoals);
        let expenses = readStoredJson('momprenuer_expenses', []);
        let financialArchives = readStoredJson('momprenuer_fin_archives', []);
        let cycle = readStoredJson('momprenuer_cycle', defaultCycle);
        let pricingCalculations = readStoredJson('momprenuer_pricing_calculations', []);
        const defaultSupplyCatalog = [];
        let supplyCatalog = readStoredJson('momprenuer_supply_catalog', defaultSupplyCatalog);
        let purchasedCatalogItems = readStoredJson('momprenuer_supply_purchased', {});
        let selectedTheme = readStoredJson('momprenuer_theme', 'theme-day');
        let firebaseUser = null;
        let activeUid = null;
        const offlineUidKey = 'momprenuer_last_auth_uid';
        const offlineSessionKey = 'momprenuer_offline_session_active';
        const userDataKeys = ['momprenuer_user_name','momprenuer_orders','momprenuer_clients','momprenuer_supplies','momprenuer_inventory_products','momprenuer_shopping_items','momprenuer_workshop_logo','momprenuer_notification_keys','momprenuer_language','momprenuer_currency','momprenuer_goals','momprenuer_expenses','momprenuer_fin_archives','momprenuer_cycle','momprenuer_pricing_calculations','momprenuer_supply_catalog','momprenuer_supply_purchased','momprenuer_theme'];
        function storageKey(key) { return activeUid ? `${key}__${activeUid}` : key; }
        function pendingSyncKey(uid = activeUid) { return uid ? `momprenuer_pending_sync__${uid}` : ''; }
        function markLocalSyncPending() { try { if (activeUid) localStorage.setItem(pendingSyncKey(), '1'); } catch (error) {} }
        function clearLocalSyncPending(uid = activeUid) { try { if (uid) localStorage.removeItem(pendingSyncKey(uid)); } catch (error) {} }
        function hasPendingLocalSync(uid = activeUid) { try { return Boolean(uid && localStorage.getItem(pendingSyncKey(uid)) === '1'); } catch (error) { return false; } }
        window.addEventListener('online', () => { if (activeUid && !firebaseUser) setTimeout(() => location.reload(), 300); });

        function activateOfflineSession() {
            try {
                if (localStorage.getItem(offlineSessionKey) !== '1') return false;
                const uid = localStorage.getItem(offlineUidKey);
                if (!uid) return false;
                prepareUserLocalData(uid);
                firebaseUser = null;
                document.body.classList.remove('auth-loading');
                document.getElementById('auth-screen')?.classList.add('hidden');
                document.getElementById('app-shell')?.classList.remove('hidden');
                restoreLocalBackup(uid).finally(() => { initApp(); firebaseCloudStatus('وضع عدم الاتصال — البيانات محفوظة محليًا'); });
                return true;
            } catch (error) {
                console.warn('Offline session could not be restored:', error);
                return false;
            }
        }
        const automaticSupplyItems = ['قماش قطن أبيض', 'قماش بيج ناعم', 'قماش ستائر شيفون', 'خيط خياطة أسود/أبيض', 'أزرار وزينة مطرزة'];
        const shouldRemoveSupplyItem = item => {
            const name = String(item || '').trim().toLowerCase();
            return automaticSupplyItems.includes(item) || name.includes('قماش بيج') || name.includes('سحاب اسود') || name.includes('سحاب أسود') || name.includes('خمس سحاب');
        };
        supplyCatalog = supplyCatalog.filter(item => !shouldRemoveSupplyItem(item));
        supplies = supplies.filter(item => !shouldRemoveSupplyItem(item.name));
        Object.keys(purchasedCatalogItems).forEach(item => { if (shouldRemoveSupplyItem(item)) delete purchasedCatalogItems[item]; });

        function exportBackupData() {
            try {
                const fullBackup = { userName, orders, clients, supplies, inventoryProducts, shoppingItems, workshopLogo, appLanguage, appCurrency, goals, expenses, financialArchives, cycle, pricingCalculations, supplyCatalog, purchasedCatalogItems, selectedTheme, exportDate: new Date().toISOString() };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `Prestige_Sewing_App_V3_Apparel.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                showAlert('✅ تم تصدير النسخة الاحتياطية بنجاح!');
            } catch (error) {
                showAlert('❌ تعذر تصدير النسخة الاحتياطية.');
            }
        }

        function triggerRestoreInput() { document.getElementById('restore-file-input').click(); }

        function importBackupData(e) {
            try {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const importedData = JSON.parse(event.target.result);
                        if (showConfirm('هل أنتِ متأكدة من استرجاع البيانات؟')) {
                            userName = importedData.userName || userName;
                            orders = importedData.orders || [];
                            clients = importedData.clients || [];
                            supplies = importedData.supplies || [];
                            inventoryProducts = Array.isArray(importedData.inventoryProducts) ? importedData.inventoryProducts : inventoryProducts;
                            shoppingItems = Array.isArray(importedData.shoppingItems) ? importedData.shoppingItems : shoppingItems;
                            workshopLogo = importedData.workshopLogo || workshopLogo;
                            appLanguage = importedData.appLanguage || appLanguage;
                            appCurrency = importedData.appCurrency || appCurrency;
                            goals = importedData.goals || [];
                            expenses = importedData.expenses || [];
                            financialArchives = importedData.financialArchives || [];
                            cycle = importedData.cycle || cycle;
                            pricingCalculations = importedData.pricingCalculations || pricingCalculations;
                            supplyCatalog = importedData.supplyCatalog || supplyCatalog;
                            purchasedCatalogItems = importedData.purchasedCatalogItems || purchasedCatalogItems;
                            selectedTheme = importedData.selectedTheme || selectedTheme;
                            saveData();
                            initApp();
                            showAlert('🎉 تم الاسترجاع بنجاح!');
                        }
                    } catch (error) { showAlert('❌ الملف تالف أو غير صالح، تعذر استيراد البيانات.'); }
                };
                reader.onerror = () => showAlert('❌ تعذر قراءة ملف النسخة الاحتياطية.');
                reader.readAsText(file);
            } catch (error) {
                showAlert('❌ تعذر بدء استيراد النسخة الاحتياطية.');
            }
        }

        function getAppNotifications() {
            const alerts = [];
            const now = new Date(); now.setHours(0, 0, 0, 0);
            orders.filter(order => order.status === 'active' && order.date).forEach(order => {
                const deliveryDate = new Date(`${order.date}T00:00:00`); if (Number.isNaN(deliveryDate.getTime())) return;
                deliveryDate.setHours(0, 0, 0, 0); const days = Math.round((deliveryDate - now) / 86400000);
                if (days < 0) alerts.push({ key: `order-${order.id}-${order.date}`, type: 'order', urgent: true, text: `تأخر موعد تسليم طلبية ${order.item} للزبونة ${order.clientName} منذ ${Math.abs(days)} يوم.` });
                else if (days === 0) alerts.push({ key: `order-${order.id}-${order.date}`, type: 'order', urgent: true, text: `موعد تسليم طلبية ${order.item} للزبونة ${order.clientName} اليوم.` });
                else if (days <= 3) alerts.push({ key: `order-${order.id}-${order.date}`, type: 'order', urgent: false, text: `باقي ${days} ${days === 1 ? 'يوم' : 'أيام'} على تسليم طلبية ${order.item} للزبونة ${order.clientName}.` });
            });
            inventoryProducts.forEach(product => {
                const match = String(product.quantity ?? '').match(/\d+(?:[.,]\d+)?/); const numericQuantity = match ? Number(match[0].replace(',', '.')) : null;
                if (numericQuantity !== null && numericQuantity <= 2) alerts.push({ key: `inventory-${product.id}-${product.quantity}`, type: 'inventory', urgent: numericQuantity === 0, text: `كمية ${product.name} ${numericQuantity === 0 ? 'نفدت' : 'منخفضة'} في الجرد (${product.quantity}).` });
                else if (/نفد|منخفض|قليل|خلص/i.test(String(product.quantity))) alerts.push({ key: `inventory-${product.id}-${product.quantity}`, type: 'inventory', urgent: true, text: `راجعي كمية ${product.name} في الجرد.` });
            });
            return alerts;
        }

        function renderNotifications() {
            const alerts = getAppNotifications();
            const html = alerts.length ? alerts.map(alert => `<div class="app-notification ${alert.urgent ? 'urgent' : ''}"><span>${alert.type === 'order' ? '📅' : '📦'}</span><span>${alert.text}</span></div>`).join('') : '<p class="text-[10px] text-amber-700">لا توجد تنبيهات حالياً.</p>';
            const main = document.getElementById('notifications-container'); if (main) main.innerHTML = html;
            const inventory = document.getElementById('inventory-alerts-container'); if (inventory) inventory.innerHTML = html;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                alerts.forEach(alert => {
                    if (sentNotificationKeys.includes(alert.key)) return;
                    sendSystemNotification(alert);
                    sentNotificationKeys.push(alert.key);
                });
                try { localStorage.setItem(storageKey('momprenuer_notification_keys'), JSON.stringify(sentNotificationKeys.slice(-100))); } catch (error) {}
            }
            if (window.lucide) lucide.createIcons();
        }

        async function requestNotificationPermission() {
            if (typeof Notification === 'undefined') return showAlert('هذا المتصفح لا يدعم إشعارات الهاتف.');
            try { const permission = await Notification.requestPermission(); if (permission === 'granted') { showAlert('✅ تم تفعيل إشعارات الهاتف. ستظهر مع بقية إشعارات التطبيقات.'); renderNotifications(); } else showAlert('لم يتم تفعيل الإشعارات. يمكنك السماح بها من إعدادات الهاتف.'); }
            catch (error) { showAlert('تعذر تفعيل الإشعارات في هذا المتصفح.'); }
        }

        async function sendSystemNotification(alertData) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification('خياطتي', {
                    body: alertData.text,
                    icon: workshopLogo || './prestige-digital.jpg',
                    badge: './icon.png',
                    tag: alertData.key,
                    renotify: true,
                    vibrate: [250, 100, 250],
                    requireInteraction: Boolean(alertData.urgent),
                    data: { url: './index.html' }
                });
            } catch (error) {
                console.warn('تعذر إرسال إشعار النظام:', error);
            }
        }

        const currencySymbols = { DZD: 'دج', USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س' };
        const commonTranslations = {
            en: {'الطلبيات':'Orders','طلبية':'Order','الزبونة':'Client','الزبونات':'Clients','المنتج':'Product','السلعة':'Item','الأقمشة':'Fabrics','الأهداف':'Goals','الميزانية':'Budget','المصاريف':'Expenses','الأرباح':'Profits','المبلغ':'Amount','المجموع':'Total','إجمالي':'Total','إضافة':'Add','حفظ':'Save','تعديل':'Edit','حذف':'Delete','ملاحظات':'Notes','صورة':'Image','الهاتف':'Phone','الولاية':'State','الاسم':'Name','نوع':'Type','قيمة':'Value','تاريخ':'Date','اليوم':'today','أيام':'days','يوم':'day','منذ':'ago','المستخدم':'User','الورشة':'Workshop','التطبيق':'App','اختاري':'Choose','يرجى':'Please','مثال':'Example','غير محدد':'Not specified','بدون هاتف':'No phone','غير محددة':'Not specified','قيد العمل':'In progress','تم التسليم':'Delivered','تنظيم':'Management','المتبقي':'Remaining'},
            fr: {'الطلبيات':'Commandes','طلبية':'Commande','الزبونة':'Cliente','الزبونات':'Clientes','المنتج':'Produit','السلعة':'Article','الأقمشة':'Tissus','الأهداف':'Objectifs','الميزانية':'Budget','المصاريف':'Dépenses','الأرباح':'Bénéfices','المبلغ':'Montant','المجموع':'Total','إجمالي':'Total','إضافة':'Ajouter','حفظ':'Enregistrer','تعديل':'Modifier','حذف':'Supprimer','ملاحظات':'Notes','صورة':'Image','الهاتف':'Téléphone','الولاية':'Wilaya','الاسم':'Nom','نوع':'Type','قيمة':'Valeur','تاريخ':'Date','اليوم':'aujourd’hui','أيام':'jours','يوم':'jour','منذ':'il y a','المستخدم':'Utilisateur','الورشة':'Atelier','التطبيق':'Application','اختاري':'Choisissez','يرجى':'Veuillez','مثال':'Exemple','غير محدد':'Non spécifié','بدون هاتف':'Sans téléphone','غير محددة':'Non spécifiée','قيد العمل':'En cours','تم التسليم':'Livrée','تنظيم':'Gestion','المتبقي':'Reste'}
        };

        const extraTranslations = {
            en: {'دفتر الأم المنتجة - التطبيق الذكي المطور':'Sewing Workshop - Smart App','مرحبًا بعودتِك':'Welcome back','سجّلي الدخول لإدارة طلبياتك وبياناتك بأمان من أي جهاز':'Sign in to manage your orders and data securely from any device','المتابعة عبر Google':'Continue with Google','نسيتِ كلمة المرور؟':'Forgot your password?','تسجيل الدخول':'Sign in','ليس لديكِ حساب؟':'Don’t have an account?','أنشئي واحدًا':'Create one','اختاري مجال الطلبية:':'Choose order type:','خياطة الأفرشة':'Bedding sewing','خياطة الألبسة':'Clothing sewing','اختاري زبونة مسجلة أو أدخلي جديدة:':'Choose a saved client or add a new one:','اسم الزبونة':'Client name','رقم الهاتف':'Phone number','الولاية':'State','نوع المنتج':'Product type','سعر البيع الإجمالي':'Total sale price','صورة القماش المستعمل':'Fabric photo','صورة المودال':'Model photo','تغيير':'Change','حذف الصورة':'Delete image','ملاحظات القياسات العامة أو الأفرشة:':'General measurements or bedding notes:','قياسات مجال الألبسة والتفصيل':'Clothing measurements','القياسات بالسنتيمتر (سم)':'Measurements in centimeters (cm)','الطول الكلي':'Total length','طول الرقبة':'Neck length','عرض الكتفين':'Shoulder width','طول بين النهدين':'Bust distance','محيط الصدر':'Chest circumference','محيط تحت الصدر':'Underbust circumference','محيط الخصر':'Waist circumference','محيط الورك':'Hip circumference','طول الذراع':'Arm length','دوران المعصم':'Wrist circumference','إضافة قياس آخر إضافي:':'Additional measurement:','العربون المدفوع':'Paid deposit','ملاحظات إضافية:':'Additional notes:','أرشيف الطلبيات المسلمة':'Delivered orders archive','إضافة زبونة جديدة':'Add new client','حفظ الزبونة في القائمة':'Save client','قائمة الزبونات المسجلات':'Saved clients','الزبونة الوفية الأكثر طلباً':'Top client','تنبيهات الجرد':'Inventory alerts','صورة المنتج':'Product image','حاسبة المصاريف الإضافية':'Additional expenses calculator','التوصيل أو التنقل':'Delivery or transport','التغليف والأكياس':'Packaging and bags','الكهرباء واللوازم':'Electricity and supplies','مصروف آخر':'Other expense','مجموع المصاريف الإضافية:':'Additional expenses total:','حاسبة حق التعب':'Labor cost calculator','مدة القص والتحضير':'Cutting and preparation time','مدة الخياطة':'Sewing time','مدة التشطيب والكي':'Finishing and ironing time','قيمة ساعة العمل':'Hourly work rate','مجموع الوقت:':'Total time:','مجموع حق التعب:':'Total labor cost:','إجمالي التكلفة':'Total cost','الربح الصافي':'Net profit','سعر البيع المقترح':'Recommended sale price','حفظ نتيجة التسعير':'Save pricing result','إدارة تكاليف المشروع والأرباح الشهرية':'Project costs and monthly profits','ضبط الشهر المالي الحالي':'Current financial month','تاريخ بداية الشهر المالي':'Financial month start date','تاريخ نهاية الشهر المالي':'Financial month end date','إضافة للمصاريف':'Add to expenses','حسابات الشهر المالي الحالي':'Current month accounts','إجمالي الطلبيات المحصلة:':'Total collected orders:','إجمالي التكاليف والمصاريف:':'Total costs and expenses:','الربح الصافي الفعلي لهذا الشهر:':'Actual net profit this month:','قائمة تكاليف ومصاريف هذا الشهر:':'This month’s costs and expenses:','الأهداف ورأس المال':'Goals and capital','إضافة هدف':'Add goal','إعدادات التطبيق':'App settings'},
            fr: {'دفتر الأم المنتجة - التطبيق الذكي المطور':'Atelier de couture - Application intelligente','مرحبًا بعودتِك':'Bon retour','سجّلي الدخول لإدارة طلبياتك وبياناتك بأمان من أي جهاز':'Connectez-vous pour gérer vos commandes en toute sécurité','المتابعة عبر Google':'Continuer avec Google','نسيتِ كلمة المرور؟':'Mot de passe oublié ?','تسجيل الدخول':'Se connecter','ليس لديكِ حساب؟':'Vous n’avez pas de compte ?','أنشئي واحدًا':'Créer un compte','اختاري مجال الطلبية:':'Choisissez le type de commande :','خياطة الأفرشة':'Couture de literie','خياطة الألبسة':'Couture de vêtements','اختاري زبونة مسجلة أو أدخلي جديدة:':'Choisissez une cliente ou ajoutez-en une :','اسم الزبونة':'Nom de la cliente','رقم الهاتف':'Téléphone','نوع المنتج':'Type de produit','سعر البيع الإجمالي':'Prix de vente total','صورة القماش المستعمل':'Photo du tissu','صورة المودال':'Photo du modèle','تغيير':'Changer','حذف الصورة':'Supprimer l’image','ملاحظات القياسات العامة أو الأفرشة:':'Notes générales ou literie :','قياسات مجال الألبسة والتفصيل':'Mesures des vêtements','القياسات بالسنتيمتر (سم)':'Mesures en centimètres (cm)','الطول الكلي':'Longueur totale','طول الرقبة':'Longueur du cou','عرض الكتفين':'Largeur des épaules','محيط الصدر':'Tour de poitrine','محيط تحت الصدر':'Sous-poitrine','محيط الخصر':'Tour de taille','محيط الورك':'Tour des hanches','طول الذراع':'Longueur du bras','دوران المعصم':'Tour du poignet','إضافة قياس آخر إضافي:':'Mesure supplémentaire :','العربون المدفوع':'Acompte payé','ملاحظات إضافية:':'Notes supplémentaires :','أرشيف الطلبيات المسلمة':'Archives des commandes livrées','إضافة زبونة جديدة':'Ajouter une cliente','حفظ الزبونة في القائمة':'Enregistrer la cliente','قائمة الزبونات المسجلات':'Liste des clientes','الزبونة الوفية الأكثر طلباً':'Cliente fidèle','تنبيهات الجرد':'Alertes d’inventaire','صورة المنتج':'Image du produit','حاسبة المصاريف الإضافية':'Calcul des dépenses supplémentaires','التوصيل أو التنقل':'Livraison ou transport','التغليف والأكياس':'Emballage et sacs','الكهرباء واللوازم':'Électricité et fournitures','مصروف آخر':'Autre dépense','مجموع المصاريف الإضافية:':'Total des dépenses supplémentaires :','حاسبة حق التعب':'Calcul de la main-d’œuvre','مدة القص والتحضير':'Temps de coupe et préparation','مدة الخياطة':'Temps de couture','مدة التشطيب والكي':'Temps de finition et repassage','قيمة ساعة العمل':'Tarif horaire','مجموع الوقت:':'Temps total :','مجموع حق التعب:':'Total main-d’œuvre :','إجمالي التكلفة':'Coût total','الربح الصافي':'Bénéfice net','سعر البيع المقترح':'Prix de vente conseillé','حفظ نتيجة التسعير':'Enregistrer le calcul','هنا تلقاي جميع Orders التي مازال العمل عليها مستمر.':'Toutes les commandes en cours apparaissent ici.','Orders التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.':'Les commandes livrées apparaissent ici comme référence.','Pricing calculator بنسبة الربح':'Calcul du prix avec marge','اكتبي Value كل مصروف خاص بهذه الOrder. إذا لم يوجد، اتركي الخانة فارغة.':'Saisissez le montant de chaque dépense. Laissez vide s’il n’y en a pas.','اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي Value hours عملك. Example: 90 minutes.':'Saisissez la durée de chaque étape et votre tarif horaire. Exemple : 90 minutes.','Total Expenses الإضافية وحق التعب (دج):':'Total des dépenses supplémentaires et de la main-d’œuvre (DZD) :','اSaveي بياناتك أو انقليها لهاتف آخر':'Enregistrez vos données ou transférez-les vers un autre téléphone','Enable phone notifications بالصوت':'Activer les notifications avec son','Choose Day mode أو الليلي، وسيبقى اختيارك محفوظًا.':'Choisissez le mode jour ou nuit. Votre choix sera enregistré.','Change الImage 1':'Changer l’image 1','Change الImage 2':'Changer l’image 2','Edit تفاصيل الOrder والقياسات':'Modifier les détails de la commande et les mesures','📏 Clothing measurements (للEdit):':'📏 Mesures des vêtements (modification)','Edit ملف Client وقياساتها':'Modifier le profil et les mesures de la cliente','📏 قياسات جسم Client (الألبسة والتفصيل):':'📏 Mesures de la cliente (vêtements et couture)','Edit الهدف':'Modifier l’objectif','Save الEditات':'Enregistrer les modifications','Choose «Add للمخزون» لAdd 5 قطع، أو اDeleteي Item من القائمة نهائيًا.':'Choisissez « Ajouter au stock » pour ajouter 5 pièces ou supprimer définitivement un article.','Add item جديدة للقائمة':'Ajouter un article à la liste','Add قماش للمخزون':'Ajouter du tissu au stock','Add للمخزون':'Ajouter au stock','Add goal أو آلة جديدة':'Ajouter un objectif ou une machine','Save الهدف':'Enregistrer l’objectif','دج':'DZD','Enable phone notifications بالصوت':'Enable phone notifications with sound','Change الImage 1':'Change image 1','Change الImage 2':'Change image 2','Change Image Item':'Change item image','إدارة تكاليف المشروع والأرباح الشهرية':'Coûts du projet et bénéfices mensuels','ضبط الشهر المالي الحالي':'Mois financier actuel','تاريخ بداية الشهر المالي':'Début du mois financier','تاريخ نهاية الشهر المالي':'Fin du mois financier','إضافة للمصاريف':'Ajouter aux dépenses','حسابات الشهر المالي الحالي':'Comptes du mois actuel','إجمالي الطلبيات المحصلة:':'Total des commandes encaissées :','إجمالي التكاليف والمصاريف:':'Total des coûts et dépenses :','الربح الصافي الفعلي لهذا الشهر:':'Bénéfice net réel du mois :','قائمة تكاليف ومصاريف هذا الشهر:':'Coûts et dépenses du mois :','الأهداف ورأس المال':'Objectifs et capital','إضافة هدف':'Ajouter un objectif','إعدادات التطبيق':'Paramètres de l’application'}
        };

        const gapTranslations = {
            en: {
                'أفرشة أو ألبسة':'Bedding or clothing','Clients المسجلات':'Saved clients','الزبونات المسجلات':'Saved clients','إدارة الورشة':'Workshop management','-- زبونة مسجلة --':'-- Saved client --','طول قصة الصدر':'Chest length','ارتفاع الورك':'Hip height','عرض الزندة':'Bicep width','هنا تلقاي جميع Orders التي مازال العمل عليها مستمر.':'All orders currently in progress appear here.','Orders التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.':'Delivered orders appear here as a reference.','أرشيف':'Archive','تسعير مقترح':'Suggested pricing','سعر التكلفة الإجمالية للسلع والمواد (دج):':'Total cost of goods and materials (DZD):','اكتبي Value كل مصروف خاص بهذه الOrder. إذا لم يوجد، اتركي الخانة فارغة.':'Enter the value of each expense for this order. Leave it empty if none.','Total Expenses الإضافية وحق التعب (دج):':'Total additional expenses and labor cost (DZD):','نسبة الربح المطلوبة (%):':'Required profit margin (%):','➕ تسجيل تكاليف ومصاريف جديدة (أقمشة، خيوط، إكسسوارات...)':'➕ Add new costs and expenses (fabrics, threads, accessories...)','📁 إغلاق وأرشفة هذا الشهر المالي':'📁 Close and archive this financial month','🗄️ أرشيف الشهور والنتائج المالية السابقة':'🗄️ Previous months and financial results archive','النسخ الاحتياطي':'Backup','اSaveي بياناتك أو انقليها لهاتف آخر':'Save your data or transfer it to another phone','تصدير البيانات':'Export data','استيراد البيانات':'Import data','Enable phone notifications بالصوت':'Enable phone notifications with sound','Choose Day mode أو الليلي، وسيبقى اختيارك محفوظًا.':'Choose Day or Night mode. Your choice will be saved.','Change الImage 1':'Change Image 1','Change الImage 2':'Change Image 2','Edit تفاصيل الOrder والقياسات':'Edit order details and measurements','📏 Clothing measurements (للEdit):':'📏 Clothing measurements (for editing):','قياس إضافي آخر:':'Additional measurement:','تفاصيل الشهر المؤرشف':'Archived month details','إغلاق':'Close','Edit ملف Client وقياساتها':'Edit client profile and measurements','📏 قياسات جسم Client (الألبسة والتفصيل):':'📏 Client body measurements (clothing and tailoring):','تحديث المعلومات والقياسات':'Update information and measurements','Edit الهدف':'Edit goal','Save الEditات':'Save edits','قائمة السلع والمشتريات':'Shopping items and purchases','Add item جديدة للقائمة':'Add a new item to the list','Add قماش للمخزون':'Add fabric to inventory','متر':'meter','بكرة':'spool','قطعة':'piece','Add للمخزون':'Add to inventory','Add goal أو آلة جديدة':'Add a goal or machine','Save الهدف':'Save goal','دقيقة':'minutes','ساعة':'hours','اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي Value ساعة عملك. Example: 90 دقيقة.':'Enter the duration of each stage in minutes, then enter your hourly rate. Example: 90 minutes.','قيمة ساعة العمل (دج)':'Hourly work rate (DZD)','سعر البيع المقترح':'Recommended sale price','حفظ نتيجة التسعير':'Save pricing result','تسعير مقترح':'Suggested pricing','هنا تلقاي جميع Orders التي مازال العمل عليها مستمر.':'All orders currently in progress appear here.','Orders التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.':'Delivered orders appear here as a reference.','Pricing calculator بنسبة الربح':'Pricing calculator with profit margin','اكتبي Value كل مصروف خاص بهذه الOrder. إذا لم يوجد، اتركي الخانة فارغة.':'Enter the value of each expense for this order. Leave it empty if none.','اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي Value hours عملك. Example: 90 minutes.':'Enter the duration of each stage in minutes, then enter your hourly rate. Example: 90 minutes.','Total Expenses الإضافية وحق التعب (دج):':'Total additional expenses and labor cost (DZD):','اSaveي بياناتك أو انقليها لهاتف آخر':'Save your data or transfer it to another phone','Enable phone notifications بالصوت':'Enable phone notifications with sound','Choose Day mode أو الليلي، وسيبقى اختيارك محفوظًا.':'Choose Day or Night mode. Your choice will be saved.','Change الImage 1':'Change Image 1','Change الImage 2':'Change Image 2','Edit تفاصيل الOrder والقياسات':'Edit order details and measurements','📏 Clothing measurements (للEdit):':'📏 Clothing measurements (for editing):','Edit ملف Client وقياساتها':'Edit client profile and measurements','📏 قياسات جسم Client (الألبسة والتفصيل):':'📏 Client body measurements (clothing and tailoring):','Edit الهدف':'Edit goal','Save الEditات':'Save edits','Choose «Add للمخزون» لAdd 5 قطع، أو اDeleteي Item من القائمة نهائيًا.':'Choose “Add to inventory” to add 5 pieces, or delete an item from the list permanently.','Add item جديدة للقائمة':'Add a new item to the list','Add قماش للمخزون':'Add fabric to inventory','Add للمخزون':'Add to inventory','Add goal أو آلة جديدة':'Add a goal or machine','Save الهدف':'Save goal','دج':'DZD','Enable phone notifications بالصوت':'Enable phone notifications with sound','Change الImage 1':'Change image 1','Change الImage 2':'Change image 2','Change Image Item':'Change item image'
            },
            fr: {
                'أفرشة أو ألبسة':'Literie ou vêtements','Clients المسجلات':'Clientes enregistrées','الزبونات المسجلات':'Clientes enregistrées','إدارة الورشة':'Gestion de l’atelier','-- زبونة مسجلة --':'-- Cliente enregistrée --','طول قصة الصدر':'Longueur de poitrine','ارتفاع الورك':'Hauteur des hanches','عرض الزندة':'Largeur du biceps','هنا تلقاي جميع Orders التي مازال العمل عليها مستمر.':'Toutes les commandes en cours apparaissent ici.','Orders التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.':'Les commandes livrées apparaissent ici comme référence.','أرشيف':'Archives','تسعير مقترح':'Prix conseillé','سعر التكلفة الإجمالية للسلع والمواد (دج):':'Coût total des biens et matériaux (DZD) :','اكتبي Value كل مصروف خاص بهذه الOrder. إذا لم يوجد، اتركي الخانة فارغة.':'Saisissez le montant de chaque dépense. Laissez vide s’il n’y en a pas.','Total Expenses الإضافية وحق التعب (دج):':'Total des dépenses supplémentaires et de la main-d’œuvre (DZD) :','نسبة الربح المطلوبة (%):':'Marge bénéficiaire souhaitée (%) :','➕ تسجيل تكاليف ومصاريف جديدة (أقمشة، خيوط، إكسسوارات...)':'➕ Ajouter des coûts et dépenses (tissus, fils, accessoires...)','📁 إغلاق وأرشفة هذا الشهر المالي':'📁 Clôturer et archiver ce mois financier','🗄️ أرشيف الشهور والنتائج المالية السابقة':'🗄️ Archives des mois et résultats financiers précédents','النسخ الاحتياطي':'Sauvegarde','اSaveي بياناتك أو انقليها لهاتف آخر':'Enregistrez vos données ou transférez-les vers un autre téléphone','تصدير البيانات':'Exporter les données','استيراد البيانات':'Importer les données','Enable phone notifications بالصوت':'Activer les notifications avec son','Choose Day mode أو الليلي، وسيبقى اختيارك محفوظًا.':'Choisissez le mode jour ou nuit. Votre choix sera enregistré.','Change الImage 1':'Changer l’image 1','Change الImage 2':'Changer l’image 2','Edit تفاصيل الOrder والقياسات':'Modifier les détails de la commande et les mesures','📏 Clothing measurements (للEdit):':'📏 Mesures des vêtements (modification) :','قياس إضافي آخر:':'Mesure supplémentaire :','تفاصيل الشهر المؤرشف':'Détails du mois archivé','إغلاق':'Fermer','Edit ملف Client وقياساتها':'Modifier le profil et les mesures de la cliente','📏 قياسات جسم Client (الألبسة والتفصيل):':'📏 Mesures de la cliente (vêtements et couture) :','تحديث المعلومات والقياسات':'Mettre à jour les informations et les mesures','Edit الهدف':'Modifier l’objectif','Save الEditات':'Enregistrer les modifications','قائمة السلع والمشتريات':'Articles et achats','Add item جديدة للقائمة':'Ajouter un article à la liste','Add قماش للمخزون':'Ajouter du tissu au stock','متر':'mètre','بكرة':'bobine','قطعة':'pièce','Add للمخزون':'Ajouter au stock','Add goal أو آلة جديدة':'Ajouter un objectif ou une machine','Save الهدف':'Enregistrer l’objectif','دقيقة':'minutes','ساعة':'heures','اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي Value ساعة عملك. Example: 90 دقيقة.':'Saisissez la durée de chaque étape en minutes et votre tarif horaire. Exemple : 90 minutes.','قيمة ساعة العمل (دج)':'Tarif horaire (DZD)','سعر البيع المقترح':'Prix de vente conseillé','حفظ نتيجة التسعير':'Enregistrer le calcul'
            }
        };

        const fullTranslations = {"en":{"أفرشة أو ألبسة":"Bedding or clothing","الطلبيات المسجلة":"Registered orders","الطلبيات المسلمة":"Delivered orders","الزبونات المسجلات":"Saved clients","التسعير والربح":"Pricing & profit","تكاليف المشروع":"Project costs","المصاريف الشهرية":"Monthly expenses","الطلبيات":"Orders","الزبونات":"Clients","الأقمشة":"Fabrics","الميزانية":"Budget","إدارة الورشة":"Workshop management","اختاري مجال الطلبية:":"Choose order type:","خياطة الأفرشة":"Bedding sewing","خياطة الألبسة":"Clothing sewing","اختاري زبونة مسجلة أو أدخلي جديدة:":"Choose a saved client or add a new one:","-- زبونة مسجلة --":"-- Saved client --","ملاحظات القياسات العامة أو الأفرشة:":"General measurements or bedding notes:","قياسات مجال الألبسة والتفصيل":"Clothing measurements","القياسات بالسنتيمتر (سم)":"Measurements in centimeters (cm)","الطول الكلي":"Total length","طول الرقبة":"Neck length","عرض الكتفين":"Shoulder width","طول قصة الصدر":"Chest length","محيط الورك":"Hip circumference","ارتفاع الورك":"Hip height","طول الذراع":"Arm length","عرض الزندة":"Bicep width","دوران المعصم":"Wrist circumference","إضافة قياس آخر إضافي:":"Additional measurement:","ملاحظات إضافية:":"Additional notes:","حفظ الطلبية في الورشة":"Save order","0 طلبية":"0 orders","هنا تلقاي جميع الطلبيات التي مازال العمل عليها مستمر.":"All orders currently in progress appear here.","0 أرشيف":"0 archived","الطلبيات التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.":"Delivered orders appear here as a reference.","إضافة زبونة جديدة":"Add new client","حفظ الزبونة في القائمة":"Save client","الزبونة الوفية الأكثر طلباً (VIP)":"Top client (VIP)","قائمة الزبونات المسجلات":"Saved clients","تنبيهات الجرد":"Inventory alerts","تنظيم المنتجات":"Product management","إضافة المنتج إلى الجرد":"Add product to inventory","قائمة السلع واللوازم":"Shopping list","حاسبة التسعير بنسبة الربح":"Pricing calculator with profit margin","تسعير مقترح":"Suggested pricing","سعر التكلفة الإجمالية للسلع والمواد (دج):":"Total cost of goods and materials (DZD):","🧾 حاسبة المصاريف الإضافية":"🧾 Additional expenses calculator","اكتبي قيمة كل مصروف خاص بهذه الطلبية. إذا لم يوجد، اتركي الخانة فارغة.":"Enter the value of each expense for this order. Leave it empty if none.","مجموع المصاريف الإضافية:":"Additional expenses total:","⏱️ حاسبة حق التعب":"⏱️ Labor cost calculator","اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي قيمة ساعة عملك. مثال: 90 دقيقة.":"Enter each stage duration in minutes, then your hourly rate. Example: 90 minutes.","مدة القص والتحضير (دقيقة)":"Cutting and preparation time (minutes)","مدة الخياطة":"Sewing time","مدة التشطيب والكي (دقيقة)":"Finishing and ironing time (minutes)","قيمة ساعة العمل (دج)":"Hourly work rate (DZD)","مجموع الوقت:":"Total time:","0 دقيقة":"0 minutes","مجموع حق التعب:":"Total labor cost:","إجمالي المصاريف الإضافية وحق التعب (دج):":"Total additional expenses and labor cost (DZD):","نسبة الربح المطلوبة (%):":"Required profit margin (%):","إجمالي التكلفة":"Total cost","الربح الصافي":"Net profit","حفظ نتيجة التسعير":"Save pricing result","إدارة تكاليف المشروع والأرباح الشهرية":"Project costs and monthly profits","⚙️ ضبط الشهر المالي الحالي":"⚙️ Current financial month","إضافة للمصاريف ✓":"Add to expenses ✓","📊 حسابات الشهر المالي الحالي":"📊 Current month accounts","إجمالي الطلبيات المحصلة:":"Total collected orders:","إجمالي التكاليف والمصاريف:":"Total costs and expenses:","الربح الصافي الفعلي لهذا الشهر:":"Actual net profit this month:","قائمة تكاليف ومصاريف هذا الشهر:":"This month’s costs and expenses:","الأهداف ورأس المال":"Goals and capital","إضافة هدف":"Add goal","إعدادات التطبيق":"App settings","النسخ الاحتياطي":"Backup","احفظي بياناتك أو انقليها لهاتف آخر":"Save your data or transfer it to another phone","تصدير البيانات":"Export data","استيراد البيانات":"Import data","اسم صاحبة التطبيق":"Owner name","حفظ الاسم":"Save name","تسجيل الخروج":"Sign out","اختيار وضع التطبيق":"App appearance","اختاري الوضع النهاري أو الليلي، وسيبقى اختيارك محفوظًا.":"Choose Day or Night mode. Your choice will be saved.","الوضع النهاري":"Day mode","الوضع الليلي":"Night mode","تعديل تفاصيل الطلبية والقياسات":"Edit order details and measurements","📏 قياسات مجال الألبسة والتفصيل (للتعديل):":"📏 Clothing measurements (for editing):","تفاصيل الشهر المؤرشف":"Archived month details","إغلاق":"Close","تعديل ملف الزبونة وقياساتها":"Edit client profile and measurements","📏 قياسات جسم الزبونة (الألبسة والتفصيل):":"📏 Client body measurements (clothing and tailoring):","تحديث المعلومات والقياسات":"Update information and measurements","تعديل الهدف":"Edit goal","حفظ التعديلات":"Save edits","قائمة السلع والمشتريات":"Shopping items and purchases","اختاري «إضافة للمخزون» لإضافة 5 قطع، أو احذفي السلعة من القائمة نهائيًا.":"Choose “Add to inventory” to add 5 pieces, or delete an item permanently.","إضافة سلعة جديدة للقائمة":"Add a new item to the list","إضافة قماش للمخزون":"Add fabric to inventory","إضافة":"Add","متر":"meter","بكرة":"spool","قطعة":"piece","إضافة للمخزون":"Add to inventory","إضافة هدف أو آلة جديدة":"Add a goal or machine","حفظ الهدف":"Save goal"},"fr":{"أفرشة أو ألبسة":"Literie ou vêtements","الطلبيات المسجلة":"Commandes enregistrées","الطلبيات المسلمة":"Commandes livrées","الزبونات المسجلات":"Clientes enregistrées","التسعير والربح":"Prix et bénéfice","تكاليف المشروع":"Coûts du projet","المصاريف الشهرية":"Dépenses mensuelles","الطلبيات":"Commandes","الزبونات":"Clientes","الأقمشة":"Tissus","الميزانية":"Budget","إدارة الورشة":"Gestion de l’atelier","اختاري مجال الطلبية:":"Choisissez le type de commande :","خياطة الأفرشة":"Couture de literie","خياطة الألبسة":"Couture de vêtements","اختاري زبونة مسجلة أو أدخلي جديدة:":"Choisissez une cliente ou ajoutez-en une :","-- زبونة مسجلة --":"-- Cliente enregistrée --","ملاحظات القياسات العامة أو الأفرشة:":"Notes générales ou literie :","قياسات مجال الألبسة والتفصيل":"Mesures des vêtements","القياسات بالسنتيمتر (سم)":"Mesures en centimètres (cm)","الطول الكلي":"Longueur totale","طول الرقبة":"Longueur du cou","طول بين النهدين":"Distance entre les seins","عرض الكتفين":"Largeur des épaules","طول قصة الصدر":"Longueur de poitrine","محيط الورك":"Tour des hanches","ارتفاع الورك":"Hauteur des hanches","طول الذراع":"Longueur du bras","عرض الزندة":"Largeur du biceps","دوران المعصم":"Tour du poignet","إضافة قياس آخر إضافي:":"Mesure supplémentaire :","ملاحظات إضافية:":"Notes supplémentaires :","حفظ الطلبية في الورشة":"Enregistrer la commande","0 طلبية":"0 commande","هنا تلقاي جميع الطلبيات التي مازال العمل عليها مستمر.":"Toutes les commandes en cours apparaissent ici.","0 أرشيف":"0 archive","الطلبيات التي تم تسليمها للزبونات تظهر هنا لتبقى مرجعاً لأرباحك.":"Les commandes livrées apparaissent ici comme référence.","إضافة زبونة جديدة":"Ajouter une cliente","حفظ الزبونة في القائمة":"Enregistrer la cliente","الزبونة الوفية الأكثر طلباً (VIP)":"Cliente fidèle (VIP)","قائمة الزبونات المسجلات":"Clientes enregistrées","تنبيهات الجرد":"Alertes d’inventaire","تنظيم المنتجات":"Gestion des produits","إضافة المنتج إلى الجرد":"Ajouter au stock","قائمة السلع واللوازم":"Liste d’achats","حاسبة التسعير بنسبة الربح":"Calcul du prix avec marge","تسعير مقترح":"Prix conseillé","سعر التكلفة الإجمالية للسلع والمواد (دج):":"Coût total des biens et matériaux (DZD) :","🧾 حاسبة المصاريف الإضافية":"🧾 Calcul des dépenses supplémentaires","اكتبي قيمة كل مصروف خاص بهذه الطلبية. إذا لم يوجد، اتركي الخانة فارغة.":"Saisissez le montant de chaque dépense. Laissez vide s’il n’y en a pas.","مجموع المصاريف الإضافية:":"Total des dépenses supplémentaires :","⏱️ حاسبة حق التعب":"⏱️ Calcul de la main-d’œuvre","اكتبي مدة كل مرحلة بالدقائق، ثم اكتبي قيمة ساعة عملك. مثال: 90 دقيقة.":"Saisissez la durée de chaque étape et votre tarif horaire. Exemple : 90 minutes.","مدة القص والتحضير (دقيقة)":"Temps de coupe et préparation (minutes)","مدة الخياطة":"Temps de couture","مدة التشطيب والكي (دقيقة)":"Temps de finition et repassage (minutes)","قيمة ساعة العمل (دج)":"Tarif horaire (DZD)","مجموع الوقت:":"Temps total :","0 دقيقة":"0 minute","مجموع حق التعب:":"Total main-d’œuvre :","إجمالي المصاريف الإضافية وحق التعب (دج):":"Total des dépenses supplémentaires et de la main-d’œuvre (DZD) :","نسبة الربح المطلوبة (%):":"Marge bénéficiaire souhaitée (%) :","إجمالي التكلفة":"Coût total","الربح الصافي":"Bénéfice net","حفظ نتيجة التسعير":"Enregistrer le calcul","إدارة تكاليف المشروع والأرباح الشهرية":"Coûts du projet et bénéfices mensuels","⚙️ ضبط الشهر المالي الحالي":"⚙️ Mois financier actuel","إضافة للمصاريف ✓":"Ajouter aux dépenses ✓","📊 حسابات الشهر المالي الحالي":"📊 Comptes du mois actuel","إجمالي الطلبيات المحصلة:":"Total des commandes encaissées :","إجمالي التكاليف والمصاريف:":"Total des coûts et dépenses :","الربح الصافي الفعلي لهذا الشهر:":"Bénéfice net réel du mois :","قائمة تكاليف ومصاريف هذا الشهر:":"Coûts et dépenses du mois :","الأهداف ورأس المال":"Objectifs et capital","إضافة هدف":"Ajouter un objectif","إعدادات التطبيق":"Paramètres de l’application","النسخ الاحتياطي":"Sauvegarde","احفظي بياناتك أو انقليها لهاتف آخر":"Enregistrez vos données ou transférez-les vers un autre téléphone","تصدير البيانات":"Exporter les données","استيراد البيانات":"Importer les données","اسم صاحبة التطبيق":"Nom de la propriétaire","حفظ الاسم":"Enregistrer le nom","تسجيل الخروج":"Déconnexion","اختيار وضع التطبيق":"Apparence","اختاري الوضع النهاري أو الليلي، وسيبقى اختيارك محفوظًا.":"Choisissez le mode jour ou nuit. Votre choix sera enregistré.","الوضع النهاري":"Mode jour","الوضع الليلي":"Mode nuit","تعديل تفاصيل الطلبية والقياسات":"Modifier les détails de la commande et les mesures","📏 قياسات مجال الألبسة والتفصيل (للتعديل):":"📏 Mesures des vêtements (modification) :","تفاصيل الشهر المؤرشف":"Détails du mois archivé","إغلاق":"Fermer","تعديل ملف الزبونة وقياساتها":"Modifier le profil et les mesures de la cliente","📏 قياسات جسم الزبونة (الألبسة والتفصيل):":"📏 Mesures de la cliente (vêtements et couture) :","تحديث المعلومات والقياسات":"Mettre à jour les informations et les mesures","تعديل الهدف":"Modifier l’objectif","حفظ التعديلات":"Enregistrer les modifications","قائمة السلع والمشتريات":"Articles et achats","اختاري «إضافة للمخزون» لإضافة 5 قطع، أو احذفي السلعة من القائمة نهائيًا.":"Choisissez « Ajouter au stock » pour ajouter 5 pièces ou supprimer définitivement un article.","إضافة سلعة جديدة للقائمة":"Ajouter un article à la liste","إضافة قماش للمخزون":"Ajouter du tissu au stock","إضافة":"Ajouter","متر":"mètre","بكرة":"bobine","قطعة":"pièce","إضافة للمخزون":"Ajouter au stock","إضافة هدف أو آلة جديدة":"Ajouter un objectif ou une machine","حفظ الهدف":"Enregistrer l’objectif"}};
        const deepTranslations = {
            en: {
                'تعذر قراءة اسم المستخدم المحفوظ.':'Could not read the saved user name.','تم تصدير النسخة الاحتياطية بنجاح!':'Backup exported successfully!','تعذر تصدير النسخة الاحتياطية.':'Could not export the backup.','هل أنتِ متأكدة من استرجاع البيانات؟':'Are you sure you want to restore the data?','تم الاسترجاع بنجاح!':'Data restored successfully!','الملف تالف أو غير صالح، تعذر استيراد البيانات.':'The file is corrupted or invalid; it could not be imported.','تعذر قراءة ملف النسخة الاحتياطية.':'Could not read the backup file.','تعذر بدء استيراد النسخة الاحتياطية.':'Could not start the backup import.','هذا المتصفح لا يدعم إشعارات الهاتف.':'This browser does not support phone notifications.','تم تفعيل إشعارات الهاتف. ستظهر مع بقية إشعارات التطبيقات.':'Phone notifications enabled. They will appear with other app notifications.','لم يتم تفعيل الإشعارات. يمكنك السماح بها من إعدادات الهاتف.':'Notifications were not enabled. You can allow them in your phone settings.','تعذر تفعيل الإشعارات في هذا المتصفح.':'Could not enable notifications in this browser.','تعذر حفظ إعدادات اللغة والعملة.':'Could not save language and currency settings.','أدخلي اسمكِ الكريم:':'Enter your name:','تعذر حفظ اسم المستخدم.':'Could not save the user name.','تم حفظ الاسم بنجاح!':'Name saved successfully!','تعذر حفظ الاسم.':'Could not save the name.','تم تغيير الثيم بنجاح!':'Theme changed successfully!','تم حفظ الزبونة بنجاح!':'Client saved successfully!','حذف هذه الزبونة؟':'Delete this client?','تم تحديث ملف الزبونة وقياساتها بنجاح!':'Client profile and measurements updated successfully!','تم تسجيل الطلبية وحفظ قياسات الزبونة بنجاح!':'Order and client measurements saved successfully!','تم التسليم ونقل الطلبية للأرشيف بنجاح!':'Order delivered and moved to the archive successfully!','تم تعديل الطلبية والقياسات بنجاح!':'Order and measurements updated successfully!','حذف هذه الطلبية؟':'Delete this order?','تم حفظ نتيجة التسعير بنجاح!':'Pricing result saved successfully!','تمت إضافة المصروف بنجاح!':'Expense added successfully!','هل أنت متأكدة من إغلاق هذا الشهر المالي وأرشفته؟':'Are you sure you want to close and archive this financial month?','تم أرشفة الشهر المالي بنجاح!':'Financial month archived successfully!','هل أنت متأكدة من حذف هذا الأرشيف الشهري نهائياً؟':'Are you sure you want to permanently delete this monthly archive?','تم حذف الأرشيف بنجاح':'Archive deleted successfully.','مبروك إنجاز الهدف!':'Congratulations, goal completed!','عدّلي اسم السلعة:':'Edit the item name:','حذف هذه السلعة من القائمة؟':'Delete this item from the list?','تمت إضافة المنتج إلى الجرد.':'Product added to inventory.','تم تعديل كل تفاصيل المنتج.':'All product details updated.','هل تريدين حذف هذا المنتج من الجرد؟':'Delete this inventory product?','تم تعديل كل تفاصيل السلعة.':'All item details updated.','حذف هذه السلعة من قائمة المشتريات؟':'Delete this item from the shopping list?','تعذر حفظ البيانات محلياً. تحققي من مساحة التخزين في المتصفح.':'Could not save data locally. Check your browser storage.','يرجى إدخال اسم الزبونة.':'Please enter the client name.','يرجى إدخال نوع المنتج.':'Please enter the product type.','يرجى إدخال سعر بيع أكبر من صفر.':'Please enter a sale price greater than zero.','يرجى إدخال عربون صحيح غير سالب.':'Please enter a valid non-negative deposit.','يرجى اختيار ملف صورة فقط.':'Please choose an image file only.','يرجى إدخال سعر صحيح غير سالب.':'Please enter a valid non-negative price.','يرجى إدخال الكمية بالأرقام أو بالحروف.':'Please enter the quantity using numbers or words.','يرجى إدخال الكمية بالأرقام أو بالحروف، مثل: 5 قطع أو مترين.':'Please enter the quantity using numbers or words, for example: 5 pieces or 2 meters.','يرجى إدخال اسم المنتج.':'Please enter the product name.','يرجى إدخال اسم السلعة.':'Please enter the item name.','هذه السلعة موجودة مسبقًا في القائمة.':'This item is already in the list.','يرجى إدخال اسم القماش.':'Please enter the fabric name.','يرجى إدخال كمية أكبر من صفر.':'Please enter a quantity greater than zero.','يرجى إدخال اسم الهدف.':'Please enter the goal name.','يرجى إدخال مبلغ مطلوب أكبر من صفر.':'Please enter a target amount greater than zero.','يرجى إدخال مبلغ متوفر صحيح غير سالب.':'Please enter a valid non-negative available amount.','تعذر قراءة الصور المختارة.':'Could not read the selected images.','يرجى اختيار صورة صحيحة للمنتج.':'Please choose a valid product image.','تعذر قراءة صورة المنتج.':'Could not read the product image.','يرجى اختيار صورة صحيحة.':'Please choose a valid image.','تعذر قراءة الصورة.':'Could not read the image.','يرجى اختيار صورة صحيحة للسلعة.':'Please choose a valid item image.','تعذر قراءة صورة السلعة.':'Could not read the item image.','تعذر حفظ المنتج.':'Could not save the product.','تعذر حفظ التعديلات.':'Could not save the changes.','تعذر حفظ البيانات المحفوظة':'Could not read saved data','كمية':'Quantity','طلبيات':'Orders','نشطة':'Active','منخفضة':'low','نفدت':'out of stock','في الجرد':'in inventory','للأرشيف':'to archive','تم التسليم للأرشيف':'Delivered to archive','ملاحظات أخرى':'Other notes','تعديل القياسات والملف':'Edit measurements and profile','القياسات والملف':'measurements and profile','من ':'from ','أخرى':'Other','موعد التسليم':'Delivery date','باقي':'Remaining','على تسليم':'until delivery','اليوم':'today','أيام':'days','يوم':'day','منذ':'ago','اسم الزبونة...':'Client name...','رقم الهاتف...':'Phone number...','الولاية (عنابة)...':'State (Annaba)...','نوع المنتج (تطريز، أفرشة، ألبسة...)':'Product type (embroidery, bedding, clothing...)','سعر البيع الإجمالي (دج)...':'Total sale price (DZD)...','اكتبي التفاصيل أو القياسات الأخرى إن وجدت...':'Enter details or additional measurements, if any...','مثال: 140':'Example: 140','مثال: 7':'Example: 7','مثال: 40':'Example: 40','مثال: 18':'Example: 18','مثال: 95':'Example: 95','مثال: 80':'Example: 80','مثال: 75':'Example: 75','مثال: 42':'Example: 42','مثال: 102':'Example: 102','مثال: 20':'Example: 20','مثال: 60':'Example: 60','مثال: 30':'Example: 30','مثال: 16':'Example: 16','مثال: طول الجلابة 135 سم، أو قياس إضافي...':'Example: robe length 135 cm, or another measurement...','العربون المدفوع (دج)...':'Deposit paid (DZD)...','اكتبي الملاحظات...':'Enter notes...','اسم الزبونة الكامل...':'Client full name...','تفضيلاتها وملاحظات خاصة...':'Preferences and special notes...','ابحثي عن اسم زبونة أو ولاية...':'Search by client name or state...','اسم المنتج':'Product name','نوع المنتج':'Product type','الكمية: 5 قطع أو مترين':'Quantity: 5 pieces or 2 meters','السعر (دج)':'Price (DZD)','ملاحظات حول المنتج...':'Product notes...','اسم السلعة':'Item name','مثال: 5000':'Example: 5000','مثال: 200 دج':'Example: 200 DZD','مثال: 50 دج':'Example: 50 DZD','مثال: 100 دج':'Example: 100 DZD','مثال: 0 دج':'Example: 0 DZD','مثال: 60 دقيقة':'Example: 60 minutes','مثال: 240 دقيقة':'Example: 240 minutes','مثال: 300 دج':'Example: 300 DZD','أو أدخلي نسبة مخصصة':'Or enter a custom percentage','بيان المصروف (مثال: أقمشة جديدة + لوازم)...':'Expense description (e.g. new fabrics + supplies)...','التكلفة (دج)...':'Cost (DZD)...','اكتبي اسمك هنا':'Enter your name here','الكمية':'Quantity','ملاحظات حول المنتج':'Product notes','اسم الزبونة':'Client name','الهاتف':'Phone','الولاية':'State','السعر':'Price','تفاصيل أو ملاحظات أخرى':'Details or other notes','العربون':'Deposit','ملاحظات إضافية':'Additional notes','ملاحظات وتفضيلات الزبونة':'Client notes and preferences','اسم الهدف':'Goal name','المطلوب':'Target amount','الموفر':'Amount saved','مثال: سحاب أسود':'Example: black zipper','اسم القماش...':'Fabric name...','الكمية...':'Quantity...','اسم الهدف...':'Goal name...','المبلغ المطلوب...':'Target amount...','المبلغ المتوفر حالياً...':'Amount currently available...','فتح القائمة':'Open menu','حذف الصورة':'Delete image','تغيير':'Change','مثال: أقمشة جديدة + لوازم':'Example: new fabrics + supplies','تاريخ بداية الشهر المالي':'Financial month start date','تاريخ نهاية الشهر المالي':'Financial month end date','مصروف آخر':'Other expense','التوصيل أو التنقل':'Delivery or transport','التغليف والأكياس':'Packaging and bags','الكهرباء واللوازم':'Electricity and supplies','اخترِي':'Choose','بدون تاريخ':'No delivery date','لا توجد صورة':'No image','نوع غير محدد':'Type not specified','قائمة المشتريات فارغة.':'Shopping list is empty.','لم تتم إضافة منتجات للجرد بعد.':'No inventory products have been added yet.','القائمة فارغة. أضيفي سلعة جديدة.':'The list is empty. Add a new item.','لا توجد تنبيهات حالياً.':'No notifications currently.','إغلاق':'Close','تم الإنجاز':'Completed','منجز':'Completed','وفرت':'Saved','آخر نتائج التسعير المحفوظة:':'Latest saved pricing results:','تكلفة':'Cost','ربح':'Profit','يجب أن يكون تاريخ النهاية بعد تاريخ البداية.':'The end date must be after the start date.','لا توجد مصاريف مسجلة لهذا الشهر.':'No expenses recorded for this month.','لا توجد شهور مؤرشفة بعد.':'No archived months yet.','حذف الأرشيف':'Delete archive','المداخيل':'Income','المصاريف':'Expenses','الربح الصافي':'Net profit','عرض التفاصيل':'View details','لا توجد طلبيات مسجلة في هذا الشهر.':'No orders recorded this month.','لا توجد مصاريف مسجلة في هذا الشهر.':'No expenses recorded this month.','فترة الأرشيف:':'Archive period:','الطلبيات المسلمة في هذه الفترة:':'Orders delivered during this period:','المصاريف المسجلة في هذه الفترة:':'Expenses recorded during this period:','تفعيل إشعارات الهاتف بالصوت':'Enable phone notifications with sound','تغيير الصورة 1':'Change image 1','تغيير الصورة 2':'Change image 2','تغيير صورة السلعة':'Change item image'
            },
            fr: {
                'تعذر قراءة اسم المستخدم المحفوظ.':'Impossible de lire le nom enregistré.','تم تصدير النسخة الاحتياطية بنجاح!':'Sauvegarde exportée avec succès !','تعذر تصدير النسخة الاحتياطية.':'Impossible d’exporter la sauvegarde.','هل أنتِ متأكدة من استرجاع البيانات؟':'Voulez-vous vraiment restaurer les données ?','تم الاسترجاع بنجاح!':'Données restaurées avec succès !','الملف تالف أو غير صالح، تعذر استيراد البيانات.':'Le fichier est corrompu ou invalide ; importation impossible.','تعذر قراءة ملف النسخة الاحتياطية.':'Impossible de lire le fichier de sauvegarde.','تعذر بدء استيراد النسخة الاحتياطية.':'Impossible de démarrer l’importation.','هذا المتصفح لا يدعم إشعارات الهاتف.':'Ce navigateur ne prend pas en charge les notifications.','تم تفعيل إشعارات الهاتف. ستظهر مع بقية إشعارات التطبيقات.':'Notifications activées. Elles apparaîtront avec les autres notifications.','لم يتم تفعيل الإشعارات. يمكنك السماح بها من إعدادات الهاتف.':'Notifications non activées. Autorisez-les dans les réglages du téléphone.','تعذر تفعيل الإشعارات في هذا المتصفح.':'Impossible d’activer les notifications dans ce navigateur.','تعذر حفظ إعدادات اللغة والعملة.':'Impossible d’enregistrer la langue et la devise.','أدخلي اسمكِ الكريم:':'Saisissez votre nom :','تعذر حفظ اسم المستخدم.':'Impossible d’enregistrer le nom.','تم حفظ الاسم بنجاح!':'Nom enregistré avec succès !','تعذر حفظ الاسم.':'Impossible d’enregistrer le nom.','تم تغيير الثيم بنجاح!':'Thème modifié avec succès !','تم حفظ الزبونة بنجاح!':'Cliente enregistrée avec succès !','حذف هذه الزبونة؟':'Supprimer cette cliente ?','تم تحديث ملف الزبونة وقياساتها بنجاح!':'Profil et mesures de la cliente mis à jour !','تم تسجيل الطلبية وحفظ قياسات الزبونة بنجاح!':'Commande et mesures enregistrées avec succès !','تم التسليم ونقل الطلبية للأرشيف بنجاح!':'Commande livrée et déplacée vers les archives !','تم تعديل الطلبية والقياسات بنجاح!':'Commande et mesures mises à jour !','حذف هذه الطلبية؟':'Supprimer cette commande ?','تم حفظ نتيجة التسعير بنجاح!':'Calcul enregistré avec succès !','تمت إضافة المصروف بنجاح!':'Dépense ajoutée avec succès !','هل أنت متأكدة من إغلاق هذا الشهر المالي وأرشفته؟':'Voulez-vous clôturer et archiver ce mois financier ?','تم أرشفة الشهر المالي بنجاح!':'Mois financier archivé avec succès !','هل أنت متأكدة من حذف هذا الأرشيف الشهري نهائياً؟':'Supprimer définitivement cette archive mensuelle ?','تم حذف الأرشيف بنجاح':'Archive supprimée avec succès.','مبروك إنجاز الهدف!':'Félicitations, objectif atteint !','عدّلي اسم السلعة:':'Modifier le nom de l’article :','حذف هذه السلعة من القائمة؟':'Supprimer cet article de la liste ?','تمت إضافة المنتج إلى الجرد.':'Produit ajouté à l’inventaire.','تم تعديل كل تفاصيل المنتج.':'Tous les détails du produit ont été mis à jour.','هل تريدين حذف هذا المنتج من الجرد؟':'Supprimer ce produit de l’inventaire ?','تم تعديل كل تفاصيل السلعة.':'Tous les détails de l’article ont été mis à jour.','حذف هذه السلعة من قائمة المشتريات؟':'Supprimer cet article de la liste d’achats ?','تعذر حفظ البيانات محلياً. تحققي من مساحة التخزين في المتصفح.':'Impossible d’enregistrer localement. Vérifiez le stockage du navigateur.','يرجى إدخال اسم الزبونة.':'Saisissez le nom de la cliente.','يرجى إدخال نوع المنتج.':'Saisissez le type de produit.','يرجى إدخال سعر بيع أكبر من صفر.':'Saisissez un prix supérieur à zéro.','يرجى إدخال عربون صحيح غير سالب.':'Saisissez un acompte valide et positif.','يرجى اختيار ملف صورة فقط.':'Choisissez uniquement un fichier image.','يرجى إدخال سعر صحيح غير سالب.':'Saisissez un prix valide et positif.','يرجى إدخال الكمية بالأرقام أو بالحروف.':'Saisissez la quantité en chiffres ou en lettres.','يرجى إدخال الكمية بالأرقام أو بالحروف، مثل: 5 قطع أو مترين.':'Saisissez la quantité en chiffres ou en lettres, par exemple : 5 pièces ou 2 mètres.','يرجى إدخال اسم المنتج.':'Saisissez le nom du produit.','يرجى إدخال اسم السلعة.':'Saisissez le nom de l’article.','هذه السلعة موجودة مسبقًا في القائمة.':'Cet article existe déjà dans la liste.','يرجى إدخال اسم القماش.':'Saisissez le nom du tissu.','يرجى إدخال كمية أكبر من صفر.':'Saisissez une quantité supérieure à zéro.','يرجى إدخال اسم الهدف.':'Saisissez le nom de l’objectif.','يرجى إدخال مبلغ مطلوب أكبر من صفر.':'Saisissez un objectif supérieur à zéro.','يرجى إدخال مبلغ متوفر صحيح غير سالب.':'Saisissez un montant disponible valide et positif.','تعذر قراءة الصور المختارة.':'Impossible de lire les images sélectionnées.','يرجى اختيار صورة صحيحة للمنتج.':'Choisissez une image de produit valide.','تعذر قراءة صورة المنتج.':'Impossible de lire l’image du produit.','يرجى اختيار صورة صحيحة.':'Choisissez une image valide.','تعذر قراءة الصورة.':'Impossible de lire l’image.','يرجى اختيار صورة صحيحة للسلعة.':'Choisissez une image d’article valide.','تعذر قراءة صورة السلعة.':'Impossible de lire l’image de l’article.','تعذر حفظ المنتج.':'Impossible d’enregistrer le produit.','تعذر حفظ التعديلات.':'Impossible d’enregistrer les modifications.','تعذر حفظ البيانات المحفوظة':'Impossible de lire les données enregistrées','كمية':'Quantité','طلبيات':'Commandes','نشطة':'Actives','منخفضة':'faible','نفدت':'épuisée','في الجرد':'dans l’inventaire','للأرشيف':'aux archives','تم التسليم للأرشيف':'Livrée aux archives','ملاحظات أخرى':'Autres notes','تعديل القياسات والملف':'Modifier les mesures et le profil','القياسات والملف':'mesures et profil','من ':'de ','أخرى':'Autres','موعد التسليم':'Date de livraison','باقي':'Reste','على تسليم':'avant la livraison','اليوم':'aujourd’hui','أيام':'jours','يوم':'jour','منذ':'il y a','اسم الزبونة...':'Nom de la cliente…','رقم الهاتف...':'Numéro de téléphone…','الولاية (عنابة)...':'Wilaya (Annaba)…','نوع المنتج (تطريز، أفرشة، ألبسة...)':'Type de produit (broderie, literie, vêtements…)','سعر البيع الإجمالي (دج)...':'Prix de vente total (DZD)…','اكتبي التفاصيل أو القياسات الأخرى إن وجدت...':'Saisissez les détails ou mesures supplémentaires, le cas échéant…','مثال: 140':'Exemple : 140','مثال: 7':'Exemple : 7','مثال: 40':'Exemple : 40','مثال: 18':'Exemple : 18','مثال: 95':'Exemple : 95','مثال: 80':'Exemple : 80','مثال: 75':'Exemple : 75','مثال: 42':'Exemple : 42','مثال: 102':'Exemple : 102','مثال: 20':'Exemple : 20','مثال: 60':'Exemple : 60','مثال: 30':'Exemple : 30','مثال: 16':'Exemple : 16','مثال: طول الجلابة 135 سم، أو قياس إضافي...':'Exemple : longueur de robe 135 cm ou mesure supplémentaire…','العربون المدفوع (دج)...':'Acompte versé (DZD)…','اكتبي الملاحظات...':'Saisissez les notes…','اسم الزبونة الكامل...':'Nom complet de la cliente…','تفضيلاتها وملاحظات خاصة...':'Préférences et notes particulières…','ابحثي عن اسم زبونة أو ولاية...':'Rechercher une cliente ou une wilaya…','اسم المنتج':'Nom du produit','نوع المنتج':'Type de produit','الكمية: 5 قطع أو مترين':'Quantité : 5 pièces ou 2 mètres','السعر (دج)':'Prix (DZD)','ملاحظات حول المنتج...':'Notes du produit…','اسم السلعة':'Nom de l’article','مثال: 5000':'Exemple : 5000','مثال: 200 دج':'Exemple : 200 DZD','مثال: 50 دج':'Exemple : 50 DZD','مثال: 100 دج':'Exemple : 100 DZD','مثال: 0 دج':'Exemple : 0 DZD','مثال: 60 دقيقة':'Exemple : 60 minutes','مثال: 240 دقيقة':'Exemple : 240 minutes','مثال: 300 دج':'Exemple : 300 DZD','أو أدخلي نسبة مخصصة':'Ou saisissez un pourcentage personnalisé','بيان المصروف (مثال: أقمشة جديدة + لوازم)...':'Description de la dépense (ex. : nouveaux tissus + fournitures)…','التكلفة (دج)...':'Coût (DZD)…','اكتبي اسمك هنا':'Saisissez votre nom','الكمية':'Quantité','ملاحظات حول المنتج':'Notes du produit','اسم الزبونة':'Nom de la cliente','الهاتف':'Téléphone','الولاية':'Wilaya','السعر':'Prix','تفاصيل أو ملاحظات أخرى':'Détails ou autres notes','العربون':'Acompte','ملاحظات إضافية':'Notes supplémentaires','ملاحظات وتفضيلات الزبونة':'Notes et préférences de la cliente','اسم الهدف':'Nom de l’objectif','المطلوب':'Objectif','الموفر':'Montant épargné','مثال: سحاب أسود':'Exemple : fermeture éclair noire','اسم القماش...':'Nom du tissu…','الكمية...':'Quantité…','اسم الهدف...':'Nom de l’objectif…','المبلغ المطلوب...':'Montant cible…','المبلغ المتوفر حالياً...':'Montant actuellement disponible…','فتح القائمة':'Ouvrir le menu','حذف الصورة':'Supprimer l’image','تغيير':'Modifier','مثال: أقمشة جديدة + لوازم':'Exemple : nouveaux tissus + fournitures','تاريخ بداية الشهر المالي':'Date de début du mois financier','تاريخ نهاية الشهر المالي':'Date de fin du mois financier','مصروف آخر':'Autre dépense','التوصيل أو التنقل':'Livraison ou transport','التغليف والأكياس':'Emballage et sacs','الكهرباء واللوازم':'Électricité et fournitures','بدون تاريخ':'Sans date de livraison','لا توجد صورة':'Aucune image','نوع غير محدد':'Type non spécifié','قائمة المشتريات فارغة.':'La liste d’achats est vide.','لم تتم إضافة منتجات للجرد بعد.':'Aucun produit n’a encore été ajouté à l’inventaire.','القائمة فارغة. أضيفي سلعة جديدة.':'La liste est vide. Ajoutez un article.','لا توجد تنبيهات حالياً.':'Aucune notification.','إغلاق':'Fermer','تم الإنجاز':'Terminé','منجز':'Terminé','وفرت':'Épargné','آخر نتائج التسعير المحفوظة:':'Derniers calculs enregistrés :','تكلفة':'Coût','ربح':'Bénéfice','يجب أن يكون تاريخ النهاية بعد تاريخ البداية.':'La date de fin doit être postérieure à la date de début.','لا توجد مصاريف مسجلة لهذا الشهر.':'Aucune dépense enregistrée ce mois-ci.','لا توجد شهور مؤرشفة بعد.':'Aucun mois archivé.','حذف الأرشيف':'Supprimer l’archive','المداخيل':'Revenus','المصاريف':'Dépenses','الربح الصافي':'Bénéfice net','عرض التفاصيل':'Voir les détails','لا توجد طلبيات مسجلة في هذا الشهر.':'Aucune commande enregistrée ce mois-ci.','فترة الأرشيف:':'Période de l’archive :','الطلبيات المسلمة في هذه الفترة:':'Commandes livrées pendant cette période :','المصاريف المسجلة في هذه الفترة:':'Dépenses enregistrées pendant cette période :','تفعيل إشعارات الهاتف بالصوت':'Activer les notifications avec son','تغيير الصورة 1':'Modifier l’image 1','تغيير الصورة 2':'Modifier l’image 2','تغيير صورة السلعة':'Modifier l’image de l’article'
            }
        };
        function translateUiText(input) {
            let value = String(input ?? ''); const language = appLanguage || 'ar';
            if (language === 'ar') return value;
            const replacements = { ...(deepTranslations[language] || {}), ...(uiTranslations[language] || {}), ...(commonTranslations[language] || {}), ...(extraTranslations[language] || {}), ...(gapTranslations[language] || {}), ...(fullTranslations[language] || {}) };
            Object.keys(replacements).sort((a,b) => b.length-a.length).forEach(key => { value = value.split(key).join(replacements[key]); });
            return value.split('دج').join(currencySymbols[appCurrency] || 'دج');
        }
        function showAlert(message) { return window.alert(translateUiText(message)); }
        function showConfirm(message) { return window.confirm(translateUiText(message)); }
        function showPrompt(message, value) { return window.prompt(translateUiText(message), value); }
        const uiTranslations = {
            en: {
                'الرئيسية':'Home','إضافة كلمة مرور للحساب':'Add a password to your account','إذا أنشأتِ الحساب عبر Google، أضيفي كلمة مرور حتى تتمكني من الدخول بنفس البريد بالطريقتين.':'If you created your account with Google, add a password to sign in with the same email either way.','اكتبي كلمة المرور (6 أحرف على الأقل)':'Enter a password (at least 6 characters)','أعيدي كتابة كلمة المرور':'Confirm your password','حفظ كلمة المرور':'Save password','كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.':'Password must be at least 6 characters.','كلمتا المرور غير متطابقتين.':'The passwords do not match.','تمت إضافة كلمة المرور. يمكنك الآن الدخول عبر Google أو البريد وكلمة المرور.':'Password added. You can now sign in with Google or email and password.','إضافة طلبية':'New order','إضافة طلبية جديدة':'Add new order','تنظيم الطلبيات':'Active orders','الطلبيات المسلمة':'Delivered orders','قاعدة الزبائن':'Clients','حاسبة التسعير':'Pricing calculator','تكاليف المشروع':'Project costs','إدارة تكاليف المشروع':'Project costs','جرد مخزون الأقمشة':'Fabric inventory','الأهداف':'Goals','الإعدادات':'Settings','الأرشيف':'Archive','اللغة والعملة':'Language & currency','لغة التطبيق':'App language','العملة':'Currency','حفظ الاسم':'Save name','اسم صاحبة التطبيق':'Owner name','تغيير شعار الورشة':'Change workshop logo','الوضع النهاري':'Day mode','الوضع الليلي':'Night mode','تسجيل الخروج':'Sign out','تفعيل إشعارات الهاتف بالصوت':'Enable phone notifications with sound','تغيير الصورة 1':'Change image 1','تغيير الصورة 2':'Change image 2','تغيير صورة السلعة':'Change item image','التنبيهات':'Notifications','تفعيل إشعارات الهاتف':'Enable phone notifications','سجل الطلبيات النشطة':'Active orders register','قائمة السلع واللوازم':'Shopping list','إضافة سلعة':'Add item','حفظ السلعة':'Save item','تعديل':'Edit','حذف':'Delete','حفظ كل التعديلات':'Save all changes','تعديل تفاصيل السلعة':'Edit item details','تعديل تفاصيل منتج الجرد':'Edit inventory product','حفظ الطلبية في الورشة':'Save order','حفظ التغييرات':'Save changes','اختاري العملية التي تريدين تنفيذها.':'Choose an action.','لا توجد تنبيهات حالياً.':'No notifications currently.','بدون تاريخ':'No delivery date','السعر الأصلي':'Original price','يتبقى':'Remaining','العربون':'Deposit','التسليم':'Delivery','الكمية':'Quantity','السعر':'Price','اسم المنتج':'Product name','نوع المنتج':'Product type','ملاحظات حول المنتج':'Product notes','صورة المنتج 1':'Product image 1','صورة المنتج 2':'Product image 2','ملاحظات حول المنتج...':'Product notes...','الطلبيات المسجلة':'Registered orders','التسعير والربح':'Pricing & profit','المصاريف الشهرية':'Monthly expenses','الأرشيف':'Archive','الأهداف':'Goals','اختيار وضع التطبيق':'App appearance','إضافة المنتج إلى الجرد':'Add product to inventory','تنظيم المنتجات':'Product management','قائمة المشتريات فارغة.':'Shopping list is empty.'
            },
            fr: {
                'الرئيسية':'Accueil','إضافة كلمة مرور للحساب':'Ajouter un mot de passe','إذا أنشأتِ الحساب عبر Google، أضيفي كلمة مرور حتى تتمكني من الدخول بنفس البريد بالطريقتين.':'Si vous avez créé votre compte avec Google, ajoutez un mot de passe pour utiliser le même e-mail avec les deux méthodes.','اكتبي كلمة المرور (6 أحرف على الأقل)':'Saisissez un mot de passe (6 caractères minimum)','أعيدي كتابة كلمة المرور':'Confirmez votre mot de passe','حفظ كلمة المرور':'Enregistrer le mot de passe','كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.':'Le mot de passe doit contenir au moins 6 caractères.','كلمتا المرور غير متطابقتين.':'Les mots de passe ne correspondent pas.','تمت إضافة كلمة المرور. يمكنك الآن الدخول عبر Google أو البريد وكلمة المرور.':'Mot de passe ajouté. Vous pouvez maintenant utiliser Google ou l’e-mail et le mot de passe.','إضافة طلبية':'Nouvelle commande','إضافة طلبية جديدة':'Ajouter une commande','تنظيم الطلبيات':'Commandes actives','الطلبيات المسلمة':'Commandes livrées','قاعدة الزبائن':'Clientes','حاسبة التسعير':'Calcul du prix','تكاليف المشروع':'Coûts du projet','إدارة تكاليف المشروع':'Coûts du projet','جرد مخزون الأقمشة':'Inventaire des tissus','الأهداف':'Objectifs','الإعدادات':'Paramètres','الأرشيف':'Archives','اللغة والعملة':'Langue et devise','لغة التطبيق':'Langue de l’application','العملة':'Devise','حفظ الاسم':'Enregistrer le nom','اسم صاحبة التطبيق':'Nom de la propriétaire','تغيير شعار الورشة':'Changer le logo de l’atelier','الوضع النهاري':'Mode jour','الوضع الليلي':'Mode nuit','تسجيل الخروج':'Déconnexion','تفعيل إشعارات الهاتف بالصوت':'Activer les notifications avec son','تغيير الصورة 1':'Changer l’image 1','تغيير الصورة 2':'Changer l’image 2','تغيير صورة السلعة':'Changer l’image de l’article','التنبيهات':'Notifications','تفعيل إشعارات الهاتف':'Activer les notifications','سجل الطلبيات النشطة':'Registre des commandes actives','قائمة السلع واللوازم':'Liste d’achats','إضافة سلعة':'Ajouter un article','حفظ السلعة':'Enregistrer l’article','تعديل':'Modifier','حذف':'Supprimer','حفظ كل التعديلات':'Enregistrer les modifications','تعديل تفاصيل السلعة':'Modifier l’article','تعديل تفاصيل منتج الجرد':'Modifier le produit','حفظ الطلبية في الورشة':'Enregistrer la commande','حفظ التغييرات':'Enregistrer les changements','اختاري العملية التي تريدين تنفيذها.':'Choisissez une action.','لا توجد تنبيهات حالياً.':'Aucune notification.','بدون تاريخ':'Sans date de livraison','السعر الأصلي':'Prix original','يتبقى':'Reste','العربون':'Acompte','التسليم':'Livraison','الكمية':'Quantité','السعر':'Prix','اسم المنتج':'Nom du produit','نوع المنتج':'Type de produit','ملاحظات حول المنتج':'Notes du produit','صورة المنتج 1':'Image du produit 1','صورة المنتج 2':'Image du produit 2','ملاحظات حول المنتج...':'Notes du produit...','الطلبيات المسجلة':'Commandes enregistrées','التسعير والربح':'Prix et bénéfice','المصاريف الشهرية':'Dépenses mensuelles','اختيار وضع التطبيق':'Apparence','إضافة المنتج إلى الجرد':'Ajouter au stock','تنظيم المنتجات':'Gestion des produits','قائمة المشتريات فارغة.':'La liste d’achats est vide.'
            }
        };

        function applyAppLocale() {
            const language = appLanguage || 'ar'; const isArabic = language === 'ar';
            document.documentElement.lang = language; document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
            document.body.classList.toggle('locale-ltr', !isArabic);
            const replacements = { ...(deepTranslations[language] || {}), ...(uiTranslations[language] || {}), ...(commonTranslations[language] || {}), ...(extraTranslations[language] || {}), ...(gapTranslations[language] || {}), ...(fullTranslations[language] || {}) };
            const sorted = Object.keys(replacements).sort((a, b) => b.length - a.length);
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => { if (node.parentElement?.closest('script,style')) return; let value = node.nodeValue; sorted.forEach(key => { value = value.split(key).join(replacements[key]); }); value = value.split('دج').join(currencySymbols[appCurrency] || 'دج'); node.nodeValue = value; });
            document.querySelectorAll('input[placeholder],textarea[placeholder],select option,[aria-label],[title]').forEach(element => { ['placeholder','aria-label','title'].forEach(attribute => { if (element.hasAttribute(attribute)) { let value = element.getAttribute(attribute); sorted.forEach(key => { value = value.split(key).join(replacements[key]); }); element.setAttribute(attribute, value.split('دج').join(currencySymbols[appCurrency] || 'دج')); } }); if (element.matches('option')) { let value = element.textContent; sorted.forEach(key => { value = value.split(key).join(replacements[key]); }); element.textContent = value.split('دج').join(currencySymbols[appCurrency] || 'دج'); } });
            const languageSelect = document.getElementById('settings-language'); const currencySelect = document.getElementById('settings-currency'); if (languageSelect) languageSelect.value = appLanguage; if (currencySelect) currencySelect.value = appCurrency;
        }

        async function saveAppPreferences() {
            appLanguage = document.getElementById('settings-language')?.value || 'ar'; appCurrency = document.getElementById('settings-currency')?.value || 'DZD';
            try { localStorage.setItem(storageKey('momprenuer_language'), JSON.stringify(appLanguage)); localStorage.setItem(storageKey('momprenuer_currency'), JSON.stringify(appCurrency)); } catch (error) { showAlert('تعذر حفظ إعدادات اللغة والعملة.'); return; }
            saveData(true);
            if (firebaseUser && window.firebaseSyncAppData) {
                try { await window.firebaseSyncAppData(getAppDataSnapshot()); } catch (error) {}
            }
            location.reload();
        }

        function initApp() {
            updateUserGreeting();
            renderOrders();
            renderArchive();
            renderClientsSelect();
            renderClients();
            renderSupplies();
            renderInventoryProducts();
            renderShoppingItems();
            renderNotifications();
            applyWorkshopLogo();
            renderSupplyCatalog();
            renderGoals();
            renderFinancials();
            renderPricingHistory();
            applyTheme(selectedTheme);
            updateGlobalStats();
            document.getElementById('cycle-start').value = cycle.start;
            document.getElementById('cycle-end').value = cycle.end;
            document.getElementById('settings-owner-name').value = userName;
            document.getElementById('settings-language').value = appLanguage;
            document.getElementById('settings-currency').value = appCurrency;
            if (window.lucide) lucide.createIcons();
            applyAppLocale();
            restoreLastSection();
        }

        function saveLastSection(section) {
            try { sessionStorage.setItem('momprenuer_last_section', JSON.stringify(section)); } catch (error) {}
        }

        function restoreLastSection() {
            let savedSection = null; try { const stored = sessionStorage.getItem('momprenuer_last_section'); savedSection = stored ? JSON.parse(stored) : null; } catch (error) { savedSection = null; }
            if (!savedSection) return;
            if (savedSection === 'home') return goHome(false);
            if (savedSection === 'active-orders') return openActiveOrders(false);
            if (savedSection === 'finance-calculator') return openCosts('calculator', false);
            if (savedSection === 'finance-project') return openCosts('project', false);
            if (['orders', 'archive', 'clients', 'inventory', 'goals', 'settings'].includes(savedSection)) switchTab(savedSection, false);
        }

        function getAppDataSnapshot() {
            return { userName, orders, clients, supplies, inventoryProducts, shoppingItems, workshopLogo, appLanguage, appCurrency, goals, expenses, financialArchives, cycle, pricingCalculations, supplyCatalog, purchasedCatalogItems, selectedTheme };
        }

        function getCurrentUserName() { return userName; }

        function applyAppDataSnapshot(remoteData) {
            if (!remoteData || typeof remoteData !== 'object') return;
            userName = remoteData.userName || userName;
            orders = Array.isArray(remoteData.orders) ? remoteData.orders : orders;
            clients = Array.isArray(remoteData.clients) ? remoteData.clients : clients;
            supplies = Array.isArray(remoteData.supplies) ? remoteData.supplies : supplies;
            inventoryProducts = Array.isArray(remoteData.inventoryProducts) ? remoteData.inventoryProducts : inventoryProducts;
            shoppingItems = Array.isArray(remoteData.shoppingItems) ? remoteData.shoppingItems : shoppingItems;
            workshopLogo = remoteData.workshopLogo || workshopLogo;
            appLanguage = remoteData.appLanguage || appLanguage;
            appCurrency = remoteData.appCurrency || appCurrency;
            goals = Array.isArray(remoteData.goals) ? remoteData.goals : goals;
            expenses = Array.isArray(remoteData.expenses) ? remoteData.expenses : expenses;
            financialArchives = Array.isArray(remoteData.financialArchives) ? remoteData.financialArchives : financialArchives;
            cycle = remoteData.cycle || cycle;
            pricingCalculations = Array.isArray(remoteData.pricingCalculations) ? remoteData.pricingCalculations : pricingCalculations;
            supplyCatalog = Array.isArray(remoteData.supplyCatalog) ? remoteData.supplyCatalog : supplyCatalog;
            purchasedCatalogItems = remoteData.purchasedCatalogItems || purchasedCatalogItems;
            selectedTheme = remoteData.selectedTheme || selectedTheme;
            saveData(false);
        }

        function prepareUserLocalData(uid) {
            activeUid = uid;
            try {
                const ownerKey = 'momprenuer_local_owner_uid';
                const existingOwner = localStorage.getItem(ownerKey);
                if (!existingOwner) {
                    userDataKeys.forEach(key => {
                        const legacyValue = localStorage.getItem(key);
                        if (legacyValue !== null) localStorage.setItem(`${key}__${uid}`, legacyValue);
                    });
                    localStorage.setItem(ownerKey, uid);
                }
                const read = (key, fallback) => readStoredJson(`${key}__${uid}`, fallback);
                userName = read('momprenuer_user_name', 'خولة');
                orders = read('momprenuer_orders', []);
                clients = read('momprenuer_clients', []);
                supplies = read('momprenuer_supplies', []);
                inventoryProducts = read('momprenuer_inventory_products', []);
                shoppingItems = read('momprenuer_shopping_items', []);
                workshopLogo = read('momprenuer_workshop_logo', '');
                sentNotificationKeys = read('momprenuer_notification_keys', []);
                appLanguage = read('momprenuer_language', 'ar');
                appCurrency = read('momprenuer_currency', 'DZD');
                goals = read('momprenuer_goals', JSON.parse(JSON.stringify(defaultGoals)));
                expenses = read('momprenuer_expenses', []);
                financialArchives = read('momprenuer_fin_archives', []);
                cycle = read('momprenuer_cycle', { ...defaultCycle });
                pricingCalculations = read('momprenuer_pricing_calculations', []);
                supplyCatalog = read('momprenuer_supply_catalog', []);
                purchasedCatalogItems = read('momprenuer_supply_purchased', {});
                selectedTheme = read('momprenuer_theme', 'theme-day');
                if (appCurrency === 'MAD') appCurrency = 'DZD';
                const sessionOwner = sessionStorage.getItem('momprenuer_session_owner');
                if (sessionOwner !== uid) {
                    sessionStorage.removeItem('momprenuer_last_section');
                    sessionStorage.setItem('momprenuer_session_owner', uid);
                }
            } catch (error) {
                showAlert('❌ تعذر فصل بيانات هذا الحساب محليًا.');
            }
        }

        function handleFirebaseUser(user) {
            activeUid = user.uid;
            firebaseUser = user;
            try { localStorage.setItem(offlineUidKey, user.uid); localStorage.setItem(offlineSessionKey, '1'); } catch (error) {}
            document.body.classList.remove('auth-loading');
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('app-shell')?.classList.remove('hidden');
            const passwordPanel = document.getElementById('google-password-panel');
            const hasGoogleProvider = Array.isArray(user.providerData) && user.providerData.some(provider => provider.providerId === 'google.com');
            const hasPasswordProvider = Array.isArray(user.providerData) && user.providerData.some(provider => provider.providerId === 'password');
            passwordPanel?.classList.toggle('hidden', !(hasGoogleProvider && !hasPasswordProvider));
            document.getElementById('email-google-panel')?.classList.toggle('hidden', !(hasPasswordProvider && !hasGoogleProvider));
            initApp();
            if (window.lucide) lucide.createIcons();
        }

        function handleFirebaseSignedOut() {
            firebaseUser = null;
            activeUid = null;
            try { localStorage.removeItem(offlineSessionKey); } catch (error) {}
            document.body.classList.remove('auth-loading');
            document.getElementById('app-shell')?.classList.add('hidden');
            document.getElementById('auth-screen')?.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function firebaseCloudStatus(message) {
            const status = document.querySelector('#display-user-name')?.parentElement?.nextElementSibling?.querySelector('span:last-child');
            if (status) status.textContent = message;
        }
        window.getAppDataSnapshot = getAppDataSnapshot;
        window.getCurrentUserName = getCurrentUserName;
        window.applyAppDataSnapshot = applyAppDataSnapshot;
        window.handleFirebaseUser = handleFirebaseUser;
        window.prepareUserLocalData = prepareUserLocalData;
        window.handleFirebaseSignedOut = handleFirebaseSignedOut;
        window.firebaseCloudStatus = firebaseCloudStatus;
        window.showAlert = showAlert;
        window.hasPendingLocalSync = hasPendingLocalSync;
        window.markLocalSyncPending = markLocalSyncPending;
        window.clearLocalSyncPending = clearLocalSyncPending;

        function changeName() {
            const newName = showPrompt('أدخلي اسمكِ الكريم:', userName);
            if (newName && newName.trim() !== '') {
                userName = newName.trim();
                try {
                    localStorage.setItem(storageKey('momprenuer_user_name'), userName);
                    updateUserGreeting();
                    saveData();
                } catch (error) {
                    showAlert('❌ تعذر حفظ اسم المستخدم.');
                }
            }
        }

        function saveOwnerName(e) {
            e.preventDefault();
            const name = document.getElementById('settings-owner-name').value.trim();
            if (!name) return showValidationError('يرجى إدخال اسم صاحبة التطبيق.');
            userName = name;
            try {
                localStorage.setItem(storageKey('momprenuer_user_name'), userName);
                updateUserGreeting();
                saveData();
                showAlert('✅ تم حفظ الاسم بنجاح!');
            } catch (error) {
                showAlert('❌ تعذر حفظ الاسم.');
            }
        }

        function updateUserGreeting() {
            document.getElementById('display-user-name').innerText = userName;
            document.getElementById('user-avatar').innerText = userName.charAt(0);
        }

        function applyWorkshopLogo() {
            const logo = document.getElementById('workshop-logo');
            if (logo && workshopLogo) logo.src = workshopLogo;
        }

        function changeWorkshopLogo(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { event.target.value = ''; return showValidationError('يرجى اختيار صورة شعار صحيحة.'); }
            const reader = new FileReader();
            reader.onload = () => { workshopLogo = reader.result; applyWorkshopLogo(); saveData(); };
            reader.onerror = () => showValidationError('تعذر قراءة شعار الورشة.');
            reader.readAsDataURL(file);
        }

        const themeAliases = {
            'theme-rose': 'theme-day',
            'theme-lilac': 'theme-day',
            'theme-blush-pattern': 'theme-day',
            'theme-mint-pattern': 'theme-day',
            'theme-champagne': 'theme-day',
            'theme-powder': 'theme-day',
            'theme-lavender': 'theme-day',
            'theme-sage': 'theme-day',
            'theme-mist': 'theme-day',
            'theme-sand': 'theme-day',
            'theme-plum': 'theme-night',
            'theme-pearl': 'theme-night',
            'theme-olive': 'theme-night'
        };
        const availableThemes = ['theme-day', 'theme-night'];

        function applyTheme(theme) {
            const normalizedTheme = themeAliases[theme] || theme;
            const safeTheme = availableThemes.includes(normalizedTheme) ? normalizedTheme : 'theme-day';
            document.body.classList.remove(
                'theme-rose', 'theme-lilac', 'theme-blush-pattern', 'theme-mint-pattern',
                'theme-powder', 'theme-lavender', 'theme-sage', 'theme-mist', 'theme-sand',
                'theme-plum', 'theme-pearl', 'theme-olive', ...availableThemes
            );
            document.body.classList.add(safeTheme);
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta) themeMeta.setAttribute('content', safeTheme === 'theme-night' ? '#111827' : '#fef7f9');
            selectedTheme = safeTheme;
            saveData();
        }

        function chooseTheme(theme) {
            applyTheme(theme);
            showAlert('✅ تم تغيير الثيم بنجاح!');
        }

        function toggleAppMenu() {
            const menu = document.getElementById('app-menu');
            if (menu) menu.classList.toggle('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function closeAppMenu() { document.getElementById('app-menu')?.classList.add('hidden'); }

        function goHome(save = true) {
            closeAppMenu();
            if (save) saveLastSection('home');
            document.getElementById('primary-dashboard')?.classList.remove('hidden');
            ['orders', 'active-orders', 'archive', 'clients', 'inventory', 'finance', 'goals', 'settings'].forEach(t => document.getElementById(`sec-${t}`)?.classList.add('hidden'));
        }

        function openActiveOrders(save = true) {
            closeAppMenu();
            if (save) saveLastSection('active-orders');
            document.getElementById('primary-dashboard')?.classList.add('hidden');
            ['orders', 'active-orders', 'archive', 'clients', 'inventory', 'finance', 'goals', 'settings'].forEach(t => document.getElementById(`sec-${t}`)?.classList.add('hidden'));
            document.getElementById('sec-active-orders')?.classList.remove('hidden');
            document.getElementById('sec-active-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function openNewOrder(domain = 'bedding') {
            switchTab('orders');
            const select = document.getElementById('order-domain');
            if (select) { select.value = domain; selectOrderDomain(domain); }
            document.getElementById('sec-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function selectOrderDomain(domain) {
            const panel = document.getElementById('apparel-measurements-panel');
            if (panel) panel.classList.toggle('hidden', domain !== 'clothing');
        }

        function openCosts(view = 'calculator', save = true) {
            closeAppMenu();
            if (save) saveLastSection(view === 'project' ? 'finance-project' : 'finance-calculator');
            switchTab('finance', false);
            const calculator = document.getElementById('pricing-calculator-panel');
            const project = document.getElementById('project-costs-panel');
            const history = document.getElementById('financial-history-panel');
            if (calculator) calculator.classList.toggle('hidden', view !== 'calculator');
            if (project) project.classList.toggle('hidden', view !== 'project');
            if (history) history.classList.toggle('hidden', view !== 'project');
            document.getElementById('sec-finance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function switchTab(tab, save = true) {
            closeAppMenu();
            if (save) saveLastSection(tab);
            document.getElementById('primary-dashboard')?.classList.add('hidden');
            ['orders', 'active-orders', 'archive', 'clients', 'inventory', 'finance', 'goals', 'settings'].forEach(t => {
                document.getElementById(`sec-${t}`).classList.add('hidden');
                const btn = document.getElementById(`tab-${t}`);
                if (btn) { btn.classList.remove('bg-rose-500', 'text-white', 'shadow-sm'); btn.classList.add('text-slate-600'); }
            });
            document.getElementById(`sec-${tab}`).classList.remove('hidden');
            if (tab === 'orders') selectOrderDomain(document.getElementById('order-domain')?.value || 'bedding');
            const activeBtn = document.getElementById(`tab-${tab}`);
            if (activeBtn) { activeBtn.classList.add('bg-rose-500', 'text-white', 'shadow-sm'); activeBtn.classList.remove('text-slate-600'); }
        }

        function showValidationError(message) {
            showAlert(`⚠️ ${message}`);
            return false;
        }

        function isNonNegativeNumber(value) {
            return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
        }

        function addNewClientDirect(e) {
            e.preventDefault();
            const nameInput = document.getElementById('direct-client-name').value.trim();
            const phoneInput = document.getElementById('direct-client-phone').value.trim();
            const stateInput = document.getElementById('direct-client-state').value.trim();
            const notesInput = document.getElementById('direct-client-notes').value.trim();
            if (!nameInput) return showValidationError('يرجى إدخال اسم الزبونة.');

            clients.push({ 
                id: Date.now(), 
                name: nameInput, 
                phone: phoneInput || 'غير مسجل', 
                state: stateInput || 'غير مسجلة', 
                totalOrders: 0, 
                totalSpent: 0, 
                notes: notesInput || '',
                apparelMeasurements: {} 
            });
            saveData();
            renderClients();
            renderClientsSelect();
            updateGlobalStats();
            e.target.reset();
            showAlert('✅ تم حفظ الزبونة بنجاح!');
        }

        function deleteClient(id) {
            if (showConfirm('حذف هذه الزبونة؟')) {
                clients = clients.filter(x => x.id !== id);
                saveData();
                renderClients();
                renderClientsSelect();
                updateGlobalStats();
            }
        }

        function openEditClientModal(id) {
            const c = clients.find(x => x.id === id);
            if (!c) return;
            document.getElementById('edit-client-id').value = c.id;
            document.getElementById('edit-client-name').value = c.name;
            document.getElementById('edit-client-phone').value = (c.phone === 'غير مسجل') ? '' : c.phone;
            document.getElementById('edit-client-state').value = (c.state === 'غير مسجلة') ? '' : c.state;
            document.getElementById('edit-client-notes').value = c.notes || '';
            
            const am = c.apparelMeasurements || {};
            document.getElementById('client-m-len').value = am.len || '';
            document.getElementById('client-m-neck').value = am.neck || '';
            document.getElementById('client-m-shoulders').value = am.shoulders || '';
            document.getElementById('client-m-btwn-bust').value = am.btwnBust || '';
            document.getElementById('client-m-chest').value = am.chest || '';
            document.getElementById('client-m-under-chest').value = am.underChest || '';
            document.getElementById('client-m-waist').value = am.waist || '';
            document.getElementById('client-m-chest-cut').value = am.chestCut || '';
            document.getElementById('client-m-hips').value = am.hips || '';
            document.getElementById('client-m-hip-height').value = am.hipHeight || '';
            document.getElementById('client-m-arm-len').value = am.armLen || '';
            document.getElementById('client-m-bicep').value = am.bicep || '';
            document.getElementById('client-m-wrist').value = am.wrist || '';
            document.getElementById('client-m-extra').value = am.extra || '';

            document.getElementById('edit-client-modal').classList.remove('hidden');
        }

        function closeEditClientModal() { document.getElementById('edit-client-modal').classList.add('hidden'); }

        function saveClientEdit(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('edit-client-id').value);
            const c = clients.find(x => x.id === id);
            if (c) {
                const editedName = document.getElementById('edit-client-name').value.trim();
                if (!editedName) return showValidationError('يرجى إدخال اسم الزبونة.');
                c.name = editedName;
                c.phone = document.getElementById('edit-client-phone').value.trim() || 'غير مسجل';
                c.state = document.getElementById('edit-client-state').value.trim() || 'غير مسجلة';
                c.notes = document.getElementById('edit-client-notes').value.trim();
                
                c.apparelMeasurements = {
                    len: document.getElementById('client-m-len').value.trim(),
                    neck: document.getElementById('client-m-neck').value.trim(),
                    shoulders: document.getElementById('client-m-shoulders').value.trim(),
                    btwnBust: document.getElementById('client-m-btwn-bust').value.trim(),
                    chest: document.getElementById('client-m-chest').value.trim(),
                    underChest: document.getElementById('client-m-under-chest').value.trim(),
                    waist: document.getElementById('client-m-waist').value.trim(),
                    chestCut: document.getElementById('client-m-chest-cut').value.trim(),
                    hips: document.getElementById('client-m-hips').value.trim(),
                    hipHeight: document.getElementById('client-m-hip-height').value.trim(),
                    armLen: document.getElementById('client-m-arm-len').value.trim(),
                    bicep: document.getElementById('client-m-bicep').value.trim(),
                    wrist: document.getElementById('client-m-wrist').value.trim(),
                    extra: document.getElementById('client-m-extra').value.trim()
                };

                saveData();
                renderClients();
                renderClientsSelect();
                closeEditClientModal();
                showAlert('✅ تم تحديث ملف الزبونة وقياساتها بنجاح!');
            }
        }

        function renderClients() {
            const container = document.getElementById('clients-container');
            const vipCard = document.getElementById('vip-client-card');
            const searchQuery = (document.getElementById('client-search-input')?.value || '').toLowerCase().trim();
            const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchQuery) || c.state.toLowerCase().includes(searchQuery));

            if (clients.length === 0) {
                container.innerHTML = `<p class="text-center text-slate-400 text-xs py-4">لم يتم تسجيل أي زبونة بعد.</p>`;
                vipCard.innerHTML = `<p class="text-[11px] text-amber-700">تظهر هنا الزبونة الأكثر طلباً!</p>`;
                return;
            }

            const sortedVIP = [...clients].sort((a, b) => b.totalOrders - a.totalOrders)[0];
            if (sortedVIP && sortedVIP.totalOrders > 0) {
                vipCard.innerHTML = `<b>👑 ${sortedVIP.name} (${sortedVIP.state})</b> • ${sortedVIP.totalOrders} طلبيات • إجمالي: ${sortedVIP.totalSpent} دج`;
            } else {
                vipCard.innerHTML = `تظهر هنا الزبونة الأكثر طلباً تلقائياً عند تسليم الطلبيات.`;
            }

            container.innerHTML = filteredClients.map(c => {
                const am = c.apparelMeasurements || {};
                const hasApparel = am.len || am.chest || am.waist || am.hips || am.shoulders || am.extra;
                
                let apparelHtml = '';
                if (hasApparel) {
                    apparelHtml = `
                        <div class="bg-purple-50/70 p-2 rounded-xl border border-purple-200 text-[11px] space-y-1 mt-1">
                            <span class="font-bold text-purple-900 block">📏 قياسات جسم الزبونة المسجلة:</span>
                            <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-700">
                                ${am.len ? `<div>الطول الكلي: <b>${am.len} سم</b></div>` : ''}
                                ${am.neck ? `<div>طول الرقبة: <b>${am.neck} سم</b></div>` : ''}
                                ${am.shoulders ? `<div>عرض الكتفين: <b>${am.shoulders} سم</b></div>` : ''}
                                ${am.btwnBust ? `<div>طول بين النهدين: <b>${am.btwnBust} سم</b></div>` : ''}
                                ${am.chest ? `<div>محيط الصدر: <b>${am.chest} سم</b></div>` : ''}
                                ${am.underChest ? `<div>محيط تحت الصدر: <b>${am.underChest} سم</b></div>` : ''}
                                ${am.waist ? `<div>محيط الخصر: <b>${am.waist} سم</b></div>` : ''}
                                ${am.chestCut ? `<div>طول قصة الصدر: <b>${am.chestCut} سم</b></div>` : ''}
                                ${am.hips ? `<div>محيط الورك: <b>${am.hips} سم</b></div>` : ''}
                                ${am.hipHeight ? `<div>ارتفاع الورك: <b>${am.hipHeight} سم</b></div>` : ''}
                                ${am.armLen ? `<div>طول الذراع: <b>${am.armLen} سم</b></div>` : ''}
                                ${am.bicep ? `<div>عرض الزندة: <b>${am.bicep} سم</b></div>` : ''}
                                ${am.wrist ? `<div>دوران المعصم: <b>${am.wrist} سم</b></div>` : ''}
                            </div>
                            ${am.extra ? `<div class="text-purple-800 pt-1 border-t border-purple-200">➕ قياس إضافي: <b>${am.extra}</b></div>` : ''}
                        </div>
                    `;
                }

                return `
                <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1.5 text-xs">
                    <div class="flex justify-between items-center font-bold">
                        <span>${c.name} (${c.state || 'غير محددة'})</span>
                        <span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">${c.totalOrders || 0} طلبيات</span>
                    </div>
                    <div class="text-slate-500">📞 ${c.phone || 'بدون'} • المجموع: ${c.totalSpent || 0} دج</div>
                    ${c.notes ? `<div class="text-[10px] text-slate-500 bg-slate-50 p-1 rounded">ملاحظة: ${c.notes}</div>` : ''}
                    ${apparelHtml}
                    <div class="flex justify-end gap-1 pt-1">
                        <button onclick="openEditClientModal(${c.id})" class="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg font-bold">تعديل القياسات والملف</button>
                        <button onclick="deleteClient(${c.id})" class="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-bold">حذف</button>
                    </div>
                </div>
            `;}).join('');
            if (window.lucide) lucide.createIcons();
        }

        function renderClientsSelect() {
            document.getElementById('order-client-select').innerHTML = `<option value="">-- زبونة مسجلة --</option>` + 
                clients.map(c => `<option value="${c.name}">${c.name} (${c.phone})</option>`).join('');
        }

        function fillClientData() {
            const clientName = document.getElementById('order-client-select').value;
            if (!clientName) return;
            const found = clients.find(c => c.name === clientName);
            if (found) {
                document.getElementById('order-client-name').value = found.name;
                document.getElementById('order-client-phone').value = (found.phone === 'غير مسجل') ? '' : found.phone;
                document.getElementById('order-client-state').value = (found.state === 'غير مسجلة') ? '' : found.state;
                
                const am = found.apparelMeasurements || {};
                document.getElementById('m-len').value = am.len || '';
                document.getElementById('m-neck').value = am.neck || '';
                document.getElementById('m-shoulders').value = am.shoulders || '';
                document.getElementById('m-btwn-bust').value = am.btwnBust || '';
                document.getElementById('m-chest').value = am.chest || '';
                document.getElementById('m-under-chest').value = am.underChest || '';
                document.getElementById('m-waist').value = am.waist || '';
                document.getElementById('m-chest-cut').value = am.chestCut || '';
                document.getElementById('m-hips').value = am.hips || '';
                document.getElementById('m-hip-height').value = am.hipHeight || '';
                document.getElementById('m-arm-len').value = am.armLen || '';
                document.getElementById('m-bicep').value = am.bicep || '';
                document.getElementById('m-wrist').value = am.wrist || '';
                document.getElementById('m-extra').value = am.extra || '';
            }
        }

        function previewOrderImage(input, previewId) {
            const preview = document.getElementById(previewId);
            const file = input.files && input.files[0];
            if (!file) {
                preview.removeAttribute('src');
                preview.classList.add('hidden');
                return;
            }
            if (!file.type.startsWith('image/')) {
                input.value = '';
                preview.removeAttribute('src');
                preview.classList.add('hidden');
                return showValidationError('يرجى اختيار ملف صورة فقط.');
            }
            preview.src = URL.createObjectURL(file);
            preview.classList.remove('hidden');
        }

        const MAX_ORDER_IMAGES_PER_TYPE = 4;
        const orderImageFileSelections = { 'order-fabric-image': [], 'order-model-image': [] };
        const orderImagePreviewUrls = { 'order-fabric-image': [], 'order-model-image': [] };

        function changeOrderImage(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.dataset.appendImages = '0';
            input.click();
        }

        function addOrderImage(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.dataset.appendImages = '1';
            input.click();
        }

        function syncOrderInputFiles(inputId, files) {
            const input = document.getElementById(inputId);
            if (!input || typeof DataTransfer === 'undefined') return;
            const transfer = new DataTransfer();
            files.forEach(file => transfer.items.add(file));
            input.files = transfer.files;
        }

        function revokeOrderPreviewUrls(inputId) {
            (orderImagePreviewUrls[inputId] || []).forEach(url => URL.revokeObjectURL(url));
            orderImagePreviewUrls[inputId] = [];
        }

        function renderOrderImagePreviews(inputId, previewId) {
            const preview = document.getElementById(previewId);
            if (!preview) return;
            revokeOrderPreviewUrls(inputId);
            preview.replaceChildren();
            const files = orderImageFileSelections[inputId] || [];
            if (!files.length) {
                preview.classList.add('hidden');
                return;
            }
            files.forEach((file, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative overflow-hidden rounded-lg border border-slate-200 bg-white';
                const img = document.createElement('img');
                const url = URL.createObjectURL(file);
                orderImagePreviewUrls[inputId].push(url);
                img.src = url;
                img.alt = `معاينة الصورة ${index + 1}`;
                img.className = 'h-20 w-full object-cover';
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'absolute top-1 left-1 w-6 h-6 rounded-full bg-white/95 text-rose-600 border border-rose-100 text-sm leading-none font-bold';
                remove.setAttribute('aria-label', 'حذف الصورة');
                remove.textContent = '×';
                remove.addEventListener('click', () => removeOrderImage(inputId, previewId, index));
                wrapper.append(img, remove);
                preview.appendChild(wrapper);
            });
            preview.classList.remove('hidden');
        }

        function previewOrderImages(input, previewId) {
            const selectedFiles = Array.from(input.files || []);
            const invalid = selectedFiles.find(file => !file.type || !file.type.startsWith('image/'));
            if (invalid) {
                input.value = '';
                input.dataset.appendImages = '0';
                return showValidationError('يرجى اختيار ملفات صور فقط.');
            }
            const previousFiles = orderImageFileSelections[input.id] || [];
            const append = input.dataset.appendImages === '1';
            let files = append ? [...previousFiles, ...selectedFiles] : selectedFiles;
            if (files.length > MAX_ORDER_IMAGES_PER_TYPE) {
                files = files.slice(0, MAX_ORDER_IMAGES_PER_TYPE);
                showAlert(`يمكن إضافة ${MAX_ORDER_IMAGES_PER_TYPE} صور كحد أقصى لكل قسم.`);
            }
            orderImageFileSelections[input.id] = files;
            input.dataset.appendImages = '0';
            syncOrderInputFiles(input.id, files);
            renderOrderImagePreviews(input.id, previewId);
        }

        function removeOrderImage(inputId, previewId, index) {
            const files = orderImageFileSelections[inputId] || [];
            if (index < 0 || index >= files.length) return;
            files.splice(index, 1);
            orderImageFileSelections[inputId] = files;
            syncOrderInputFiles(inputId, files);
            renderOrderImagePreviews(inputId, previewId);
        }

        function clearOrderImages(inputId, previewId) {
            const input = document.getElementById(inputId);
            orderImageFileSelections[inputId] = [];
            revokeOrderPreviewUrls(inputId);
            if (input) {
                input.value = '';
                input.dataset.appendImages = '0';
            }
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.replaceChildren();
                preview.classList.add('hidden');
            }
        }

        function clearOrderImage(inputId, previewId) {
            clearOrderImages(inputId, previewId);
        }

        function compressOrderImage(file, label) {
            if (!file || !file.type.startsWith('image/')) return Promise.reject(new Error(`ملف ${label} غير صالح.`));
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const image = new Image();
                image.onload = () => {
                    try {
                        const maxSide = 800;
                        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
                        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
                        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                        const compressed = canvas.toDataURL('image/jpeg', 0.65);
                        URL.revokeObjectURL(url);
                        resolve(compressed);
                    } catch (error) { URL.revokeObjectURL(url); reject(new Error(`تعذر ضغط صورة ${label}.`)); }
                };
                image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`تعذر فتح صورة ${label}.`)); };
                image.src = url;
            });
        }

        function readOrderImages(inputId, label) {
            const input = document.getElementById(inputId);
            const files = Array.from(input?.files || []);
            if (!files.length) return Promise.resolve([]);
            return Promise.all(files.map(file => compressOrderImage(file, label)));
        }

        function readOrderImage(inputId, label) {
            return readOrderImages(inputId, label).then(images => images[0] || '');
        }

        function getOrderImages(order, type) {
            const pluralKey = type === 'fabric' ? 'fabricImages' : 'modelImages';
            const legacyKey = type === 'fabric' ? 'fabricImage' : 'modelImage';
            const images = Array.isArray(order?.[pluralKey]) ? order[pluralKey].filter(Boolean) : [];
            if (!images.length && order?.[legacyKey]) images.push(order[legacyKey]);
            return images;
        }

        function orderImagesHtml(order) {
            const fabricImages = getOrderImages(order, 'fabric');
            const modelImages = getOrderImages(order, 'model');
            if (!fabricImages.length && !modelImages.length) return '';
            const gallery = (title, images, alt) => images.length ? `<div><span class="text-[10px] text-slate-500 block mb-1">${title} (${images.length})</span><div class="grid grid-cols-2 gap-1.5">${images.map((image, index) => `<img src="${image}" alt="${alt} ${index + 1}" class="w-full h-24 object-cover rounded-xl border">`).join('')}</div></div>` : '';
            return `<div class="grid grid-cols-1 gap-2 pt-1 border-t">${gallery('الأقمشة', fabricImages, 'صورة القماش')}${gallery('المودالات والأطقم', modelImages, 'صورة المودال')}</div>`;
        }

        async function addOrder(e) {
            e.preventDefault();
            const price = parseFloat(document.getElementById('order-price').value) || 0;
            const clientName = document.getElementById('order-client-name').value.trim();
            const clientPhone = document.getElementById('order-client-phone').value.trim();
            const clientState = document.getElementById('order-client-state').value.trim();
            const item = document.getElementById('order-item').value.trim();
            const depositValue = document.getElementById('order-deposit').value;
            if (!clientName) return showValidationError('يرجى إدخال اسم الزبونة.');
            if (!item) return showValidationError('يرجى إدخال نوع المنتج.');
            if (!Number.isFinite(price) || price <= 0) return showValidationError('يرجى إدخال سعر بيع أكبر من صفر.');
            if (depositValue !== '' && !isNonNegativeNumber(depositValue)) return showValidationError('يرجى إدخال عربون صحيح غير سالب.');

            let fabricImages = [];
            let modelImages = [];
            try {
                [fabricImages, modelImages] = await Promise.all([
                    readOrderImages('order-fabric-image', 'القماش'),
                    readOrderImages('order-model-image', 'المودال')
                ]);
            } catch (error) {
                return showValidationError(error.message || 'تعذر قراءة الصور المختارة.');
            }

            const apparelMeasurements = {
                len: document.getElementById('m-len').value.trim(),
                neck: document.getElementById('m-neck').value.trim(),
                shoulders: document.getElementById('m-shoulders').value.trim(),
                btwnBust: document.getElementById('m-btwn-bust').value.trim(),
                chest: document.getElementById('m-chest').value.trim(),
                underChest: document.getElementById('m-under-chest').value.trim(),
                waist: document.getElementById('m-waist').value.trim(),
                chestCut: document.getElementById('m-chest-cut').value.trim(),
                hips: document.getElementById('m-hips').value.trim(),
                hipHeight: document.getElementById('m-hip-height').value.trim(),
                armLen: document.getElementById('m-arm-len').value.trim(),
                bicep: document.getElementById('m-bicep').value.trim(),
                wrist: document.getElementById('m-wrist').value.trim(),
                extra: document.getElementById('m-extra').value.trim()
            };

            const newOrder = {
                id: Date.now(),
                orderDomain: document.getElementById('order-domain')?.value || 'bedding',
                clientName,
                phone: clientPhone || 'بدون هاتف',
                state: clientState || 'غير محددة',
                item,
                size: document.getElementById('order-size').value,
                apparelMeasurements,
                fabricImages,
                modelImages,
                // الحقول المفردة تبقى للتوافق مع النسخ والبيانات القديمة.
                fabricImage: fabricImages[0] || '',
                modelImage: modelImages[0] || '',
                price,
                deposit: parseFloat(document.getElementById('order-deposit').value) || 0,
                date: document.getElementById('order-date').value,
                createdAt: new Date().toISOString(),
                notes: document.getElementById('order-notes').value,
                status: 'active'
            };

            let existingClient = clients.find(c => c.name.trim().toLowerCase() === clientName.toLowerCase());
            if (existingClient) {
                existingClient.phone = clientPhone || existingClient.phone;
                existingClient.state = clientState || existingClient.state;
                existingClient.apparelMeasurements = apparelMeasurements;
            } else {
                clients.push({ 
                    id: Date.now() + 1, 
                    name: clientName, 
                    phone: clientPhone || 'غير مسجل', 
                    state: clientState || 'غير مسجلة', 
                    totalOrders: 0, 
                    totalSpent: 0, 
                    notes: '',
                    apparelMeasurements 
                });
            }

            orders.unshift(newOrder);
            const savedLocally = saveData();
            renderOrders();
            renderClients();
            renderClientsSelect();
            updateGlobalStats();
            e.target.reset();
            clearOrderImages('order-fabric-image', 'order-fabric-preview');
            clearOrderImages('order-model-image', 'order-model-preview');
            if (savedLocally) showAlert('✅ تم تسجيل الطلبية وحفظ قياسات الزبونة بنجاح!');
            else showAlert('⚠️ تم تسجيل الطلبية في النسخة الاحتياطية الآمنة، وستظهر بعد إعادة فتح التطبيق أو عند عودة الاتصال.');
        }

        function markAsDelivered(id) {
            const order = orders.find(o => o.id === id);
            if (!order) return;
            order.status = 'delivered';

            let client = clients.find(c => c.name.trim().toLowerCase() === order.clientName.trim().toLowerCase());
            if (client) {
                client.totalOrders = (client.totalOrders || 0) + 1;
                client.totalSpent = (client.totalSpent || 0) + order.price;
            }

            saveData();
            renderOrders();
            renderArchive();
            renderClients();
            renderFinancials();
            updateGlobalStats();
            showAlert('✨ تم التسليم ونقل الطلبية للأرشيف بنجاح!');
        }

        function deleteDeliveredOrderImages(id) {
            const order = orders.find(o => o.id === id);
            if (!order || order.status !== 'delivered') {
                return showValidationError('يمكن حذف الصور من الطلبية بعد تسليمها فقط.');
            }

            const fabricImages = getOrderImages(order, 'fabric');
            const modelImages = getOrderImages(order, 'model');
            const totalImages = fabricImages.length + modelImages.length;
            if (!totalImages) {
                return showAlert('لا توجد صور محفوظة في هذه الطلبية.');
            }

            const confirmed = window.confirm(
                `سيتم حذف ${totalImages} صورة نهائياً من هذه الطلبية لتخفيف مساحة البيانات.\n\n` +
                'ستبقى معلومات الزبونة والمنتج والقياسات والسعر والأرباح محفوظة.\n\nهل تريدين المتابعة؟'
            );
            if (!confirmed) return;

            // نحذف الحقول الجديدة والقديمة معاً لضمان توافق كل نسخ الطلبات.
            order.fabricImages = [];
            order.modelImages = [];
            order.fabricImage = '';
            order.modelImage = '';
            order.imagesDeletedAt = new Date().toISOString();

            const saved = saveData();
            renderArchive();
            renderOrders();
            if (saved) {
                showAlert('🗑️ تم حذف صور الطلبية مع الاحتفاظ بجميع بياناتها.');
            } else {
                showAlert('⚠️ تم حذف الصور محلياً، وسيتم حفظ التغيير عند عودة المزامنة.');
            }
        }

        function openEditOrderModal(id) {
            const o = orders.find(x => x.id === id);
            if (!o) return;
            document.getElementById('edit-order-id').value = o.id;
            document.getElementById('edit-order-client').value = o.clientName;
            document.getElementById('edit-order-phone').value = o.phone || '';
            document.getElementById('edit-order-state').value = o.state || '';
            document.getElementById('edit-order-item').value = o.item;
            document.getElementById('edit-order-size').value = o.size || '';
            
            const am = o.apparelMeasurements || {};
            document.getElementById('edit-m-len').value = am.len || '';
            document.getElementById('edit-m-neck').value = am.neck || '';
            document.getElementById('edit-m-shoulders').value = am.shoulders || '';
            document.getElementById('edit-m-btwn-bust').value = am.btwnBust || '';
            document.getElementById('edit-m-chest').value = am.chest || '';
            document.getElementById('edit-m-under-chest').value = am.underChest || '';
            document.getElementById('edit-m-waist').value = am.waist || '';
            document.getElementById('edit-m-chest-cut').value = am.chestCut || '';
            document.getElementById('edit-m-hips').value = am.hips || '';
            document.getElementById('edit-m-hip-height').value = am.hipHeight || '';
            document.getElementById('edit-m-arm-len').value = am.armLen || '';
            document.getElementById('edit-m-bicep').value = am.bicep || '';
            document.getElementById('edit-m-wrist').value = am.wrist || '';
            document.getElementById('edit-m-extra').value = am.extra || '';

            document.getElementById('edit-order-price').value = o.price;
            document.getElementById('edit-order-deposit').value = o.deposit || 0;
            document.getElementById('edit-order-date').value = o.date || '';
            document.getElementById('edit-order-notes').value = o.notes || '';
            document.getElementById('edit-order-modal').classList.remove('hidden');
        }

        function closeEditOrderModal() { document.getElementById('edit-order-modal').classList.add('hidden'); }

        function saveOrderEdit(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('edit-order-id').value);
            const o = orders.find(x => x.id === id);
            if (o) {
                const editedClient = document.getElementById('edit-order-client').value.trim();
                const editedItem = document.getElementById('edit-order-item').value.trim();
                const editedPriceValue = document.getElementById('edit-order-price').value;
                const editedDepositValue = document.getElementById('edit-order-deposit').value;
                if (!editedClient) return showValidationError('يرجى إدخال اسم الزبونة.');
                if (!editedItem) return showValidationError('يرجى إدخال نوع المنتج.');
                if (!editedPriceValue || !isNonNegativeNumber(editedPriceValue) || Number(editedPriceValue) <= 0) return showValidationError('يرجى إدخال سعر بيع أكبر من صفر.');
                if (editedDepositValue !== '' && !isNonNegativeNumber(editedDepositValue)) return showValidationError('يرجى إدخال عربون صحيح غير سالب.');
                o.clientName = editedClient;
                o.phone = document.getElementById('edit-order-phone').value;
                o.state = document.getElementById('edit-order-state').value;
                o.item = editedItem;
                o.size = document.getElementById('edit-order-size').value;
                
                o.apparelMeasurements = {
                    len: document.getElementById('edit-m-len').value.trim(),
                    neck: document.getElementById('edit-m-neck').value.trim(),
                    shoulders: document.getElementById('edit-m-shoulders').value.trim(),
                    btwnBust: document.getElementById('edit-m-btwn-bust').value.trim(),
                    chest: document.getElementById('edit-m-chest').value.trim(),
                    underChest: document.getElementById('edit-m-under-chest').value.trim(),
                    waist: document.getElementById('edit-m-waist').value.trim(),
                    chestCut: document.getElementById('edit-m-chest-cut').value.trim(),
                    hips: document.getElementById('edit-m-hips').value.trim(),
                    hipHeight: document.getElementById('edit-m-hip-height').value.trim(),
                    armLen: document.getElementById('edit-m-arm-len').value.trim(),
                    bicep: document.getElementById('edit-m-bicep').value.trim(),
                    wrist: document.getElementById('edit-m-wrist').value.trim(),
                    extra: document.getElementById('edit-m-extra').value.trim()
                };

                o.price = parseFloat(document.getElementById('edit-order-price').value) || 0;
                o.deposit = parseFloat(document.getElementById('edit-order-deposit').value) || 0;
                o.date = document.getElementById('edit-order-date').value;
                o.notes = document.getElementById('edit-order-notes').value;
                saveData();
                renderOrders();
                renderArchive();
                renderFinancials();
                closeEditOrderModal();
                showAlert('✅ تم تعديل الطلبية والقياسات بنجاح!');
            }
        }

        function deleteOrder(id) {
            if (showConfirm('حذف هذه الطلبية؟')) {
                orders = orders.filter(o => o.id !== id);
                saveData();
                renderOrders();
                renderArchive();
                renderFinancials();
                updateGlobalStats();
            }
        }

        function renderOrders() {
            const container = document.getElementById('orders-container');
            const activeOrders = orders.filter(o => o.status === 'active').sort((a, b) => {
                const aHasDeliveryDate = Boolean(a.date);
                const bHasDeliveryDate = Boolean(b.date);
                if (aHasDeliveryDate && !bHasDeliveryDate) return -1;
                if (!aHasDeliveryDate && bHasDeliveryDate) return 1;
                if (aHasDeliveryDate && bHasDeliveryDate) {
                    const dateDifference = String(a.date).localeCompare(String(b.date));
                    if (dateDifference !== 0) return dateDifference;
                }
                const aCreated = Date.parse(a.createdAt || '') || Number(a.id) || 0;
                const bCreated = Date.parse(b.createdAt || '') || Number(b.id) || 0;
                return aCreated - bCreated;
            });
            document.getElementById('orders-count-badge').innerText = `${activeOrders.length} طلبية نشطة`;

            if (activeOrders.length === 0) {
                container.innerHTML = `<p class="text-center text-slate-400 text-xs py-6">لا توجد طلبيات نشطة حالياً.</p>`;
                return;
            }

            container.innerHTML = activeOrders.map(o => {
                const am = o.apparelMeasurements || {};
                const hasApparel = am.len || am.chest || am.waist || am.hips || am.shoulders || am.extra;
                
                let apparelHtml = '';
                if (hasApparel) {
                    apparelHtml = `
                        <div class="bg-rose-50/70 p-2 rounded-xl border border-rose-200 text-[11px] space-y-1">
                            <span class="font-bold text-rose-900 block">👗 قياسات مجال الألبسة:</span>
                            <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-700">
                                ${am.len ? `<div>الطول الكلي: <b>${am.len} سم</b></div>` : ''}
                                ${am.neck ? `<div>طول الرقبة: <b>${am.neck} سم</b></div>` : ''}
                                ${am.shoulders ? `<div>عرض الكتفين: <b>${am.shoulders} سم</b></div>` : ''}
                                ${am.btwnBust ? `<div>طول بين النهدين: <b>${am.btwnBust} سم</b></div>` : ''}
                                ${am.chest ? `<div>محيط الصدر: <b>${am.chest} سم</b></div>` : ''}
                                ${am.underChest ? `<div>محيط تحت الصدر: <b>${am.underChest} سم</b></div>` : ''}
                                ${am.waist ? `<div>محيط الخصر: <b>${am.waist} سم</b></div>` : ''}
                                ${am.chestCut ? `<div>طول قصة الصدر: <b>${am.chestCut} سم</b></div>` : ''}
                                ${am.hips ? `<div>محيط الورك: <b>${am.hips} سم</b></div>` : ''}
                                ${am.hipHeight ? `<div>ارتفاع الورك: <b>${am.hipHeight} سم</b></div>` : ''}
                                ${am.armLen ? `<div>طول الذراع: <b>${am.armLen} سم</b></div>` : ''}
                                ${am.bicep ? `<div>عرض الزندة: <b>${am.bicep} سم</b></div>` : ''}
                                ${am.wrist ? `<div>دوران المعصم: <b>${am.wrist} سم</b></div>` : ''}
                            </div>
                            ${am.extra ? `<div class="text-rose-800 pt-1 border-t border-rose-200">➕ قياس إضافي: <b>${am.extra}</b></div>` : ''}
                        </div>
                    `;
                }

                return `
                <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="font-bold text-slate-800">${o.clientName}</span>
                            <span class="text-[10px] text-slate-400 block">📞 ${o.phone} • ${o.state}</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🔵 قيد العمل</span>
                    </div>
                    <div class="bg-slate-50 p-2 rounded-xl space-y-1.5">
                        <div class="flex justify-between font-semibold"><span>🧵 ${o.item}</span><span>السعر الأصلي: ${o.price} دج</span></div>
                        ${Number(o.deposit || 0) > 0 ? `<div class="flex justify-end text-emerald-700 font-bold border-t border-slate-200 pt-1">يتبقى: ${Math.max(0, Number(o.price || 0) - Number(o.deposit || 0))} دج</div>` : ''}
                        ${apparelHtml}
                        ${orderImagesHtml(o)}
                        ${o.size ? `<div class="text-[11px] text-slate-700 whitespace-pre-line pt-1 border-t">📏 ملاحظات أخرى:<br>${o.size}</div>` : ''}
                        <div class="flex justify-between text-slate-600 pt-1"><span>العربون: ${o.deposit || 0} دج</span><span>التسليم: ${o.date || 'بدون تاريخ'}</span></div>
                        ${o.notes ? `<div class="text-[11px] text-slate-700 whitespace-pre-line pt-1 border-t">📝 ملاحظات: ${o.notes}</div>` : ''}
                    </div>
                    <div class="flex items-center justify-between pt-1 border-t">
                        <button onclick="markAsDelivered(${o.id})" class="bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded-xl shadow-sm">✨ تم التسليم للأرشيف</button>
                        <div class="flex gap-1">
                            <button onclick="openEditOrderModal(${o.id})" class="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">تعديل</button>
                            <button onclick="deleteOrder(${o.id})" class="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">حذف</button>
                        </div>
                    </div>
                </div>
            `;}).join('');
            if (window.lucide) lucide.createIcons();
            renderNotifications();
        }

        function renderArchive() {
            const container = document.getElementById('archive-container');
            const deliveredOrders = orders.filter(o => o.status === 'delivered');
            document.getElementById('archive-count-badge').innerText = `${deliveredOrders.length} أرشيف`;

            if (deliveredOrders.length === 0) {
                container.innerHTML = `<p class="text-center text-slate-400 text-xs py-6">الأرشيف فارغ حالياً.</p>`;
                return;
            }

            container.innerHTML = deliveredOrders.map(o => `
                <div class="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 shadow-sm space-y-1.5 text-xs">
                    <div class="flex justify-between items-center font-bold">
                        <span>✅ ${o.item} (${o.clientName})</span>
                        <span class="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">+${o.price} دج</span>
                    </div>
                    <div class="text-[10px] text-slate-500 flex justify-between">
                        <span>📞 ${o.phone}</span>
                        <span>موعد التسليم: ${o.date}</span>
                    </div>
                    ${orderImagesHtml(o)}
                    <div class="flex flex-wrap justify-end gap-1 pt-1">
                        ${(getOrderImages(o, 'fabric').length || getOrderImages(o, 'model').length) ? `<button onclick="deleteDeliveredOrderImages(${o.id})" class="text-amber-700 font-bold px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">🗑️ حذف الصور</button>` : ''}
                        <button onclick="openEditOrderModal(${o.id})" class="bg-white text-slate-700 px-2 py-1 rounded-lg border">تعديل</button>
                        <button onclick="deleteOrder(${o.id})" class="text-rose-600 font-bold px-2 py-1 bg-white border rounded-lg">حذف</button>
                    </div>
                </div>
            `).join('');
        }

        function getPricingInputs() {
            const goodsCost = Number(document.getElementById('pricing-goods-cost').value) || 0;
            const profitPercent = Number(document.getElementById('pricing-profit-percent').value) || 0;
            return { goodsCost, profitPercent };
        }

        function calculatePricingBreakdown() {
            const expenseIds = ['pricing-delivery', 'pricing-packaging', 'pricing-electricity', 'pricing-other-expense'];
            const additionalExpenses = expenseIds.reduce((sum, id) => sum + (Number(document.getElementById(id).value) || 0), 0);
            const cuttingMinutes = Number(document.getElementById('pricing-cutting-hours').value) || 0;
            const sewingMinutes = Number(document.getElementById('pricing-sewing-hours').value) || 0;
            const finishingMinutes = Number(document.getElementById('pricing-finishing-hours').value) || 0;
            const hourlyRate = Number(document.getElementById('pricing-hourly-rate').value) || 0;
            const totalMinutes = cuttingMinutes + sewingMinutes + finishingMinutes;
            const totalHours = totalMinutes / 60;
            const laborCost = totalHours * hourlyRate;
            const extraCost = additionalExpenses + laborCost;
            document.getElementById('pricing-extra-cost').value = extraCost.toFixed(2);
            document.getElementById('pricing-extra-expenses-total').innerText = `${additionalExpenses.toFixed(2)} دج`;
            document.getElementById('pricing-total-time').innerText = `${totalMinutes} دقيقة (${totalHours.toFixed(2)} ساعة)`;
            document.getElementById('pricing-labor-total').innerText = `${laborCost.toFixed(2)} دج`;
            return { additionalExpenses, cuttingMinutes, sewingMinutes, finishingMinutes, totalMinutes, totalHours, hourlyRate, laborCost, extraCost };
        }

        function calculatePricing() {
            const { goodsCost, profitPercent } = getPricingInputs();
            const breakdown = calculatePricingBreakdown();
            const { extraCost } = breakdown;
            const totalCost = goodsCost + extraCost;
            const netProfit = totalCost * (profitPercent / 100);
            const recommendedPrice = totalCost + netProfit;
            document.getElementById('pricing-total-cost').innerText = `${totalCost.toFixed(2)} دج`;
            document.getElementById('pricing-net-profit').innerText = `${netProfit.toFixed(2)} دج`;
            document.getElementById('pricing-recommended-price').innerText = `${recommendedPrice.toFixed(2)} دج`;
            return { goodsCost, ...breakdown, extraCost, profitPercent, totalCost, netProfit, recommendedPrice };
        }

        function setPricingProfit(percent) {
            document.getElementById('pricing-profit-percent').value = percent;
            calculatePricing();
        }

        function savePricingCalculation() {
            const result = calculatePricing();
            if (result.totalCost <= 0) return showValidationError('يرجى إدخال تكلفة السلع والمواد أو المصاريف الإضافية.');
            if (result.profitPercent < 0 || result.goodsCost < 0 || result.additionalExpenses < 0 || result.laborCost < 0) return showValidationError('يرجى إدخال قيم غير سالبة في الحاسبة.');
            pricingCalculations.unshift({ id: Date.now(), ...result, date: new Date().toISOString().split('T')[0] });
            if (saveData()) {
                renderPricingHistory();
                showAlert('✅ تم حفظ نتيجة التسعير بنجاح!');
            }
        }

        function renderPricingHistory() {
            const container = document.getElementById('pricing-history-container');
            if (!container) return;
            if (pricingCalculations.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = `<p class="text-[10px] text-slate-500 border-t pt-2">آخر نتائج التسعير المحفوظة:</p>` + pricingCalculations.slice(0, 5).map(item => `
                <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg border text-[10px]">
                    <span>${item.date} • تكلفة ${item.totalCost.toFixed(2)} دج • ربح ${item.profitPercent}%</span>
                    <strong class="text-purple-700">${item.recommendedPrice.toFixed(2)} دج</strong>
                </div>
            `).join('');
        }

        function saveCycleDates() {
            cycle.start = document.getElementById('cycle-start').value;
            cycle.end = document.getElementById('cycle-end').value;
            if (!cycle.start || !cycle.end) return showValidationError('يرجى إدخال تاريخي بداية ونهاية الشهر.');
            if (cycle.end < cycle.start) return showValidationError('يجب أن يكون تاريخ النهاية بعد تاريخ البداية.');
            saveData();
            renderFinancials();
        }

        function addExpense(e) {
            e.preventDefault();
            const title = document.getElementById('exp-title').value.trim();
            const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
            if (!title) return showValidationError('يرجى إدخال بيان المصروف.');
            if (!Number.isFinite(amount) || amount <= 0) return showValidationError('يرجى إدخال مبلغ مصروف أكبر من صفر.');

            expenses.push({ id: Date.now(), title, amount, date: new Date().toISOString().split('T')[0] });
            saveData();
            renderFinancials();
            e.target.reset();
            showAlert('✅ تمت إضافة المصروف بنجاح!');
        }

        function deleteExpense(id) {
            expenses = expenses.filter(ex => ex.id !== id);
            saveData();
            renderFinancials();
        }

        function archiveCurrentMonth() {
            if (!showConfirm('هل أنت متأكدة من إغلاق هذا الشهر المالي وأرشفته؟')) return;
            
            const deliveredOrders = orders.filter(o => o.status === 'delivered');
            const currentExpensesList = [...expenses];
            const totalIncome = deliveredOrders.reduce((sum, o) => sum + o.price, 0);
            const totalExpenses = currentExpensesList.reduce((sum, ex) => sum + ex.amount, 0);
            const netProfit = totalIncome - totalExpenses;

            financialArchives.unshift({
                id: Date.now(),
                period: `${cycle.start} إلى ${cycle.end}`,
                income: totalIncome,
                expenses: totalExpenses,
                netProfit: netProfit,
                ordersCount: deliveredOrders.length,
                archivedOrders: deliveredOrders,
                archivedExpenses: currentExpensesList
            });

            expenses = [];
            orders = orders.filter(o => o.status !== 'delivered');
            
            saveData();
            showAlert('🎉 تم أرشفة الشهر المالي بنجاح!');
        }

        function deleteFinancialArchive(id) {
            if (showConfirm('هل أنت متأكدة من حذف هذا الأرشيف الشهري نهائياً؟')) {
                financialArchives = financialArchives.filter(arc => arc.id !== id);
                saveData();
                renderFinancials();
                showAlert('🗑️ تم حذف الأرشيف بنجاح');
            }
        }

        function escapeArchiveText(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            }[character]));
        }

        function deleteFinancialArchivedOrderImages(archiveId, orderId) {
            const archive = financialArchives.find(entry => String(entry.id) === String(archiveId));
            if (!archive || !Array.isArray(archive.archivedOrders)) {
                return showValidationError('تعذر العثور على الطلبية داخل الأرشيف المالي.');
            }
            const archivedOrder = archive.archivedOrders.find(order => String(order.id) === String(orderId));
            if (!archivedOrder) return showValidationError('الطلبية غير موجودة في هذا الأرشيف.');

            const hasImages = order => getOrderImages(order, 'fabric').length || getOrderImages(order, 'model').length;
            if (!hasImages(archivedOrder)) return showAlert('لا توجد صور محفوظة في هذه الطلبية.');

            if (!window.confirm('سيتم حذف صور القماش والمودال نهائياً من جميع نسخ هذه الطلبية داخل الأرشيفات، مع الاحتفاظ بمعلومات الزبونة والقياسات والأسعار والأرباح والملاحظات. هل تريدين المتابعة؟')) return;

            const targetId = String(archivedOrder.id);
            let updatedCopies = 0;
            const clearImages = order => {
                if (!order || String(order.id) !== targetId) return;
                order.fabricImages = [];
                order.modelImages = [];
                order.fabricImage = '';
                order.modelImage = '';
                order.imagesDeletedAt = new Date().toISOString();
                updatedCopies++;
            };

            // حدّث نسخة الطلبية في قائمة الطلبيات إن كانت ما تزال موجودة.
            orders.forEach(clearImages);
            // حدّث كل النسخ الموجودة في جميع الأرشيفات المالية، وليس الأرشيف المفتوح فقط.
            financialArchives.forEach(entry => {
                if (Array.isArray(entry.archivedOrders)) entry.archivedOrders.forEach(clearImages);
            });

            if (!updatedCopies) return showValidationError('لم يتم العثور على نسخة قابلة للتحديث.');

            const saved = saveData();
            renderArchive();
            renderFinancials();
            viewArchiveDetails(archiveId);
            if (saved) {
                showAlert('🗑️ تم حذف صور الطلبية من جميع نسخها المحفوظة، مع الاحتفاظ بباقي المعلومات.');
            } else {
                showAlert('⚠️ تم تحديث الصور محلياً، لكن تعذر تأكيد الحفظ المعتاد. تحققي من النسخة الاحتياطية والمزامنة قبل إغلاق التطبيق.');
            }
        }

        function viewArchiveDetails(id) {
            const arc = financialArchives.find(a => String(a.id) === String(id));
            if (!arc) return;

            const modalContent = document.getElementById('archive-modal-content');
            const archivedOrders = Array.isArray(arc.archivedOrders) ? arc.archivedOrders : [];
            const ordersHtml = archivedOrders.length ? archivedOrders.map(order => {
                const orderId = Number(order.id);
                const canDeleteImages = Number.isFinite(orderId) && (getOrderImages(order, 'fabric').length || getOrderImages(order, 'model').length);
                return `<article class="bg-slate-50 p-2.5 rounded-xl border mb-2 space-y-1.5">
                    <div class="flex justify-between items-start gap-2"><b>${escapeArchiveText(order.item || 'طلبية')}</b><span class="font-bold text-emerald-700">${escapeArchiveText(order.price ?? 0)} دج</span></div>
                    <div class="text-slate-600">الزبونة: ${escapeArchiveText(order.clientName || '—')}</div>
                    <div class="text-slate-500">الهاتف: ${escapeArchiveText(order.phone || '—')} • التسليم: ${escapeArchiveText(order.date || 'بدون تاريخ')}</div>
                    ${Number(order.deposit || 0) ? `<div>العربون: ${escapeArchiveText(order.deposit)} دج</div>` : ''}
                    ${order.size ? `<div class="whitespace-pre-line">القياسات/التفاصيل: ${escapeArchiveText(order.size)}</div>` : ''}
                    ${order.notes ? `<div class="whitespace-pre-line">ملاحظات: ${escapeArchiveText(order.notes)}</div>` : ''}
                    ${orderImagesHtml(order)}
                    ${canDeleteImages ? `<div class="flex justify-end pt-1"><button type="button" onclick="deleteFinancialArchivedOrderImages(${Number(arc.id)}, ${orderId})" class="text-amber-800 font-bold px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">🗑️ حذف صور هذه الطلبية</button></div>` : `<div class="text-[10px] text-slate-400">${order.imagesDeletedAt ? 'تم حذف الصور سابقاً' : 'لا توجد صور لهذه الطلبية'}</div>`}
                </article>`;
            }).join('') : '<p class="text-slate-400">لا توجد طلبيات مسجلة في هذا الشهر.</p>';

            const archivedExpenses = Array.isArray(arc.archivedExpenses) ? arc.archivedExpenses : [];
            const expensesHtml = archivedExpenses.length ? archivedExpenses.map(ex => `<div class="bg-rose-50/50 p-2 rounded-lg border mb-1"><b>${escapeArchiveText(ex.title)}</b> (-${escapeArchiveText(ex.amount)} دج)</div>`).join('') : '<p class="text-slate-400">لا توجد مصاريف مسجلة في هذا الشهر.</p>';

            modalContent.innerHTML = `
                <div class="bg-rose-50 p-3 rounded-xl border border-rose-100 mb-2">
                    <b>📅 فترة الأرشيف:</b> ${escapeArchiveText(arc.period)}<br>
                    <b>💰 الإجمالي:</b> مداخيل (${escapeArchiveText(arc.income)} دج) | مصاريف (${escapeArchiveText(arc.expenses)} دج)<br>
                    <b>✨ الربح الصافي:</b> <span class="text-emerald-700 font-bold">${escapeArchiveText(arc.netProfit)} دج</span>
                </div>
                <h4 class="font-bold text-slate-700 mt-2">📦 الطلبيات المسلمة في هذه الفترة (${archivedOrders.length}):</h4>
                <div class="max-h-72 overflow-y-auto space-y-1">${ordersHtml}</div>
                <h4 class="font-bold text-slate-700 mt-3">💸 المصاريف المسجلة في هذه الفترة:</h4>
                <div class="max-h-36 overflow-y-auto space-y-1">${expensesHtml}</div>
            `;
            document.getElementById('archive-details-modal').classList.remove('hidden');
        }

        function closeArchiveDetailsModal() {
            document.getElementById('archive-details-modal').classList.add('hidden');
        }

        function renderFinancials() {
            let totalIncome = 0;
            orders.filter(o => o.status === 'delivered').forEach(o => { totalIncome += o.price; });
            let totalExpenses = expenses.reduce((sum, ex) => sum + ex.amount, 0);
            let netProfit = totalIncome - totalExpenses;

            document.getElementById('cycle-income').innerText = `${totalIncome} دج`;
            document.getElementById('cycle-expenses').innerText = `${totalExpenses} دج`;
            document.getElementById('cycle-net-profit').innerText = `${netProfit} دج`;
            const monthlyProfit = document.getElementById('stat-monthly-profit');
            if (monthlyProfit) monthlyProfit.innerText = `${netProfit} دج`;

            const expContainer = document.getElementById('expenses-container');
            if (expenses.length === 0) {
                expContainer.innerHTML = `<p class="text-[11px] text-slate-400 py-1">لا توجد مصاريف مسجلة لهذا الشهر.</p>`;
            } else {
                expContainer.innerHTML = expenses.map(ex => `
                    <div class="flex justify-between items-center bg-white p-2 rounded-xl border text-xs">
                        <div><b>${ex.title}</b><span class="text-[10px] text-slate-400 block">${ex.date}</span></div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-rose-600">-${ex.amount} دج</span>
                            <button onclick="deleteExpense(${ex.id})" class="text-rose-500 font-bold px-1.5 py-0.5 bg-rose-50 rounded">حذف</button>
                        </div>
                    </div>
                `).join('');
            }

            const archContainer = document.getElementById('financial-history-container');
            if (financialArchives.length === 0) {
                archContainer.innerHTML = `<p class="text-center text-slate-400 text-xs py-3">لا توجد شهور مؤرشفة بعد.</p>`;
                return;
            }
            archContainer.innerHTML = financialArchives.map(arc => `
                <div class="bg-slate-50 p-3 rounded-xl border space-y-1.5">
                    <div class="font-bold text-rose-900 flex justify-between items-center">
                        <span>📁 فترة الشهر: ${arc.period}</span>
                        <button onclick="deleteFinancialArchive(${arc.id})" class="text-rose-600 bg-white border px-2 py-0.5 rounded text-[10px] font-bold">حذف الأرشيف</button>
                    </div>
                    <div class="text-[11px] text-slate-600 flex justify-between">
                        <span>المداخيل: ${arc.income} دج</span>
                        <span>المصاريف: ${arc.expenses} دج</span>
                    </div>
                    <div class="flex justify-between items-center pt-1 border-t">
                        <span class="text-emerald-700 font-bold text-xs">الربح الصافي: ${arc.netProfit} دج (${arc.ordersCount} طلبية)</span>
                        <button onclick="viewArchiveDetails(${arc.id})" class="bg-rose-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold">🔍 عرض التفاصيل</button>
                    </div>
                </div>
            `).join('');
        }

        function toggleAddGoalModal() { document.getElementById('add-goal-modal').classList.toggle('hidden'); }
        function addNewGoal(e) {
            e.preventDefault();
            const title = document.getElementById('goal-title').value.trim();
            const targetValue = document.getElementById('goal-target').value;
            const currentValue = document.getElementById('goal-current').value;
            if (!title) return showValidationError('يرجى إدخال اسم الهدف.');
            if (!targetValue || !isNonNegativeNumber(targetValue) || Number(targetValue) <= 0) return showValidationError('يرجى إدخال مبلغ مطلوب أكبر من صفر.');
            if (currentValue !== '' && !isNonNegativeNumber(currentValue)) return showValidationError('يرجى إدخال مبلغ متوفر صحيح غير سالب.');
            goals.push({ id: Date.now(), title, target: Number(targetValue), current: Number(currentValue) || 0 });
            saveData(); renderGoals(); toggleAddGoalModal(); e.target.reset();
        }
        function deleteGoal(id) { goals = goals.filter(g => g.id !== id); saveData(); renderGoals(); }
        function completeGoal(id) { const g = goals.find(item => item.id === id); if(g) { g.current = g.target; saveData(); renderGoals(); showAlert('🎉 مبروك إنجاز الهدف!'); } }
        function openEditGoalModal(id) {
            const g = goals.find(item => item.id === id);
            if (!g) return;
            document.getElementById('edit-goal-id').value = g.id;
            document.getElementById('edit-goal-title').value = g.title;
            document.getElementById('edit-goal-target').value = g.target;
            document.getElementById('edit-goal-current').value = g.current;
            document.getElementById('edit-goal-modal').classList.remove('hidden');
        }
        function closeEditGoalModal() { document.getElementById('edit-goal-modal').classList.add('hidden'); }
        function saveGoalEdit(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('edit-goal-id').value);
            const g = goals.find(item => item.id === id);
            if (g) {
                const title = document.getElementById('edit-goal-title').value.trim();
                const targetValue = document.getElementById('edit-goal-target').value;
                const currentValue = document.getElementById('edit-goal-current').value;
                if (!title) return showValidationError('يرجى إدخال اسم الهدف.');
                if (!targetValue || !isNonNegativeNumber(targetValue) || Number(targetValue) <= 0) return showValidationError('يرجى إدخال مبلغ مطلوب أكبر من صفر.');
                if (!isNonNegativeNumber(currentValue)) return showValidationError('يرجى إدخال مبلغ متوفر صحيح غير سالب.');
                g.title = title;
                g.target = Number(targetValue);
                g.current = Number(currentValue);
                saveData(); renderGoals(); closeEditGoalModal();
            }
        }
        function renderGoals() {
            const container = document.getElementById('goals-container');
            container.innerHTML = goals.map(g => {
                const percent = Math.min(100, Math.round((g.current / g.target) * 100)) || 0;
                const isCompleted = percent >= 100;
                return `
                <div class="bg-white p-3.5 rounded-2xl border ${isCompleted ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'} shadow-sm space-y-2 text-xs">
                    <div class="flex justify-between items-center font-bold">
                        <span>${g.title}</span>
                        <span class="${isCompleted ? 'text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]' : 'text-emerald-600'}">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div class="bg-emerald-500 h-2" style="width:${percent}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-[10px] text-slate-500">
                        <span>وفرت: ${g.current} من ${g.target} دج</span>
                        <div class="flex gap-1">
                            ${!isCompleted ? `<button onclick="completeGoal(${g.id})" class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">تم الإنجاز</button>` : '<span class="text-emerald-700 font-bold">✨ منجز</span>'}
                            <button onclick="openEditGoalModal(${g.id})" class="bg-slate-100 px-2 py-1 rounded-lg">تعديل</button>
                            <button onclick="deleteGoal(${g.id})" class="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">حذف</button>
                        </div>
                    </div>
                </div>
            `;}).join('');
            if (window.lucide) lucide.createIcons();
        }

        function toggleAddSupplyModal() { document.getElementById('add-supply-modal').classList.toggle('hidden'); }
        function addCustomSupply(e) {
            e.preventDefault();
            const name = document.getElementById('modal-sup-name').value.trim();
            const quantityValue = document.getElementById('modal-sup-qty').value;
            if (!name) return showValidationError('يرجى إدخال اسم القماش.');
            if (!quantityValue || !isNonNegativeNumber(quantityValue) || Number(quantityValue) <= 0) return showValidationError('يرجى إدخال كمية أكبر من صفر.');
            supplies.push({ id: Date.now(), name, qty: Number(quantityValue), unit: document.getElementById('modal-sup-unit').value });
            saveData(); renderSupplies(); toggleAddSupplyModal(); e.target.reset();
        }
        function addPresetSupply(name) {
            let found = supplies.find(s => s.name === name);
            if (found) found.qty += 5; else supplies.push({ id: Date.now(), name, qty: 5, unit: 'قطعة' });
            saveData(); renderSupplies();
            showAlert(`✅ تمت إضافة ${name} إلى المخزون بكمية 5 قطع.`);
        }

        function addPresetSupplyFromCatalog(index) {
            const item = supplyCatalog[index];
            if (item) addPresetSupply(item);
        }

        function toggleSupplyCatalogModal() {
            document.getElementById('supply-catalog-modal').classList.toggle('hidden');
            renderSupplyCatalog();
        }

        function addCatalogItem(e) {
            e.preventDefault();
            const name = document.getElementById('catalog-item-name').value.trim();
            if (!name) return showValidationError('يرجى كتابة اسم السلعة.');
            if (supplyCatalog.some(item => item.toLowerCase() === name.toLowerCase())) return showValidationError('هذه السلعة موجودة مسبقًا في القائمة.');
            supplyCatalog.push(name);
            purchasedCatalogItems[name] = false;
            saveData();
            renderSupplyCatalog();
            e.target.reset();
        }

        function editCatalogItem(index) {
            const oldName = supplyCatalog[index];
            if (!oldName) return;
            const newName = showPrompt('عدّلي اسم السلعة:', oldName);
            if (!newName || !newName.trim()) return;
            const cleanedName = newName.trim();
            if (supplyCatalog.some((item, itemIndex) => itemIndex !== index && item.toLowerCase() === cleanedName.toLowerCase())) return showValidationError('هذه السلعة موجودة مسبقًا في القائمة.');
            supplyCatalog[index] = cleanedName;
            purchasedCatalogItems[cleanedName] = Boolean(purchasedCatalogItems[oldName]);
            delete purchasedCatalogItems[oldName];
            saveData();
            renderSupplyCatalog();
        }

        function toggleCatalogPurchased(index, isPurchased) {
            const item = supplyCatalog[index];
            if (!item) return;
            purchasedCatalogItems[item] = isPurchased;
            saveData();
            renderSupplyCatalog();
        }

        function deleteCatalogItem(index) {
            if (!showConfirm('حذف هذه السلعة من القائمة؟')) return;
            const item = supplyCatalog[index];
            supplyCatalog.splice(index, 1);
            delete purchasedCatalogItems[item];
            saveData();
            renderSupplyCatalog();
        }

        function renderSupplyCatalog() {
            const container = document.getElementById('supply-catalog-container');
            if (!container) return;
            if (supplyCatalog.length === 0) {
                container.innerHTML = '<p class="text-center text-slate-400 py-3">القائمة فارغة. أضيفي سلعة جديدة.</p>';
                return;
            }
            container.innerHTML = supplyCatalog.map((item, index) => {
                const safeItem = item.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
                const isPurchased = Boolean(purchasedCatalogItems[item]);
                return `
                <div class="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border text-xs">
                    <label class="flex items-center gap-2 min-w-0 ${isPurchased ? 'line-through text-slate-400' : 'text-slate-700'}">
                        <input type="checkbox" ${isPurchased ? 'checked' : ''} onchange="toggleCatalogPurchased(${index}, this.checked)" class="w-4 h-4 accent-emerald-500">
                        <span class="font-semibold truncate">🧵 ${safeItem}</span>
                    </label>
                    <div class="flex gap-1">
                        <button type="button" onclick="addPresetSupplyFromCatalog(${index})" class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">إضافة للمخزون</button>
                        <button type="button" onclick="editCatalogItem(${index})" class="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">تعديل</button>
                        <button type="button" onclick="deleteCatalogItem(${index})" class="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg font-bold">حذف</button>
                    </div>
                </div>
            `;
            }).join('');
        }
        function isValidQuantityText(value) {
            return String(value ?? '').trim().length > 0 && String(value).trim().length <= 80;
        }

        function readInventoryImage(inputId) {
            const file = document.getElementById(inputId)?.files?.[0];
            if (!file) return Promise.resolve('');
            if (!file.type.startsWith('image/')) return Promise.reject(new Error('يرجى اختيار صورة صحيحة للمنتج.'));
            return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('تعذر قراءة صورة المنتج.')); reader.readAsDataURL(file); });
        }

        function previewInventoryImage(input, previewId) {
            const preview = document.getElementById(previewId); const file = input.files?.[0];
            if (!file) { preview?.classList.add('hidden'); return; }
            if (!file.type.startsWith('image/')) { input.value = ''; return showValidationError('يرجى اختيار صورة فقط.'); }
            preview.src = URL.createObjectURL(file); preview.classList.remove('hidden');
        }

        async function addInventoryProduct(e) {
            e.preventDefault();
            const name = document.getElementById('inventory-product-name').value.trim();
            const type = document.getElementById('inventory-product-type').value.trim();
            const qty = document.getElementById('inventory-product-qty').value;
            const price = document.getElementById('inventory-product-price').value;
            if (!name) return showValidationError('يرجى إدخال اسم المنتج.');
            if (!isValidQuantityText(qty)) return showValidationError('يرجى إدخال الكمية بالأرقام أو بالحروف، مثل: 5 قطع أو مترين.');
            if (price !== '' && !isNonNegativeNumber(price)) return showValidationError('يرجى إدخال سعر صحيح غير سالب.');
            try {
                const [image, image2] = await Promise.all([readInventoryImage('inventory-product-image'), readInventoryImage('inventory-product-image-2')]);
                inventoryProducts.unshift({ id: Date.now(), name, type, quantity: String(qty).trim(), price: Number(price || 0), image, image2, notes: document.getElementById('inventory-product-notes').value.trim(), createdAt: new Date().toISOString() });
                saveData(); renderInventoryProducts(); e.target.reset();
                document.querySelectorAll('#inventory-image-preview, #inventory-image-preview-2').forEach(img => { img.removeAttribute('src'); img.classList.add('hidden'); });
                showAlert('✅ تمت إضافة المنتج إلى الجرد.');
            } catch (error) { showValidationError(error.message || 'تعذر حفظ المنتج.'); }
        }

        function editInventoryProduct(id) {
            const product = inventoryProducts.find(item => item.id === id); if (!product) return;
            document.getElementById('edit-inventory-id').value = product.id;
            document.getElementById('edit-inventory-name').value = product.name || '';
            document.getElementById('edit-inventory-type').value = product.type || '';
            document.getElementById('edit-inventory-quantity').value = product.quantity ?? '';
            document.getElementById('edit-inventory-price').value = product.price ?? '';
            document.getElementById('edit-inventory-notes').value = product.notes || '';
            const previews = [['edit-inventory-image-preview', product.image], ['edit-inventory-image-2-preview', product.image2]];
            previews.forEach(([id, src]) => { const image = document.getElementById(id); image.src = src || ''; image.classList.toggle('hidden', !src); });
            document.getElementById('edit-inventory-modal').classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function closeEditInventoryModal() { document.getElementById('edit-inventory-modal')?.classList.add('hidden'); }

        function readImageInput(inputId, keepValue = '') {
            const file = document.getElementById(inputId)?.files?.[0];
            if (!file) return Promise.resolve(keepValue);
            if (!file.type.startsWith('image/')) return Promise.reject(new Error('يرجى اختيار صورة صحيحة.'));
            return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('تعذر قراءة الصورة.')); reader.readAsDataURL(file); });
        }

        async function saveInventoryEdit(e) {
            e.preventDefault();
            const id = Number(document.getElementById('edit-inventory-id').value);
            const product = inventoryProducts.find(item => item.id === id); if (!product) return;
            const name = document.getElementById('edit-inventory-name').value.trim(); const quantity = document.getElementById('edit-inventory-quantity').value; const price = document.getElementById('edit-inventory-price').value;
            if (!name) return showValidationError('يرجى إدخال اسم المنتج.');
            if (!isValidQuantityText(quantity)) return showValidationError('يرجى إدخال الكمية بالأرقام أو بالحروف.');
            if (price !== '' && !isNonNegativeNumber(price)) return showValidationError('يرجى إدخال سعر صحيح غير سالب.');
            try {
                const [image, image2] = await Promise.all([readImageInput('edit-inventory-image', product.image || ''), readImageInput('edit-inventory-image-2', product.image2 || '')]);
                Object.assign(product, { name, type: document.getElementById('edit-inventory-type').value.trim(), quantity: String(quantity).trim(), price: Number(price || 0), image, image2, notes: document.getElementById('edit-inventory-notes').value.trim() });
                saveData(); renderInventoryProducts(); closeEditInventoryModal(); showAlert('✅ تم تعديل كل تفاصيل المنتج.');
            } catch (error) { showValidationError(error.message || 'تعذر حفظ التعديلات.'); }
        }

        function deleteInventoryProduct(id) {
            if (!showConfirm('هل تريدين حذف هذا المنتج من الجرد؟')) return;
            inventoryProducts = inventoryProducts.filter(product => product.id !== id); saveData(); renderInventoryProducts();
        }

        function renderInventoryProducts() {
            const container = document.getElementById('inventory-products-container'); if (!container) return;
            if (!inventoryProducts.length) { container.innerHTML = '<div class="inventory-empty">لم تتم إضافة منتجات للجرد بعد.</div>'; return; }
            container.innerHTML = inventoryProducts.map(product => {
                const safe = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
                return `<article class="inventory-product-card"><div class="inventory-product-media">${product.image ? `<img src="${product.image}" alt="${safe(product.name)}">` : '<span>لا توجد صورة</span>'}${product.image2 ? `<img src="${product.image2}" alt="${safe(product.name)}">` : ''}</div><div class="inventory-product-info"><div class="flex justify-between gap-2"><h3>${safe(product.name)}</h3><div class="flex gap-2"><button type="button" onclick="editInventoryProduct(${product.id})" class="text-sky-600 text-[10px]">تعديل</button><button type="button" onclick="deleteInventoryProduct(${product.id})" class="text-rose-600 text-[10px]">حذف</button></div></div><p>${safe(product.type) || 'نوع غير محدد'}</p><div class="inventory-product-meta"><span>الكمية: ${product.quantity}</span><span>السعر: ${product.price} دج</span></div>${product.notes ? `<p class="inventory-notes">${safe(product.notes).replace(/\n/g,'<br>')}</p>` : ''}</div></article>`;
            }).join('');
        }

        function toggleShoppingForm() { document.getElementById('shopping-item-form')?.classList.toggle('hidden'); }

        function readShoppingImage() {
            const file = document.getElementById('shopping-item-image')?.files?.[0];
            if (!file) return Promise.resolve('');
            if (!file.type.startsWith('image/')) return Promise.reject(new Error('يرجى اختيار صورة صحيحة للسلعة.'));
            return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('تعذر قراءة صورة السلعة.')); reader.readAsDataURL(file); });
        }

        async function addShoppingItem(e) {
            e.preventDefault();
            const name = document.getElementById('shopping-item-name').value.trim(); const quantity = document.getElementById('shopping-item-qty').value;
            if (!name) return showValidationError('يرجى إدخال اسم السلعة.');
            if (!isValidQuantityText(quantity)) return showValidationError('يرجى إدخال الكمية بالأرقام أو بالحروف، مثل: 5 قطع أو مترين.');
            try { const image = await readShoppingImage(); shoppingItems.unshift({ id: Date.now(), name, quantity: String(quantity).trim(), image, purchased: false }); saveData(); renderShoppingItems(); e.target.reset(); e.target.classList.add('hidden'); } catch (error) { showValidationError(error.message); }
        }

        function editShoppingItem(id) {
            const item = shoppingItems.find(entry => entry.id === id); if (!item) return;
            document.getElementById('edit-shopping-id').value = item.id;
            document.getElementById('edit-shopping-name').value = item.name || '';
            document.getElementById('edit-shopping-quantity').value = item.quantity ?? '';
            const preview = document.getElementById('edit-shopping-image-preview'); preview.src = item.image || ''; preview.classList.toggle('hidden', !item.image);
            document.getElementById('edit-shopping-modal').classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        function closeEditShoppingModal() { document.getElementById('edit-shopping-modal')?.classList.add('hidden'); }

        async function saveShoppingEdit(e) {
            e.preventDefault();
            const id = Number(document.getElementById('edit-shopping-id').value); const item = shoppingItems.find(entry => entry.id === id); if (!item) return;
            const name = document.getElementById('edit-shopping-name').value.trim(); const quantity = document.getElementById('edit-shopping-quantity').value.trim();
            if (!name) return showValidationError('يرجى إدخال اسم السلعة.');
            if (!isValidQuantityText(quantity)) return showValidationError('يرجى إدخال الكمية بالأرقام أو بالحروف.');
            try {
                const image = await readImageInput('edit-shopping-image', item.image || '');
                item.name = name; item.quantity = quantity; item.image = image; saveData(); renderShoppingItems(); closeEditShoppingModal(); showAlert('✅ تم تعديل كل تفاصيل السلعة.');
            } catch (error) { showValidationError(error.message || 'تعذر حفظ التعديلات.'); }
        }

        function deleteShoppingItem(id) { if (!showConfirm('حذف هذه السلعة من قائمة المشتريات؟')) return; shoppingItems = shoppingItems.filter(item => item.id !== id); saveData(); renderShoppingItems(); }

        function renderShoppingItems() {
            const container = document.getElementById('shopping-list-container'); if (!container) return;
            if (!shoppingItems.length) { container.innerHTML = '<div class="shopping-empty">قائمة المشتريات فارغة.</div>'; return; }
            container.innerHTML = shoppingItems.map(item => { const safe = String(item.name).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); return `<div class="shopping-item ${item.purchased ? 'purchased' : ''}">${item.image ? `<img src="${item.image}" alt="${safe}">` : '<span class="shopping-no-image">—</span>'}<div class="shopping-item-main"><strong>${safe}</strong><span>الكمية: ${item.quantity}</span></div><div class="flex gap-1"><button type="button" onclick="editShoppingItem(${item.id})" class="text-sky-600 text-[10px]">تعديل</button><button type="button" onclick="deleteShoppingItem(${item.id})" class="text-rose-600 text-[10px]">حذف</button></div></div>`; }).join('');
        }

        function renderSupplies() {
            const container = document.getElementById('supplies-container');
            if (!container) return;
            container.innerHTML = supplies.map(s => `
                <div class="bg-white p-2.5 rounded-xl border flex justify-between items-center text-xs">
                    <span class="font-bold text-slate-700">🧵 ${s.name}</span>
                    <span class="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">${s.qty} ${s.unit}</span>
                </div>
            `).join('');
        }

        function updateGlobalStats() {
            const active = document.getElementById('stat-active-orders'); const total = document.getElementById('stat-total-clients');
            if (active) active.innerText = orders.filter(o => o.status === 'active').length;
            if (total) total.innerText = clients.length;
        }

        function saveData(syncCloud = true) {
            try {
                localStorage.setItem(storageKey('momprenuer_orders'), JSON.stringify(orders));
                localStorage.setItem(storageKey('momprenuer_clients'), JSON.stringify(clients));
                localStorage.setItem(storageKey('momprenuer_supplies'), JSON.stringify(supplies));
                localStorage.setItem(storageKey('momprenuer_inventory_products'), JSON.stringify(inventoryProducts));
                localStorage.setItem(storageKey('momprenuer_shopping_items'), JSON.stringify(shoppingItems));
                localStorage.setItem(storageKey('momprenuer_workshop_logo'), JSON.stringify(workshopLogo));
                localStorage.setItem(storageKey('momprenuer_language'), JSON.stringify(appLanguage));
                localStorage.setItem(storageKey('momprenuer_currency'), JSON.stringify(appCurrency));
                localStorage.setItem(storageKey('momprenuer_goals'), JSON.stringify(goals));
                localStorage.setItem(storageKey('momprenuer_expenses'), JSON.stringify(expenses));
                localStorage.setItem(storageKey('momprenuer_fin_archives'), JSON.stringify(financialArchives));
                localStorage.setItem(storageKey('momprenuer_cycle'), JSON.stringify(cycle));
                localStorage.setItem(storageKey('momprenuer_pricing_calculations'), JSON.stringify(pricingCalculations));
                localStorage.setItem(storageKey('momprenuer_supply_catalog'), JSON.stringify(supplyCatalog));
                localStorage.setItem(storageKey('momprenuer_supply_purchased'), JSON.stringify(purchasedCatalogItems));
                localStorage.setItem(storageKey('momprenuer_theme'), JSON.stringify(selectedTheme));
                if (syncCloud && activeUid) markLocalSyncPending();
                if (activeUid) clearLocalBackup(activeUid);
                if (syncCloud && window.firebaseSyncAppData && firebaseUser) window.firebaseSyncAppData(getAppDataSnapshot());
                if (appLanguage !== 'ar') setTimeout(() => applyAppLocale(), 0);
                return true;
            } catch (error) {
                try { if (activeUid) markLocalSyncPending(); } catch (pendingError) {}
                saveLocalBackup(activeUid, getAppDataSnapshot()).then(ok => {
                    if (!ok) showAlert('❌ تعذر حفظ البيانات حتى في النسخة الاحتياطية. صدّري نسخة احتياطية ثم حرّري مساحة التخزين.');
                });
                return false;
            }
        }
