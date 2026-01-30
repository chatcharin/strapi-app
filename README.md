# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>

## 🧩 Environment variables (.env)

สร้างไฟล์ `.env` ในโฟลเดอร์ `strapi-app` แล้วตั้งค่าตัวแปรหลัก (ตัวอย่างสำหรับ Gmail SMTP):

```
# App
HOST=0.0.0.0
PORT=1337
APP_KEYS=replace_this_with_random_values
API_TOKEN_SALT=replace_this_with_random_values
ADMIN_JWT_SECRET=replace_this_with_random_values
JWT_SECRET=replace_this_with_random_values

# Frontend URL (ใช้ในลิงก์เชิญ/อีเมล)
FRONTEND_URL=http://localhost:3000

# Email (Nodemailer + Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="Your Name <your@gmail.com>"
EMAIL_REPLY_TO="your@gmail.com"

# Contact fallback (optional)
CONTACT_RECEIVER_EMAIL=admin@example.com
```

### หมายเหตุ Gmail
- เปิด 2FA ในบัญชี Google แล้วสร้าง **App Password** สำหรับใช้ใน `SMTP_PASS` (ไม่รองรับรหัสผ่านปกติ)
- ถ้าต้องการ TLS แบบพอร์ต 465 ให้ตั้ง `SMTP_PORT=465` และ `SMTP_SECURE=true`

### วิธีใช้
1. สร้างไฟล์ `.env` ตามตัวอย่างด้านบน
2. ติดตั้ง dependencies: `yarn install` หรือ `npm install`
3. รันโหมดพัฒนา: `yarn develop` (หรือ `npm run develop`)
4. ทดสอบส่งอีเมล (เช่น เชิญ workspace หรือยืนยันอีเมล) เพื่อยืนยันว่า SMTP ทำงานถูกต้อง

## 🔐 Strapi permissions ที่ต้องเปิด (สำคัญ)

ใน Strapi Admin ไปที่:
`Settings` → `Users & Permissions plugin` → `Roles` → `Authenticated`

เปิด permissions ตามนี้:

### Users & Permissions plugin
- **User**
  - `me` (ใช้ `GET /users/me`)
  - `updateMe` (ใช้ `PUT /users/me`)
  - `deleteMe` (ใช้ `DELETE /users/me`)
- **Auth**
  - `changePassword` (ใช้ `POST /auth/change-password`)

### Upload plugin
- **Upload**
  - `upload` (ใช้ `POST /upload`)

หมายเหตุ:
ไม่แนะนำให้เปิด `PUT /users/:id` หรือ `DELETE /users/:id` ให้กับ `Authenticated` เพราะเสี่ยงที่ผู้ใช้จะแก้/ลบ user คนอื่นได้

## 👤 Safe endpoints สำหรับแก้โปรไฟล์/ลบบัญชี

โปรเจกต์นี้เพิ่ม endpoint แบบปลอดภัยสำหรับผู้ใช้ที่ล็อกอินแล้ว:

- `PUT /api/users/me`
  - อัปเดตได้เฉพาะ field: `full_name`, `bio`, `avatar_url`
- `DELETE /api/users/me`
  - ลบบัญชีของตัวเองเท่านั้น
