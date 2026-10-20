const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const sdk = require('node-appwrite');
const multer = require('multer');
const nodemailer = require('nodemailer');
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const TELEGRAM_BOT_TOKEN = "8648773186:AAGLHfByEK9MLK2RLyTRba0ueMOm-_CVjZg";
const TELEGRAM_CHAT_ID = "6421195166";

const APPWRITE_ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6ab515b9001e7d7449c5";
const APPWRITE_DATABASE_ID = "6ab519d80034353d5df2";
const APPWRITE_COLLECTION_ID = "6ab51a140031dad7faae";
const BUCKET_ID = "6ab520510014648e7ddd";
const APPWRITE_API_KEY = "standard_c2d9a345c958d2d77792d94a22ffb1300f457a049abfc174115cca636d5c1f7945596ba5b55a314dc18da8519d8ebed21083a7f0ab913830d2b6fd914af626aa69a48676321e356ccdad1f6cad821acec32dceb5520b7938ee665bcbfb22389cc216dc7014a89b241d5cabbc2f46630b4da170d5673626c78427e5964f8ce43e";

const client = new sdk.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID).setKey(APPWRITE_API_KEY);
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'emonkazi799@gmail.com', 
        pass: 'tnnc pfqa zxwn rlzr'    
    }
});

app.post('/send-task-to-telegram', upload.array('images'), async (req, res) => {
    try {
        const { userUid, documentId, fieldName } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: 'Kono chobi paowa jayni!' });
        }

        const batchId = 'BATCH_' + Date.now().toString().slice(-6);
        const targetField = fieldName || 'button5'; 
        let sentMessageIds = [];
        let storageFileIds = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const inputFile = sdk.InputFile.fromBuffer(file.buffer, file.originalname);
                const storageRes = await storage.createFile(BUCKET_ID, sdk.ID.unique(), inputFile);
                storageFileIds.push(storageRes.$id);
            } catch (storageErr) {
                console.error("Storage Error:", storageErr);
            }

            const telegramFormData = new (require('form-data'))();
            telegramFormData.append('chat_id', TELEGRAM_CHAT_ID);
            telegramFormData.append('photo', file.buffer, { filename: file.originalname });
            
            const captionText = `🚨 Notun Task Submit Hoyeche!\n\n` +
                                `🆔 <b>Document ID:</b> <code>${documentId}</code>\n` +
                                `👤 <b>User Name:</b> ${userUid}\n` +
                                `🏷️ <b>Batch ID:</b> <code>${batchId}</code>\n` +
                                `📌 <b>Field Name:</b> <code>${targetField} (pending)</code>\n` +
                                `🖼️ <b>Image:</b> (${i + 1} / ${files.length})`;
            
            telegramFormData.append('caption', captionText);
            telegramFormData.append('parse_mode', 'HTML');

            const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                body: telegramFormData
            });
            const tgData = await tgRes.json();
            if (tgData.ok && tgData.result.message_id) {
                sentMessageIds.push(tgData.result.message_id);
            }
        }

        try {
            await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_ID, documentId, {
                [targetField]: "pending",
                telegramMsgIds: JSON.stringify(sentMessageIds),
                taskImageIds: JSON.stringify(storageFileIds)
            });
        } catch (dbErr) {
            console.error('Appwrite Database Update Error:', dbErr);
        }

        res.json({ success: true, batchId: batchId });
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/admin-task-action', async (req, res) => {
    try {
        const { documentId, action } = req.body; 

        const userDoc = await databases.getDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_ID, documentId);
        const userEmail = userDoc.email;
        const userName = userDoc.name || 'User';
        const currentCoins = userDoc.taskcoin || 0;

        let updateData = {};
        let emailSubject = "";
        let emailHtml = "";

        if (action === 'approve') {
            updateData = {
                taskcoin: currentCoins + 5,
                button1: "count",
                button2: "count",
                button3: "count",
                button4: "count",
                button5: "count",
                taskImageIds: ""
            };
            emailSubject = "Task Approved Update - Free Topup";
            emailHtml = `
                <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
                    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                        <div style="background: #00ef82; padding: 20px; text-align: center; color: #181c32;">
                            <h2 style="margin: 0; font-size: 20px;">🎮 Free Topup Status</h2>
                        </div>
                        <div style="padding: 25px; color: #333333; line-height: 1.6;">
                            <h3 style="color: #16a34a; margin-top: 0;">Task Approved Successfully! 🎉</h3>
                            <p>Hello <b>${userName}</b>,</p>
                            <p>Great news! Your submitted task has been verified and approved by our team.</p>
                            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0; font-weight: 600; color: #15803d;">+5 Task Coins added to your account balance!</p>
                            </div>
                            <p>Your new total balance is <b>${currentCoins + 5} Coins</b>.</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            updateData = {
                button1: "",
                button2: "",
                button3: "",
                button4: "",
                button5: "",
                taskImageIds: ""
            };
            emailSubject = "Task Verification Update - Free Topup";
            emailHtml = `
                <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
                    <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                        <div style="background: #f1416c; padding: 20px; text-align: center; color: #ffffff;">
                            <h2 style="margin: 0; font-size: 20px;">🎮 Free Topup Status</h2>
                        </div>
                        <div style="padding: 25px; color: #333333; line-height: 1.6;">
                            <h3 style="color: #dc2626; margin-top: 0;">Task Rejected ❌</h3>
                            <p>Hello <b>${userName}</b>,</p>
                            <p>Unfortunately, your submitted task could not be approved due to incorrect or invalid verification proof.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (Object.keys(updateData).length > 0) {
            await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_ID, documentId, updateData);
        }

        if (userDoc.telegramMsgIds) {
            try {
                const msgIds = JSON.parse(userDoc.telegramMsgIds);
                for (const msgId of msgIds) {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, message_id: msgId })
                    });
                }
                await databases.updateDocument(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_ID, documentId, {
                    telegramMsgIds: ""
                });
            } catch (tgErr) {
                console.error('Telegram Delete Error:', tgErr);
            }
        }

        if (userEmail) {
            await transporter.sendMail({
                from: '"Free Topup System" <emonkazi799@gmail.com>',
                to: userEmail,
                subject: emailSubject,
                html: emailHtml
            });
        }

        res.json({ success: true, message: `Task successfully ${action}ed!` });
    } catch (err) {
        console.error('Action Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));