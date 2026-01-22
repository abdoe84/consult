// API base: local dev = :4000, production = same origin (frontend + API together)
var INTAKE_API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:4000'
  : window.location.origin;

// Wait for i18n to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Ensure language manager is initialized (check after a short delay)
    setTimeout(() => {
        if (typeof languageManager !== 'undefined' && languageManager) {
            // Language manager is ready
        } else {
            console.warn('Language manager not loaded yet');
        }
    }, 50);

    // 2. تفعيل تأثير تقلص النافبار عند التمرير (Simplified)
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                mainNav.classList.add('nav-scrolled');
            } else {
                mainNav.classList.remove('nav-scrolled');
            }
        }, { passive: true });
    }

    // 3. تحسين نظام التمرير السلس (Smooth Scroll)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerOffset = 100;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // 4. تشغيل الأنيميشن عند الظهور (Scroll Observer) - محسن
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('appear');
                }, index * 100); // تأخير تدريجي للعناصر
                observer.unobserve(entry.target); // إيقاف المراقبة بعد الظهور
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // 5. تحسين أنيميشن Hero Section
    const heroElements = document.querySelectorAll('.animate-fade-in');
    heroElements.forEach((el, index) => {
        setTimeout(() => {
            el.style.opacity = '1';
        }, index * 150);
    });

    // 6. إدارة النموذج متعدد الخطوات (Multi-Step Form)
    initRevivaForm();

    // 6.2. إدارة اختيار الخدمات الفرعية
    initSubserviceHandler();

    // 6.3. إدارة المرفقات
    initAttachmentsHandler();

    // 6.1. إضافة عداد الأحرف للنص في الخطوة الثانية
    const descriptionTextarea = document.querySelector('textarea[name="projectDescription"]');
    const charCount = document.getElementById('charCount');
    if (descriptionTextarea && charCount) {
      descriptionTextarea.addEventListener('input', function() {
        const length = this.value.length;
        charCount.textContent = length;
        if (length > 500) {
          charCount.parentElement.style.color = '#ef476f';
        } else if (length > 450) {
          charCount.parentElement.style.color = '#f59e0b';
        } else {
          charCount.parentElement.style.color = '#94a3b8';
        }
      });
    }

    // 7. التحقق من الوضع الليلي التلقائي والحفظ
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
    }

    // 8. تحسين التفاعل مع الأزرار
    document.querySelectorAll('button, a[href^="#"]').forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // 9. إدارة القائمة الهاتفية المحسّنة
    initMobileMenu();

    // 9.1. إدارة قائمة الخدمات المنسدلة
    initServicesDropdown();

    // 10. تفعيل Scroll Spy للروابط النشطة
    initScrollSpy();

    // 11. إضافة lazy loading للصور
    initLazyLoading();

    // 12. Listen for language changes
    document.addEventListener('languageChanged', function(event) {
      // Re-translate the page when language changes
      if (typeof languageManager !== 'undefined' && languageManager) {
        // Translation is already handled by languageManager
        // Update form button text if form is initialized
        const btnText = document.getElementById('btnText');
        if (btnText && typeof window.currentFormStep !== 'undefined') {
          const submitText = languageManager.getTranslation('form.submit');
          const nextText = languageManager.getTranslation('form.next');
          const totalSteps = 2; // Assuming 2 steps
          btnText.innerText = window.currentFormStep === totalSteps ? (submitText || "إرسال") : (nextText || "التالي");
        }
      }
    });
  });

  function initRevivaForm() {
    let currentStep = 1;
    const totalSteps = 2;
    const form = document.getElementById('multiStepForm');
    if (!form) return;

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const progressBar = document.getElementById('progressBar');

    // تخزين currentStep خارجياً لتحديث الزر عند تغيير اللغة
    window.currentFormStep = currentStep;

    // تصدير دالة لإعادة تعيين currentStep (للاستخدام في openRequestForm)
    window.resetFormStep = () => {
      currentStep = 1;
      window.currentFormStep = 1;
    };

    nextBtn.addEventListener('click', async () => {
        if (currentStep < totalSteps) {
            if (validateStep(currentStep)) {
                toggleBtnLoading(true);
                // محاكاة معالجة بسيطة لإعطاء شعور "بشري"
                await new Promise(resolve => setTimeout(resolve, 600));
                toggleBtnLoading(false);
                currentStep++;
                window.currentFormStep = currentStep;
                updateFormUI();
            }
        } else {
            // عند الوصول للخطوة الأخيرة (Step 2)، إرسال مباشر
            if (validateStep(currentStep)) {
                await handleFormSubmission();
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            window.currentFormStep = currentStep;
            updateFormUI();
        }
    });

    function updateFormUI() {
        // تحديث ظهور الخطوات مع أنيميشن سلس
        document.querySelectorAll('.form-step').forEach((step, idx) => {
            if (idx + 1 === currentStep) {
                step.style.display = 'block';
                setTimeout(() => step.classList.add('active'), 10);
            } else {
                step.classList.remove('active');
                setTimeout(() => {
                    if (idx + 1 !== currentStep) step.style.display = 'none';
                }, 300);
            }
        });

        // تحديث شريط التقدم (Progress Bar) مع أنيميشن
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressBar.style.width = `${progress}%`;
        progressBar.style.transition = 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)';

        // تحديث النقاط (Dots) مع أنيميشن
        for (let i = 1; i <= totalSteps; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (dot) {
                if (i < currentStep) {
                    dot.classList.add('completed');
                    dot.classList.remove('active');
                    dot.innerHTML = '<i class="fas fa-check text-white"></i>';
                } else if (i === currentStep) {
                    dot.classList.add('active');
                    dot.classList.remove('completed');
                    dot.innerHTML = i === 1 ? '<i class="fas fa-user text-lg"></i>' :
                                    '<i class="fas fa-cog text-lg"></i>';
                } else {
                    dot.classList.remove('active', 'completed');
                    dot.innerHTML = i === 1 ? '<i class="fas fa-user text-lg"></i>' :
                                    '<i class="fas fa-cog text-lg"></i>';
                }
            }
        }

        // أزرار التحكم
        prevBtn.classList.toggle('hidden', currentStep === 1);
        const btnText = document.getElementById('btnText');
        if (btnText && typeof languageManager !== 'undefined' && languageManager) {
            const submitText = languageManager.getTranslation('form.submit');
            const nextText = languageManager.getTranslation('form.next');
            btnText.innerText = currentStep === totalSteps ? (submitText || "إرسال") : (nextText || "التالي");
        } else if (btnText) {
            btnText.innerText = currentStep === totalSteps ? "إرسال" : "التالي";
        }

        // إضافة أنيميشن للأزرار
        nextBtn.style.transform = 'scale(1)';
        setTimeout(() => {
            nextBtn.style.transform = '';
        }, 200);
    }

    function validateStep(step) {
        if (step === 1) {
            const name = form.elements['fullName']?.value.trim();
            const email = form.elements['email']?.value.trim();
            const phone = form.elements['phone']?.value.trim();

            if (!name || name.length < 3) {
                return showWarning("يرجى إدخال الاسم الكامل (3 أحرف على الأقل)");
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                return showWarning("يرجى إدخال بريد إلكتروني صحيح");
            }

            const phoneRegex = /^(05|5)[0-9]{8,9}$/;
            if (!phone || !phoneRegex.test(phone.replace(/\s/g, ''))) {
                return showWarning("يرجى إدخال رقم هاتف صحيح (يبدأ بـ 05 ويتكون من 10 أرقام)");
            }
        }

        if (step === 2) {
            const service = form.elements['service']?.value;
            const subservice = form.elements['subservice']?.value;
            const subserviceContainer = document.getElementById('subserviceContainer');
            const description = form.elements['projectDescription']?.value.trim();

            if (!service) {
                return showWarning("يرجى اختيار نوع الخدمة");
            }

            // Validate subservice only if container is visible (service has subservices)
            if (subserviceContainer && !subserviceContainer.classList.contains('hidden')) {
                if (!subservice) {
                    return showWarning("يرجى اختيار الخدمة الفرعية");
                }
            }

            if (!description || description.length < 10) {
                return showWarning("يرجى إدخال وصف المشروع (10 أحرف على الأقل)");
            }

            if (description.length > 500) {
                return showWarning("وصف المشروع يجب أن لا يتجاوز 500 حرف");
            }
        }

        return true;
    }

    // expose validator for global submission handler
    window.__revivaValidateStep = validateStep;

    function toggleBtnLoading(isLoading) {
      const loader = document.getElementById('btnLoader');
      const icon = document.getElementById('btnIcon');
      if (nextBtn) nextBtn.disabled = isLoading;
      if (loader) loader.classList.toggle('hidden', !isLoading);
      if (icon) icon.classList.toggle('hidden', isLoading);
    }
  }

  // دالة إدارة اختيار الخدمات الفرعية
  function initSubserviceHandler() {
    const serviceRadios = document.querySelectorAll('input[name="service"]');
    const subserviceContainer = document.getElementById('subserviceContainer');
    const subserviceSelect = document.getElementById('subserviceSelect');

    if (!subserviceContainer || !subserviceSelect) return;

    // Mapping الخدمات الرئيسية إلى الخدمات الفرعية
    const subservicesMap = {
      env: 'environmental',
      permit: 'permitting',
      esg: 'esg',
      eng: 'engineering',
      dig: null, // Digitalization has no subservices
      train: 'training'
    };

    // دالة لتحديث dropdown الخدمات الفرعية
    function updateSubservices(serviceValue) {
      // Clear existing options
      subserviceSelect.innerHTML = '<option value="" data-i18n="form.selectSubservice">-- اختر الخدمة الفرعية --</option>';

      const serviceKey = subservicesMap[serviceValue];

      if (!serviceKey || serviceValue === 'dig') {
        // Hide container for services with no subservices (like digitalization)
        subserviceContainer.classList.add('hidden');
        subserviceSelect.removeAttribute('required');
        return;
      }

      // Get translations for subservices
      if (typeof languageManager === 'undefined' || !languageManager) {
        console.warn('Language manager not available');
        return;
      }

      // Try to get subservices from i18n translations
      try {
        const subservicesPath = `sections.services.${serviceKey}.subservices`;
        const subservices = languageManager.getTranslation ? languageManager.getTranslation(subservicesPath) : null;

        if (subservices && Array.isArray(subservices)) {
          // Show container and make required
          subserviceContainer.classList.remove('hidden');
          subserviceSelect.setAttribute('required', 'required');

          // Add options
          subservices.forEach((subservice, index) => {
            const option = document.createElement('option');
            option.value = `${serviceKey}_${index}`;
            option.textContent = subservice;
            option.setAttribute('data-i18n', `${subservicesPath}.${index}`);
            subserviceSelect.appendChild(option);
          });

          // Translate options
          if (languageManager.translatePage) {
            languageManager.translatePage();
          }
        } else {
          subserviceContainer.classList.add('hidden');
          subserviceSelect.removeAttribute('required');
        }
      } catch (e) {
        console.error('Error loading subservices:', e);
        subserviceContainer.classList.add('hidden');
        subserviceSelect.removeAttribute('required');
      }
    }

    // Add event listeners to service radio buttons
    serviceRadios.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.checked) {
          updateSubservices(this.value);
        }
      });
    });

    // Initial check if a service is already selected
    const checkedService = document.querySelector('input[name="service"]:checked');
    if (checkedService) {
      updateSubservices(checkedService.value);
    }
  }

  // دالة إدارة المرفقات
  function initAttachmentsHandler() {
    const attachmentsInput = document.getElementById('attachmentsInput');
    const attachmentsPreview = document.getElementById('attachmentsPreview');

    if (!attachmentsInput || !attachmentsPreview) return;

    attachmentsInput.addEventListener('change', function() {
      attachmentsPreview.innerHTML = '';
      const files = Array.from(this.files);

      files.forEach((file, index) => {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          showWarning(`الملف "${file.name}" يتجاوز الحد الأقصى (10MB)`);
          return;
        }

        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-xl';
        fileItem.innerHTML = `
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <i class="fas fa-file text-scampi text-lg flex-shrink-0"></i>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">${escapeHtml(file.name)}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">${(file.size / 1024).toFixed(2)} KB</p>
            </div>
          </div>
          <button type="button" onclick="removeAttachment(${index})" class="ml-3 text-red-500 hover:text-red-700 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        `;
        attachmentsPreview.appendChild(fileItem);
      });
    });
  }

  // دالة إزالة مرفق
  window.removeAttachment = function(index) {
    const attachmentsInput = document.getElementById('attachmentsInput');
    if (!attachmentsInput) return;

    const dt = new DataTransfer();
    const files = Array.from(attachmentsInput.files);
    files.forEach((file, i) => {
      if (i !== index) dt.items.add(file);
    });
    attachmentsInput.files = dt.files;
    attachmentsInput.dispatchEvent(new Event('change'));
  };

  // دالة رفع المرفقات
  async function uploadAttachments(serviceRequestId, files) {
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('service_request_id', serviceRequestId);

      const response = await fetch(INTAKE_API_BASE + '/api/public/service-requests/upload-attachment', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to upload file');
      }

      return response.json();
    });

    return Promise.all(uploadPromises);
  }

  // دالة إرسال النموذج (مرتبطة بالـ Backend الحقيقي)
  async function handleFormSubmission() {
    const form = document.getElementById('multiStepForm');
    if (!form) return;

    // Validate again using the validator from initRevivaForm
    const validate = window.__revivaValidateStep;
    if (typeof validate === 'function') {
      if (!validate(1) || !validate(2)) return;
    }

    // Collect form data
    const fullName = form.elements['fullName'].value.trim();
    const email = form.elements['email'].value.trim();
    const phone = form.elements['phone'].value.trim();
    const service = form.elements['service'].value;
    const subservice = form.elements['subservice']?.value || '';
    const subserviceSelect = document.getElementById('subserviceSelect');
    const subserviceText = subservice && subserviceSelect ? subserviceSelect.options[subserviceSelect.selectedIndex]?.textContent || '' : '';
    const projectDescription = form.elements['projectDescription'].value.trim();

    // Map the marketing service category to a safe backend service_type.
    // IMPORTANT: If your DB CHECK constraint has different service types, adjust this map.
    const serviceType = mapServiceTypeToBackend(service);

    // Build description with subservice info
    let descriptionText = projectDescription;
    if (subserviceText) {
      descriptionText = `الخدمة الفرعية: ${subserviceText}\n\n${descriptionText}`;
    }

    // Build payload for public API (no auth required)
    const payload = {
      title: `${mapServiceLabel(service)} - ${fullName}`,
      description:
        `${descriptionText}\n\n---\n` +
        `Client Name: ${fullName}\n` +
        `Client Email: ${email}\n` +
        `Client Phone: ${phone}\n` +
        `Source: Web Intake`,
      service_type: serviceType,
      priority: 'HIGH',
      requester_name: fullName,
      requester_email: email,
      requester_phone: phone
    };

    // Loading UI
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'جاري الإرسال...',
        html: 'يرجى الانتظار أثناء إرسال طلبك',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'dark:bg-slate-800 rounded-2xl' }
      });
    }

    try {
      // Use public API endpoint (no auth required)
      const r = await apiPost(INTAKE_API_BASE + '/api/public/service-requests', payload, null);

      if (!r?.ok) {
        if (typeof Swal !== 'undefined') {
          const errorMsg = r?.details || r?.error || 'حدث خطأ غير معروف';
          Swal.fire({
            icon: 'error',
            title: 'فشل الإرسال',
            html: `
              <div class="text-right space-y-2">
                <p class="text-slate-700 dark:text-slate-300 font-medium">${escapeHtml(errorMsg)}</p>
              </div>
            `,
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#ef476f',
            customClass: { popup: 'dark:bg-slate-800 rounded-2xl' }
          });
        } else {
          alert('فشل الإرسال: ' + (r?.error || r?.details || 'Unknown error'));
        }
        return;
      }

      const created = r.data;

      // Upload attachments if any
      const attachmentsInput = document.getElementById('attachmentsInput');
      if (attachmentsInput && attachmentsInput.files && attachmentsInput.files.length > 0) {
        try {
          await uploadAttachments(created.id, attachmentsInput.files);
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
          // Continue even if attachment upload fails - show warning but don't block success
        }
      }

      if (typeof Swal !== 'undefined') {
        // Get translations
        const isRTL = typeof languageManager !== 'undefined' && languageManager && languageManager.currentLang === 'ar';
        const successTitle = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.successTitle') || 'تم الإرسال بنجاح!'
          : 'تم الإرسال بنجاح!';
        const successMsg1 = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.successMessage') || 'شكراً'
          : 'شكراً';
        const successMsg2 = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.successMessage2') || '، تم إنشاء الطلب بنجاح.'
          : '، تم إنشاء الطلب بنجاح.';
        const successRef = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.successReference') || 'رقم المرجع:'
          : 'رقم المرجع:';
        const successContact = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.successContact') || 'سنعاود الاتصال بك خلال ساعات قليلة على البريد الإلكتروني أو رقم الهاتف المقدم.'
          : 'سنعاود الاتصال بك خلال ساعات قليلة على البريد الإلكتروني أو رقم الهاتف المقدم.';
        const okButtonText = typeof languageManager !== 'undefined' && languageManager
          ? languageManager.getTranslation('form.okButton') || 'حسناً'
          : 'حسناً';

        Swal.fire({
          icon: 'success',
          title: successTitle,
          html: `
            <div class="${isRTL ? 'text-right' : 'text-left'} space-y-3">
              <p class="text-slate-700 dark:text-slate-300 font-medium">
                ${successMsg1} <strong>${escapeHtml(fullName)}</strong>${successMsg2}
              </p>
              <p class="text-slate-600 dark:text-slate-400 text-sm">
                ${successRef} <strong>${escapeHtml(created.reference_no || created.id)}</strong>
              </p>
              <p class="text-slate-500 dark:text-slate-500 text-xs mt-2">
                ${successContact}
              </p>
            </div>
          `,
          confirmButtonText: okButtonText,
          confirmButtonColor: '#66a286',
          customClass: { popup: 'dark:bg-slate-800 rounded-2xl' }
        }).then(() => {
          closeRequestForm();
          form.reset();
        });
      } else {
        alert('تم إنشاء الطلب: ' + (created.reference_no || created.id));
        closeRequestForm();
        form.reset();
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'حدث خطأ!',
          text: error?.message || 'Unexpected error',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#ef476f',
          customClass: { popup: 'dark:bg-slate-800 rounded-2xl' }
        });
      } else {
        alert('حدث خطأ أثناء الإرسال.');
      }
    }
  }

  // دالة التحويل للوضع الليلي
  function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    // حفظ التفضيل اختيارياً
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  // دالة عرض الفيديو بأسلوب ريفايفا
  function playVideo() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            html: `
                <div class="overflow-hidden rounded-2xl bg-slate-900 border-2 border-scampi/20 shadow-2xl">
                    <div class="aspect-video flex items-center justify-center group cursor-pointer">
                        <i class="fas fa-play-circle text-7xl text-scampi group-hover:scale-110 transition duration-300"></i>
                    </div>
                </div>
            `,
            background: 'transparent',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { closeButton: 'text-white' }
        });
    }
  }

  function showWarning(msg) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: msg,
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#635d9e',
        customClass: {
          popup: 'dark:bg-slate-800 rounded-2xl',
          title: 'text-slate-800 dark:text-white font-black',
          confirmButton: 'bg-gradient-to-r from-scampi to-vibrantPurple text-white px-6 py-3 rounded-xl font-bold'
        }
      });
    } else {
      alert(msg);
    }
    return false;
  }

  function showSuccess(msg, title = 'نجاح') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: title,
        text: msg,
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#66a286',
        customClass: {
          popup: 'dark:bg-slate-800 rounded-2xl',
          title: 'text-slate-800 dark:text-white font-black',
          confirmButton: 'bg-gradient-to-r from-patina to-emerald-500 text-white px-6 py-3 rounded-xl font-bold'
        }
      });
    } else {
      alert(msg);
    }
  }

  // دالة فتح نموذج تسجيل الدخول للموظفين
  function openEmployeeLogin() {
    window.location.href = '../login.html';
  }

  // دالة فتح نموذج طلب الخدمة
  function openRequestForm() {
    const formSection = document.getElementById('requestFormSection');
    if (formSection) {
      formSection.classList.remove('hidden');
      // التمرير السلس إلى الفورم
      setTimeout(() => {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      // إعادة تهيئة الفورم عند فتحه
      if (typeof initRevivaForm === 'function') {
        // إعادة تعيين الفورم إلى الخطوة الأولى
        const form = document.getElementById('multiStepForm');
        if (form) {
          form.reset();
          // إعادة تعيين الخطوة الحالية
          if (typeof window.resetFormStep === 'function') {
            window.resetFormStep();
          }
          // إعادة تعيين الخطوات
          document.querySelectorAll('.form-step').forEach((step, idx) => {
            if (idx === 0) {
              step.style.display = 'block';
              step.classList.add('active');
            } else {
              step.style.display = 'none';
              step.classList.remove('active');
            }
          });
          // إعادة تعيين شريط التقدم
          const progressBar = document.getElementById('progressBar');
          if (progressBar) {
            progressBar.style.width = '0%';
          }
          // إعادة تعيين النقاط
          for (let i = 1; i <= 2; i++) {
            const dot = document.getElementById(`dot${i}`);
            if (dot) {
              if (i === 1) {
                dot.classList.add('active');
                dot.classList.remove('completed');
                dot.innerHTML = '<i class="fas fa-user text-xl"></i>';
              } else {
                dot.classList.remove('active', 'completed');
                dot.innerHTML = '<i class="fas fa-cog text-xl"></i>';
              }
            }
          }
          // إعادة تعيين الأزرار
          const prevBtn = document.getElementById('prevBtn');
          const btnText = document.getElementById('btnText');
          if (prevBtn) prevBtn.classList.add('hidden');
          if (btnText) {
            if (typeof languageManager !== 'undefined' && languageManager) {
              const nextText = languageManager.getTranslation('form.next');
              btnText.innerText = nextText || 'التالي';
            } else {
              btnText.innerText = 'التالي';
            }
          }
        }
      }
    }
  }

  // دالة إغلاق نموذج طلب الخدمة
  function closeRequestForm() {
    const formSection = document.getElementById('requestFormSection');
    if (formSection) {
      formSection.classList.add('hidden');
      // التمرير إلى أعلى الصفحة
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ============================================
     ENHANCED MOBILE MENU & NAVIGATION
     ============================================ */

  // Enhanced Mobile Menu Management
  function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const closeBtn = document.getElementById('close-mobile-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (!menuBtn || !mobileMenu) return;

    let isOpen = false;

    // Toggle menu function
    const toggleMenu = (open) => {
      isOpen = open;
      menuBtn.setAttribute('aria-expanded', open);
      mobileMenu.setAttribute('aria-hidden', !open);

      if (open) {
        mobileMenu.classList.add('menu-open');
        document.body.style.overflow = 'hidden';
        // Change icon to X
        if (menuIcon) {
          menuIcon.classList.remove('fa-bars');
          menuIcon.classList.add('fa-times');
        }
      } else {
        mobileMenu.classList.remove('menu-open');
        document.body.style.overflow = '';
        // Change icon back to bars
        if (menuIcon) {
          menuIcon.classList.remove('fa-times');
          menuIcon.classList.add('fa-bars');
        }
      }
    };

    // Open menu
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(true);
    });

    // Close menu
    const closeMenu = () => toggleMenu(false);

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    // Close on backdrop click
    mobileMenu.addEventListener('click', (e) => {
      if (e.target === mobileMenu) {
        closeMenu();
      }
    });

    // Close on link click
    const mobileLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        setTimeout(closeMenu, 300); // Delay for smooth transition
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
      }
    });

    // Close on window resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024 && isOpen) {
        closeMenu();
      }
    });
  }

  /* ============================================
     SERVICES DROPDOWN MANAGEMENT
     ============================================ */
  function initServicesDropdown() {
    const servicesDropdown = document.getElementById('services-dropdown');
    if (!servicesDropdown) return;

    const dropdownLink = servicesDropdown.querySelector('a[href="#services"]');
    const dropdownMenu = servicesDropdown.querySelector('div');

    if (!dropdownLink || !dropdownMenu) return;

    // Handle click on services link
    dropdownLink.addEventListener('click', function(e) {
      // If on mobile, just navigate (no dropdown)
      if (window.innerWidth < 1024) {
        return; // Let default navigation happen
      }

      // On desktop, prevent default and toggle dropdown
      e.preventDefault();
      e.stopPropagation();

      // Toggle dropdown
      const isVisible = dropdownMenu.classList.contains('opacity-100');
      if (isVisible) {
        dropdownMenu.classList.remove('opacity-100', 'visible');
        dropdownMenu.classList.add('opacity-0', 'invisible');
      } else {
        dropdownMenu.classList.remove('opacity-0', 'invisible');
        dropdownMenu.classList.add('opacity-100', 'visible');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!servicesDropdown.contains(e.target)) {
        dropdownMenu.classList.remove('opacity-100', 'visible');
        dropdownMenu.classList.add('opacity-0', 'invisible');
      }
    });

    // Close dropdown on scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      scrollTimeout = requestAnimationFrame(() => {
        dropdownMenu.classList.remove('opacity-100', 'visible');
        dropdownMenu.classList.add('opacity-0', 'invisible');
        scrollTimeout = null;
      });
    }, { passive: true });

    // Handle dropdown item clicks - scroll to services section
    dropdownMenu.querySelectorAll('a[href="#services"]').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector('#services');
        if (target) {
          const headerOffset = 100;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
        // Close dropdown
        dropdownMenu.classList.remove('opacity-100', 'visible');
        dropdownMenu.classList.add('opacity-0', 'invisible');
      });
    });
  }

  /* ============================================
     SCROLL SPY - Active Link Detection
     ============================================ */

  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

    if (sections.length === 0 || navLinks.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');

          // Update all nav links
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => {
      observer.observe(section);
    });

    // Also check on scroll for better accuracy
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      scrollTimeout = requestAnimationFrame(() => {
        const scrollPos = window.scrollY + 150;

        sections.forEach(section => {
          const top = section.offsetTop;
          const bottom = top + section.offsetHeight;
          const id = section.getAttribute('id');

          if (scrollPos >= top && scrollPos < bottom) {
            navLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href === `#${id}`) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        });
        scrollTimeout = null;
      });
    }, { passive: true });
  }

  // دالة إضافة lazy loading للصور
  function initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
              observer.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '50px'
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  // ==============================
  // Internal System Integration Helpers
  // ==============================

  function getAuthToken() {
    const keys = [
      'REVIVA_TOKEN',
      'reviva_token',
      'TOKEN',
      'token',
      'access_token',
      'AUTH_TOKEN',
      'reviva.auth.token',
      'reviva.jwt'
    ];

    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }

    // Some apps store JSON in one key (best-effort)
    const jsonKeys = ['auth', 'session', 'reviva_session'];
    for (const k of jsonKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj?.token) return String(obj.token);
        if (obj?.access_token) return String(obj.access_token);
        if (obj?.data?.token) return String(obj.data.token);
      } catch (_) {}
    }

    return null;
  }

  async function apiPost(url, payload, token) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      // Handle network errors
      if (!res.ok && res.status === 0) {
        return {
          ok: false,
          error: 'Connection Error',
          details: 'لا يمكن الاتصال بالخادم. تحقق من أن الخادم يعمل.'
        };
      }

      // Backend contract: { ok:true,data } / { ok:false,error,details? }
      const json = await res.json().catch(() => null);

      if (!json) {
        return {
          ok: false,
          error: 'Bad response',
          details: `HTTP ${res.status}: No JSON returned`
        };
      }

      return json;
    } catch (error) {
      // Handle fetch errors (network failures, CORS, etc.)
      console.error('API Post Error:', error);
      return {
        ok: false,
        error: 'Network Error',
        details: error.message || 'فشل الاتصال بالخادم. تحقق من أن الخادم يعمل.'
      };
    }
  }

  function mapServiceTypeToBackend(service) {
    // Safe defaults to avoid breaking DB CHECK constraints.
    // Adjust these values to match your backend constants/service_types.
    const map = {
      env: 'EIA',        // Environmental consultancy
      esg: 'EIA',        // Change to 'ESG' if your backend supports it
      eng: 'EIA',        // Change to 'ENGINEERING' if supported
      dig: 'EIA',        // Change to 'GIS' / 'DIGITAL' if supported
      train: 'EIA'       // Change to 'TRAINING' if supported
    };
    return map[service] || 'EIA';
  }

  function mapServiceLabel(service) {
    const map = {
      env: 'Environmental',
      esg: 'ESG',
      eng: 'Engineering',
      dig: 'Digital',
      train: 'Training'
    };
    return map[service] || 'Service';
  }

  function escapeHtml(input) {
    return String(input ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* ============================================
     HERO SECTION PERFORMANCE OPTIMIZATIONS
     ============================================ */

  // Optimized scroll handler with throttling
  let scrollTimeout;
  const optimizedScrollHandler = () => {
    if (scrollTimeout) return;
    scrollTimeout = requestAnimationFrame(() => {
      const mainNav = document.getElementById('main-nav');
      if (mainNav) {
        if (window.scrollY > 50) {
          mainNav.classList.add('nav-scrolled', 'py-2');
          mainNav.classList.remove('py-6');
        } else {
          mainNav.classList.remove('nav-scrolled', 'py-2');
          mainNav.classList.add('py-6');
        }
      }
      scrollTimeout = null;
    });
  };

  // Replace existing scroll listener with optimized version
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', optimizedScrollHandler);
    window.addEventListener('scroll', optimizedScrollHandler, { passive: true });
  }

  // Lazy load animations - only animate when in viewport
  const observerOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1
  };

  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        entry.target.classList.add('appear');
        animationObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe fade-in elements for lazy animation
  document.addEventListener('DOMContentLoaded', () => {
    const fadeElements = document.querySelectorAll('.animate-fade-in, .fade-in');
    fadeElements.forEach(el => {
      animationObserver.observe(el);
    });
  });

  // Optimize background animations - reduce on mobile
  const reduceMotionOnMobile = () => {
    if (window.innerWidth < 768) {
      const bgElements = document.querySelectorAll('#main-content .absolute');
      bgElements.forEach(el => {
        el.style.animation = 'none';
        el.style.willChange = 'auto';
      });
    }
  };

  // Run on load and resize
  if (typeof window !== 'undefined') {
    window.addEventListener('load', reduceMotionOnMobile);
    window.addEventListener('resize', reduceMotionOnMobile);
  }

  // Preload critical resources
  const preloadCriticalResources = () => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  };

  // Run preload on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadCriticalResources);
  } else {
    preloadCriticalResources();
  }

  // Optimize scroll indicator visibility
  const scrollIndicator = document.querySelector('#main-content .animate-bounce');
  if (scrollIndicator) {
    const hideOnScroll = () => {
      if (window.scrollY > 100) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.pointerEvents = 'none';
      } else {
        scrollIndicator.style.opacity = '1';
        scrollIndicator.style.pointerEvents = 'auto';
      }
    };
    window.addEventListener('scroll', hideOnScroll, { passive: true });
  }

  // Performance monitoring (only in development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.addEventListener('load', () => {
      if ('performance' in window) {
        const perfData = performance.getEntriesByType('navigation')[0];
        console.log('Page Load Time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
        console.log('DOM Content Loaded:', perfData.domContentLoadedEventEnd - perfData.fetchStart, 'ms');
      }
    });
  }

  /* ============================================
     SERVICE DETAILS TOGGLE FUNCTION
     ============================================ */

  function toggleServiceDetails(element) {
    const serviceCard = element.closest('.service-card');
    const details = serviceCard.querySelector('.service-details');
    const chevron = element.querySelector('.service-chevron');

    if (!details || !chevron) return;

    const isOpen = !details.classList.contains('hidden');

    if (isOpen) {
      // Close
      details.style.maxHeight = details.scrollHeight + 'px';
      setTimeout(() => {
        details.style.maxHeight = '0px';
        setTimeout(() => {
          details.classList.add('hidden');
          chevron.style.transform = 'rotate(0deg)';
        }, 500);
      }, 10);
    } else {
      // Open
      details.classList.remove('hidden');
      details.style.maxHeight = '0px';
      setTimeout(() => {
        details.style.maxHeight = details.scrollHeight + 'px';
        chevron.style.transform = 'rotate(180deg)';
        setTimeout(() => {
          details.style.maxHeight = 'none';
        }, 500);
      }, 10);
    }
  }

  // Make function globally available
  window.toggleServiceDetails = toggleServiceDetails;
