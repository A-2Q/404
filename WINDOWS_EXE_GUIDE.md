# دليل بناء النسخة التنفيذية لنظام ويندوز (.exe) — غرفة التحقيق 404

تم تجهيز مشروع **غرفة التحقيق 404** بالكامل للعمل كبرنامج ويندوز مستقل (`.exe`) عبر **Electron + electron-builder** مع حقن أوامر مباشرة لمحرك رسوميات Chromium لفتح قيود كرت الشاشة وإجباره على استخدام **DirectX 11/12** وكرت الشاشة المنفصل.

## أوامر كرت الشاشة المُحقنة تلقائياً (`electron/gpuFlags.cjs`)

- `--ignore-gpu-blocklist`: تجاوز القائمة السوداء لتعريفات كروت الشاشة في المتصفح.
- `--use-gl=angle` و `--use-angle=d3d11` (أو `d3d11on12` مع `--dx12`): فرض محرك DirectX 11 / 12 الأصلي على ويندوز.
- `--force_high_performance_gpu` و `--gpu-preference=high-performance`: إجبار أجهزة اللابتوب الهجينة (NVIDIA / AMD) على تشغيل اللعبة على كرت الشاشة المنفصل.
- `--enable-gpu-rasterization` و `--enable-zero-copy`: تسريع معالجة الخامات والظلال مباشرة على ذاكرة VRAM.
- `--disable-software-rasterizer`: منع التراجع الصامت إلى المعالجة البرمجية البطيئة (SwiftShader).
- `--autoplay-policy=no-user-gesture-required`: تشغيل محرك الصوتيات التوليدية (Web Audio) فور الإطلاق دون قيود.

## خطوات إنتاج ملف `.exe` على جهاز ويندوز

1. افتح مجلد المشروع في سطر الأوامر (`PowerShell` أو `CMD`) وتأكد من تثبيت **Node.js 20+**.
2. ثبّت الحزم (بما فيها Electron و electron-builder):
   ```bash
   npm install
   ```
3. لإنتاج ملف **`.exe` محمول واحد جاهز للتشغيل المباشر بدون تثبيت** (Portable):
   ```bash
   npm run dist:win:portable
   ```
   أو لإنتاج **النسخة المحمولة + ملف التثبيت (NSIS Installer)** معاً:
   ```bash
   npm run dist:win
   ```
4. ستجد ملفات الـ `.exe` الجاهزة داخل المجلد `release/`.

## خيارات تشغيل متقدمة لسطح المكتب

- **تفعيل مسار DirectX 12**: مرّر `--dx12` عند التشغيل أو اضبط `ROOM404_DX12=1`.
- **فتح معدل الإطارات (إلغاء VSync)**: مرّر `--unlock-fps` أو اضبط `ROOM404_UNLOCK_FPS=1`.
- **اختصار ملء الشاشة داخل اللعبة**: اضغط `F11` أو `Alt + Enter`.
- **تشغيل فوري لمعاينة Electron محلياً**:
  ```bash
  npm run electron:preview
  ```
