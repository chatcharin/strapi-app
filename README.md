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

## 📄 Future Design: Selective OCR รายหน้า + Page Review Workflow

ส่วนนี้เป็นข้อเสนอสำหรับการพัฒนาต่อในอนาคต เพื่อให้ `mx-front`, `Strapi`, `python-service`, และ `mx-agent-api` ทำงานร่วมกันสำหรับการตรวจคุณภาพผล document processing และสั่ง OCR เฉพาะบางหน้าได้

เป้าหมาย:

- ให้ผู้ใช้เลือกบางหน้าที่ต้องการ OCR ซ้ำได้จาก `mx-front`
- ให้ระบบเก็บสถานะการตรวจคุณภาพรายหน้าใน Strapi
- ให้ `mx-agent-api` ตั้งเวลามาตรวจผลลัพธ์หลัง ingestion ได้
- ให้ระบบเลือกได้ว่าหน้าไหนควร:
  - ใช้ผลเดิมต่อ
  - ทำ local OCR ใหม่
  - ส่งต่อไปใช้ LLM API OCR

### ภาพรวม workflow ที่แนะนำ

1. เอกสารถูกประมวลผลครั้งแรกโดย `python-service`
2. แต่ละหน้ามี page text และ metadata ถูกเก็บใน OpenSearch
3. `mx-front` เปิดให้ผู้ใช้ดูผลรายหน้าและกด flag หน้าที่มีปัญหา
4. Strapi เก็บ workflow state ว่าหน้าไหน:
   - ผ่านแล้ว
   - ต้อง review
   - ต้อง OCR ใหม่
   - ต้องใช้ LLM OCR
5. `mx-agent-api` มี scheduled job มาตรวจคุณภาพผลลัพธ์เป็นรอบ ๆ
6. agent หรือ user สามารถสร้างงาน reprocess เฉพาะบางหน้าได้
7. `python-service` reprocess เฉพาะหน้าที่ถูกเลือก และอัปเดตผลกลับเข้า index

### สิ่งที่แนะนำให้กำหนดจาก mx-front

ในหน้า Document/Page editor ของ `mx-front` ควรมีความสามารถต่อไปนี้:

- แสดงรายการหน้าทั้งหมดของเอกสาร
- เปิดดู text รายหน้าได้
- กดเลือกหน้าที่ต้องการ OCR ใหม่ได้หลายหน้า
- เลือก OCR mode รายหน้าหรือราย batch ได้ เช่น:
  - `tesseract_cli`
  - `easyocr`
  - `llm_api_ocr`
- ใส่เหตุผลในการส่ง OCR ซ้ำ เช่น:
  - `text_incomplete`
  - `thai_text_garbled`
  - `blank_page_result`
  - `manual_review`
- แสดงสถานะของแต่ละหน้า เช่น:
  - `accepted`
  - `needs_review`
  - `queued_for_retry`
  - `retrying`
  - `completed`
  - `failed`

### สิ่งที่แนะนำให้ Strapi เก็บ

ในอนาคตแนะนำให้ Strapi มีข้อมูลระดับ page review / OCR job เพิ่มจากระดับ Knowledge Base เดิม

ตัวอย่าง entity ที่แนะนำ:

- `document-page-review`
- `document-page-ocr-job`
- หรือเก็บใน component / relation ที่ผูกกับ `document` ก็ได้ หากต้องการเริ่มแบบง่ายก่อน

### ฟิลด์ที่แนะนำสำหรับ page review

- `document`
- `knowledge_base`
- `filename`
- `page_number`
- `source_page_id`
- `review_status`
- `review_reason`
- `review_score`
- `suggested_action`
- `selected_ocr_engine`
- `use_llm_ocr`
- `requested_by`
- `requested_at`
- `processed_at`
- `last_error`
- `is_locked`

ค่าที่แนะนำสำหรับ `review_status`:

- `accepted`
- `needs_review`
- `queued_for_retry`
- `retrying`
- `completed`
- `failed`

ค่าที่แนะนำสำหรับ `suggested_action`:

- `keep_current_result`
- `retry_local_ocr`
- `retry_full_page_ocr`
- `retry_with_easyocr`
- `retry_with_tesseract`
- `escalate_to_llm_ocr`

### หน้าที่ของ mx-agent-api ในอนาคต

ใน `/home/chatcharin/n8n/mx-agent-api` สามารถเพิ่ม scheduled workflow ได้ เช่น:

- ดึง page results ที่เพิ่ง ingest เสร็จ
- ตรวจ heuristic หรือใช้ model ช่วยประเมินคุณภาพข้อความรายหน้า
- เขียนผลการ review กลับเข้า Strapi
- สร้างคิว reprocess เฉพาะหน้าที่มีปัญหา
- แนะนำว่าควรใช้ local OCR หรือ LLM OCR

ตัวอย่างเหตุผลที่ agent ควร flag หน้า:

- ข้อความว่างหรือสั้นผิดปกติ
- อัตราอักขระเพี้ยนสูง
- ภาษาไทยเว้นวรรค/encoding ผิดรูปมาก
- หน้าเดียวกันให้ผลต่างจาก PDF text extraction อย่างผิดปกติ
- ผู้ใช้เคยแก้ไข text หน้านั้นด้วยมือหลายครั้ง

### แนวทาง permissions และ workflow state

สำหรับผู้ใช้ใน `mx-front` อาจกำหนดสิทธิ์แยกเป็น:

- ดูผล OCR รายหน้า
- flag หน้าเพื่อ review
- สั่ง OCR ใหม่เฉพาะบางหน้า
- อนุมัติให้ใช้ LLM OCR
- ดูประวัติการ reprocess

Strapi ควรเป็นตัวกลางเก็บ workflow state เพื่อให้:

- `mx-front` อ่าน/แก้สถานะได้ตามสิทธิ์
- `mx-agent-api` เขียน recommendation หรือ job queue ได้
- `python-service` อ่านคิวงานแล้วทำ reprocess ได้

### ข้อเสนอเชิง implementation

- อย่าให้การ OCR ใหม่หนึ่งหน้าไปบังคับ reingest ทั้งเอกสาร
- ใช้ `page_number` และ `source_page_id` เป็นตัวอ้างอิงหลัก
- เก็บ audit trail ว่า page นี้เคยผ่าน OCR engine อะไรมาบ้าง
- หากมีการแทนที่ผล OCR เดิม ควรเก็บ `previous_text` หรือ revision metadata ไว้ด้วย
- แยกสถานะ `agent_suggested` ออกจาก `user_approved` เพื่อให้ workflow ชัดเจน

### สรุป design ที่แนะนำ

- `mx-front` ใช้สำหรับ review และเลือกบางหน้าที่ต้อง OCR ใหม่
- `Strapi` ใช้เก็บสถานะ review และ job queue รายหน้า
- `python-service` ใช้ทำ OCR/reindex เฉพาะหน้าที่ถูกเลือก
- `mx-agent-api` ใช้ตรวจคุณภาพผลลัพธ์เป็นรอบ ๆ และแนะนำ action อัตโนมัติ

แนวทางนี้จะทำให้ระบบรองรับการ OCR เฉพาะบางหน้าได้ โดยไม่ต้อง reprocess เอกสารทั้งไฟล์ทุกครั้ง
