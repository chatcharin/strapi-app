'use strict';

module.exports = {
  getOtpTemplate(otp) {
    return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รหัสยืนยันอีเมล</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #0066cc;
            letter-spacing: 5px;
            margin: 20px 0;
            padding: 15px;
            background-color: #e6f2ff;
            border-radius: 5px;
        }
        .warning {
            color: #ff6600;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>รหัสยืนยันอีเมลของคุณ</h2>
        <p>ขอบคุณที่ลงทะเบียนกับเรา กรุณาใช้รหัสยืนยันด้านล่างเพื่อยืนยันอีเมลของคุณ:</p>
        
        <div class="otp-code">${otp}</div>
        
        <p>รหัสนี้จะหมดอายุภายใน 15 นาที</p>
        
        <p class="warning">
            ⚠️ หากคุณไม่ได้ขอรหัสนี้ กรุณาละเว้นอีเมลนี้
        </p>
    </div>
</body>
</html>`;
  },

  getInvitationTemplate(workspaceName, inviteUrl) {
    return `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>คำเชิญเข้าร่วม Workspace</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
        }
        .workspace-name {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            background-color: #0066cc;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
        }
        .button:hover {
            background-color: #0052a3;
        }
        .warning {
            color: #ff6600;
            font-size: 14px;
            margin-top: 20px;
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>คุณได้รับคำเชิญเข้าร่วม Workspace</h2>
        
        <p>คุณได้รับคำเชิญให้เข้าร่วม workspace:</p>
        
        <div class="workspace-name">${workspaceName}</div>
        
        <p>คลิกปุ่มด้านล่างเพื่อยอมรับคำเชิญ:</p>
        
        <a href="${inviteUrl}" class="button">ยอมรับคำเชิญ</a>
        
        <p>หรือคัดลอกลิงก์นี้ไปที่เบราว์เซอร์:</p>
        <p style="word-break: break-all; color: #0066cc;">${inviteUrl}</p>
        
        <p class="warning">
            ⚠️ ลิงก์นี้จะหมดอายุภายใน 48 ชั่วโมง
        </p>
        
        <div class="footer">
            <p>หากคุณไม่ได้ขอคำเชิญนี้ กรุณาละเว้นอีเมลนี้</p>
        </div>
    </div>
</body>
</html>`;
  },
};
