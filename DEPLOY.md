# نشر تطبيق REVIVA على الويب (مجاناً)

هذا الدليل يشرح نشر المشروع على **Render.com** مجاناً. الـ Backend (Node + Express) يخدم الـ API **والواجهة الأمامية** معاً من نفس الرابط، فلا حاجة لنشر منفصل.

---

## ما تم إعداده مسبقاً

- **Config**: الواجهة تستخدم `API_BASE` تلقائياً (محلي = `localhost:4000`، على السيرفر = نفس النطاق).
- **Static files**: Express يخدم مجلد `frontend/public` (صفحات HTML، الـ intake، الأصول).
- **Intake**: تم استبدال `localhost:4000` بـ `INTAKE_API_BASE` الديناميكي.

---

## 1. رفع المشروع إلى GitHub

1. أنشئ مستودعاً (Repository) جديداً على [GitHub](https://github.com).
2. ارفع المشروع:
   ```bash
   cd c:\Users\HP\OneDrive\Desktop\Coding\Projects\cons-v01
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. تأكد أن ملف `.env` **غير** مضاف للمستودع (يجب أن يكون في `.gitignore`). الأسرار نضيفها لاحقاً في Render.

---

## 2. إنشاء خدمة على Render

1. ادخل إلى [Render](https://render.com) وسجّل دخولك (أو إنشاء حساب) عبر GitHub.
2. من **Dashboard** اختر **New → Web Service**.
3. اختر المستودع `cons-v01` (أو اسم المستودع الذي رفعته).
4. الإعدادات:

   | الحقل | القيمة |
   |-------|--------|
   | **Name** | `reviva-app` (أو أي اسم) |
   | **Region** | اختر الأقرب (مثلاً Frankfurt) |
   | **Root Directory** | اتركه **فارغاً** (جذر المستودع) |
   | **Runtime** | `Node` |
   | **Build Command** | `cd backend && npm install` |
   | **Start Command** | `cd backend && npm start` |
   | **Instance Type** | **Free** |

5. في **Environment** أضف المتغيرات التالية (**Environment Variables**):

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `PORT` | Render يضيفه تلقائياً—لا حاجة لتعريفه |
   | `SUPABASE_URL` | من [Supabase](https://supabase.com) → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | من Supabase → Project Settings → API (اختر `service_role`) |
   | `JWT_SECRET` | سلسلة عشوائية قوية (مثلاً من [randomkeygen](https://randomkeygen.com)) |
   | `SUPABASE_STORAGE_BUCKET` | `documents` (إن كنت تستخدمه) |

   انسخ القيم من ملف `.env` المحلي، لكن **لا ترفع `.env` إلى GitHub**.

6. اضغط **Create Web Service**. Render سيبنى المشروع ويشغّله.

---

## 3. الرابط والاستخدام

- بعد انتهاء الـ deploy ستحصل على رابط مثل:
  ```
  https://reviva-app.onrender.com
  ```
- **الواجهة**: نفس الرابط (مثلاً `/`, `/login.html`, `/intake/`, إلخ).
- **الـ API**: تحت `/api/` (مثلاً `/api/health`, `/api/auth/login`).

---

## 4. حدود الطبقة المجانية (Render Free)

- الخدمة **تتوقف بعد ~15 دقيقة** من عدم الاستخدام. أول طلب بعد التوقف قد يستغرق حتى دقيقة (إقلاع بارد).
- مناسبة للتجربة والعرض، وليست للإنتاج الكثيف.
- للمزيد: [Render Free Tier](https://render.com/docs/free).

---

## 5. بدائل مجانية أخرى

| المنصة | ملاحظات |
|--------|---------|
| **Railway** | رصيد مجاني شهري محدود، دعم Node.js جيد |
| **Fly.io** | خطة مجانية مناسبة لتطبيقات صغيرة |
| **Cyclic** | سابقاً مجاني لـ Node.js (تحقق من الشروط الحالية) |
| **Vercel** | ممتاز للـ Frontend؛ الـ Backend يحتاج تعديلاً لـ serverless |

---

## 6. استمرار التطوير والنشر

بعد أي تعديل:

```bash
git add .
git commit -m "وصف التعديل"
git push
```

Render يبني ويُحدّث الخدمة تلقائياً عند كل `push` إلى الفرع المتصل.

---

## استكشاف الأخطاء

- **البناء فشل**: تحقق من **Build Command** و**Root Directory** وأن `backend/package.json` موجود.
- **التطبيق لا يبدأ**: راجع **Logs** في Render. غالباً سببها نقص متغير بيئة (`SUPABASE_*`, `JWT_SECRET`).
- **404 للصفحات**: تأكد أن Express يخدم `frontend/public` وأن المسار `../../frontend/public` صحيح بالنسبة لمجلد `backend/src`.
- **CORS**: الواجهة والـ API على نفس النطاق، فلا حاجة لإعداد CORS إضافي لهذا السيناريو.
