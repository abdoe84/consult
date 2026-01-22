/* ============================================
   MULTILINGUAL SUPPORT (i18n)
   Arabic / English Language Support
   ============================================ */

const translations = {
  ar: {
    // Navigation
    nav: {
      about: "من نحن",
      services: "خدماتنا",
      stats: "إنجازاتنا",
      testimonials: "اعتمادات",
      clients: "عملاؤنا",
      contact: "تواصل معنا"
    },
    // Hero Section
    hero: {
      badge: "الاستشارات البيئية والهندسية",
      title1: "حلول",
      title2: "مستدامة",
      title3: "للمستقبل الذي نبنيه معاً",
      title1html: "حلول <span class=\"gradient-text\">مستدامة</span>",
      description: "نقدم استشارات متخصصة في المجال البيئي والهندسي والرقمي لإنشاء حلول مبتكرة توازن بين التطور والحفاظ على البيئة",
      cta1: "اطلب الخدمة الآن",
      cta2: "تحميل ملفنا التعريفي",
      scroll: "اكتشف المزيد"
    },
    // Trust Indicators
    trust: {
      projects: "مشروع ناجح",
      awards: "جائزة و تقدير",
      clients: "عميل راضٍ",
      satisfaction: "رضا العملاء"
    },
    // Sections
    sections: {
      about: {
        title: "من نحن",
        description: "قسم الاستشارات و الخدمات البيئية و الهندسية بشركة ريفايفا الرائدة في قطاع ادارة و معالجة النفايات الصناعية- نحن في قسم الاستشاراتنتشرف بتقديم الحلول البيئية والهندسية والرقمية للشركات والمؤسسات. نحن نؤمن بأن الاستدامة والابتكار هما مفتاح المستقبل.",
        since: "منذ عام 2023، نعمل مع العملاء لتحويل التحديات البيئية والهندسية إلى فرص للنمو المستدام، مع التركيز على حلول مبتكرة وعملية تلبي أفضل الممارسات العالمية.",
        timeline: {
          founded: {
            year: "2009",
            title: "تأسيس الشركة",
            description: "انطلقت مسيرتنا في عام 2009 ككيان ناشئ يحمل رؤية طموحة لوضع معايير جديدة في قطاع الأعمال المحلي. مع التركيز على الجودة والنمو المستدام."
          },
          acquisition: {
            year: "2020",
            title: "الاستحواذ الاستراتيجي",
            description: "في عام 2020، تم الاستحواذ على الشركة من قبل صندوق الاستثمارات العامة السعودي (PIF)، مما أطلق مرحلة جديدة من التوسع العالمي والتمكين المالي الضخم."
          },
          launch: {
            year: "2022",
            title: "إطلاق الخدمات الاستشارية",
            description: "توجنا مسيرة النمو في 2022 بتأسيس قسم \"الخدمات الاستشارية\"، لنقدم خبراتنا العميقة وحلولنا المبتكرة لدعم نجاح شركائنا وعملائنا في مختلف القطاعات."
          },
          engineering: {
            year: "2026",
            title: "إطلاق خدمة الاستشارات الهندسية",
            description: "في عام 2026، أطلقنا خدمة الاستشارات الهندسية المتخصصة لتقديم حلول هندسية شاملة ومبتكرة تلبي احتياجات المشاريع المختلفة من التصميم إلى التنفيذ والإشراف."
          }
        }
      },
      services: {
        title: "خدماتنا",
        description: "نقدم مجموعة شاملة من الخدمات الاستشارية البيئية والهندسية والرقمية",
        viewDetails: "عرض التفاصيل",
        comingSoon: "قريباً: سيتم إضافة تفاصيل الخدمات الرقمية",
        environmental: {
          title: "الاستشارات البيئية",
          description: "استشارات متخصصة في المجال البيئي لتقييم الأثر البيئي وتقديم الحلول المستدامة",
          subservices: [
            "تقييم الأثر البيئي (EIA / ESIA / EMP)",
            "المراقبة والقياسات البيئية",
            "نمذجة انتشار الهواء - US EPA AERMOD",
            "إدارة المخاطر البيئية",
            "إدارة النفايات ومكافحة التلوث",
            "المراجعة البيئية والاجتماعية (الصناعية والسكنية)",
            "دراسات التنوع البيولوجي والموارد الطبيعية",
            "تقييم الأراضي والتربة",
            "دراسات الموارد المائية والهيدرولوجية",
            "الدراسات البحرية والساحلية البيئية"
          ]
        },
        permitting: {
          title: "التصاريح البيئية والامتثال",
          description: "خدمات الحصول على التصاريح البيئية والامتثال للمعايير واللوائح",
          subservices: [
            "EPC (MWAN, NCEC, MEWA & RCJY)",
            "EPO (MWAN, NCEC, MEWA & RCJY)"
          ]
        },
        esg: {
          title: "الحوكمة البيئية والاجتماعية (ESG)",
          description: "خدمات متخصصة في تطبيق معايير الحوكمة البيئية والاجتماعية لتحقيق الاستدامة",
          subservices: [
            "إطار عمل ESG",
            "تقارير ESG",
            "البصمة الكربونية",
            "استراتيجيات التخفيف من غازات الدفيئة",
            "معالجة وإدارة المياه العادمة",
            "تحويل النفايات إلى طاقة",
            "استشارات نمذجة السواحل وتغير المناخ"
          ]
        },
        engineering: {
          title: "الهندسة",
          description: "خدمات هندسية شاملة تتراوح من التصميم إلى التنفيذ والإشراف على المشاريع",
          subservices: [
            "خدمات نظم المعلومات الجغرافية (GIS)",
            "الدراسات الطبوغرافية",
            "المسح الأرضي",
            "تنفيذ ومراقبة وتصميم المطامر والبرك",
            "خدمات بطانة HDPE",
            "قياس الكميات"
          ]
        },
        digitalization: {
          title: "التحول الرقمي",
          description: "حلول رقمية متكاملة لتحويل عملياتك وإدارة مواردك بكفاءة عالية"
        },
        training: {
          title: "التدريب البيئي وبناء القدرات",
          description: "برامج تدريبية متخصصة لبناء القدرات وتطوير المهارات في المجالات البيئية والاستدامة",
          subservices: [
            "التدريب على التوعية البيئية",
            "تحديد النفايات",
            "التعامل مع المواد الكيميائية",
            "H2S",
            "تدريب إدارة النفايات"
          ]
        }
      },
      stats: {
        title: "إنجازاتنا",
        description: "نقدم لك نتائج ملموسة ومؤثرة في المشاريع البيئية والهندسية"
      },
      clients: {
        title: "عملاؤنا",
        description: "نحن فخورون بخدمة مجموعة متميزة من العملاء والشركات الرائدة في المملكة"
      },
      testimonials: {
        title: "الاعتمادات",
        description: "نحن معتمدون بأعلى المعايير الدولية للجودة والبيئة والسلامة"
      },
      contact: {
        title: "تواصل معنا",
        description: "نحن هنا لمساعدتك في مشاريعك البيئية والهندسية",
        office: "مكتبنا الرئيسي",
        location: "جدة، حي النهضة، مبنى REVIVA",
        phone: "الهاتف",
        email: "البريد الإلكتروني",
        hours: "ساعات العمل",
        hoursValue: "الأحد - الخميس: 8:00 صباحاً - 5:00 مساءً"
      }
    },
    // Form
    form: {
      welcome: "مرحباً بك في ريفايفا",
      step1: "يرجى تزويدنا بمعلومات التواصل والمنشأة",
      step2Title: "تفاصيل الخدمة",
      step2Description: "ساعدنا في فهم متطلباتك لنقدم لك أفضل استشارة",
      fullName: "الاسم الكامل / اسم المنشأة",
      email: "البريد الإلكتروني",
      phone: "رقم التواصل",
      service: "اختر نوع الخدمة",
      subservice: "اختر الخدمة الفرعية",
      selectSubservice: "-- اختر الخدمة الفرعية --",
      description: "وصف المشروع",
      attachments: "المرفقات (اختياري)",
      attachmentsHint: "يمكنك رفع ملفات PDF، Word， Excel، صور، أو ملفات مضغوطة (حجم الملف الواحد لا يتجاوز 10MB)",
      next: "التالي",
      prev: "السابق",
      submit: "إرسال",
      charCount: "حرف",
      successTitle: "تم الإرسال بنجاح!",
      successMessage: "شكراً",
      successMessage2: "، تم إنشاء الطلب بنجاح.",
      successReference: "رقم المرجع:",
      successContact: "سنعاود الاتصال بك خلال ساعات قليلة على البريد الإلكتروني أو رقم الهاتف المقدم.",
      okButton: "حسناً"
    },
    // Common
    common: {
      darkMode: "تبديل الوضع الليلي",
      openMenu: "فتح القائمة",
      closeMenu: "إغلاق القائمة",
      employeeLogin: "دخول الموظفين",
      backToTop: "العودة إلى الأعلى"
    },
    // Footer
    footer: {
      description: "نحن قسم الاستشارات في شركة ريفايفا  نقدم حلولًا بيئية وهندسية مبتكرة لتحقيق أهداف الاستدامة والنمو المسؤول.",
      sustainability: "استدامة",
      innovation: "ابتكار",
      quality: "نوعية",
      professionalism: "احترافية",
      quickLinks: "روابط سريعة",
      contactUs: "اتصل بنا",
      whatsapp: "واتساب",
      email: "البريد الإلكتروني",
      copyright: "جميع الحقوق محفوظة — قطاع البيئة والاستدامة قسم الاستشارات."
    }
  },
  en: {
    // Navigation
    nav: {
      about: "About Us",
      services: "Our Services",
      stats: "Our Achievements",
      testimonials: "Accreditations",
      clients: "Our Clients",
      contact: "Contact Us"
    },
    // Hero Section
    hero: {
      badge: "Environmental & Engineering Consultations",
      title1: "Solutions",
      title2: "Sustainable",
      title3: "For the Future We Build Together",
      title1html: "<span class=\"gradient-text\">Sustainable</span> Solutions",
      description: "We offer specialized consultations in the environmental, engineering, and digital fields to create innovative solutions that balance development and environmental preservation",
      cta1: "Request Service Now",
      cta2: "Download Our Profile",
      scroll: "Discover More"
    },
    // Trust Indicators
    trust: {
      projects: "Successful Projects",
      awards: "Awards & Recognition",
      clients: "Satisfied Clients",
      satisfaction: "Client Satisfaction"
    },
    // Sections
    sections: {
      about: {
        title: "About Us",
        description: "The Environmental and Engineering Consultations and Services Division of REVIVA, a leading company in industrial waste management and treatment - We in the Consultations Division are honored to provide environmental, engineering, and digital solutions for companies and institutions. We believe that sustainability and innovation are the keys to the future.",
        since: "Since 2023, we have been working with clients to transform environmental and engineering challenges into opportunities for sustainable growth, focusing on innovative and practical solutions that meet the best global practices.",
        timeline: {
          founded: {
            year: "2009",
            title: "Company Foundation",
            description: "We started our journey in 2009 as an emerging entity with an ambitious vision to set new standards in the local business sector, focusing on quality and sustainable growth."
          },
          acquisition: {
            year: "2020",
            title: "Strategic Acquisition",
            description: "In 2020, the company was acquired by the Saudi Public Investment Fund (PIF), launching a new phase of global expansion and massive financial empowerment."
          },
          launch: {
            year: "2022",
            title: "Launch of Consultancy Services",
            description: "We crowned our growth journey in 2022 by establishing the \"Consultancy Services\" division, to provide our deep expertise and innovative solutions to support the success of our partners and clients across various sectors."
          },
          engineering: {
            year: "2026",
            title: "Launch of Engineering Consultancy Services",
            description: "In 2026, we launched specialized engineering consultancy services to provide comprehensive and innovative engineering solutions that meet the diverse needs of projects from design to implementation and supervision."
          }
        }
      },
      services: {
        title: "Our Services",
        description: "We offer a comprehensive range of environmental, engineering, and digital consulting services",
        viewDetails: "View Details",
        comingSoon: "Coming Soon: Digital services details will be added",
        environmental: {
          title: "Environmental Consultancy",
          description: "Specialized consultations in the environmental field to assess environmental impact and provide sustainable solutions",
          subservices: [
            "Environmental Impact Assessment (EIA / ESIA / EMP)",
            "Environmental Monitoring & Measurements",
            "Air Dispersion Modeling - US EPA AERMOD",
            "Environmental Risk Management",
            "Waste Management & Pollution Control",
            "Environmental & Social Audit (Including Industrial & Housing)",
            "Biodiversity & Natural Resource Studies",
            "Land & Soil Assessment",
            "Water Resources & Hydrological Studies",
            "Marine & Coastal Environmental Studies"
          ]
        },
        permitting: {
          title: "Environmental Permitting & Compliance",
          description: "Services for obtaining environmental permits and compliance with standards and regulations",
          subservices: [
            "EPC (MWAN, NCEC, MEWA & RCJY)",
            "EPO (MWAN, NCEC, MEWA & RCJY)"
          ]
        },
        esg: {
          title: "ESG (Environmental, Social, and Governance)",
          description: "Specialized services in applying environmental and social governance standards to achieve sustainability",
          subservices: [
            "ESG Framework",
            "ESG Reporting",
            "Carbon Footprint",
            "GHG Mitigation Strategies",
            "Effluent Treatment & Management",
            "Waste-To-Energy",
            "Coastal and Climate Change Modelling Consultancy"
          ]
        },
        engineering: {
          title: "Engineering",
          description: "Comprehensive engineering services ranging from design to implementation and project supervision",
          subservices: [
            "GIS Services",
            "Topographic Studies",
            "Land Surveying",
            "Landfill & Ponds Execution, Monitoring & Designing",
            "HDPE Liner Services",
            "Quantity Surveying"
          ]
        },
        digitalization: {
          title: "Digitalization",
          description: "Integrated digital solutions to transform your operations and manage your resources efficiently"
        },
        training: {
          title: "Environmental Training & Capacity Building",
          description: "Specialized training programs to build capacity and develop skills in environmental and sustainability fields",
          subservices: [
            "Environmental Awareness Training",
            "Waste Identification",
            "Chemical Handling",
            "H2S",
            "Waste Management Training"
          ]
        }
      },
      stats: {
        title: "Our Achievements",
        description: "We deliver tangible and impactful results in environmental and engineering projects"
      },
      clients: {
        title: "Our Clients",
        description: "We are proud to serve a distinguished group of clients and leading companies in the Kingdom"
      },
      testimonials: {
        title: "Accreditations",
        description: "We are certified with the highest international standards for quality, environment, and safety"
      },
      contact: {
        title: "Contact Us",
        description: "We are here to help you with your environmental and engineering projects",
        office: "Our Main Office",
        location: "Jeddah, Al-Nahda District, REVIVA Building",
        phone: "Phone",
        email: "Email",
        hours: "Working Hours",
        hoursValue: "Sunday - Thursday: 8:00 AM - 5:00 PM"
      }
    },
    // Form
    form: {
      welcome: "Welcome to REVIVA",
      step1: "Please provide us with contact and establishment information",
      step2Title: "Service Details",
      step2Description: "Help us understand your requirements to provide you with the best consultation",
      fullName: "Full Name / Establishment Name",
      email: "Email",
      phone: "Contact Number",
      service: "Choose Service Type",
      subservice: "Choose Sub-Service",
      selectSubservice: "-- Select Sub-Service --",
      description: "Project Description",
      attachments: "Attachments (Optional)",
      attachmentsHint: "You can upload PDF, Word, Excel, images, or compressed files (max 10MB per file)",
      next: "Next",
      prev: "Previous",
      submit: "Submit",
      charCount: "characters",
      successTitle: "Submitted Successfully!",
      successMessage: "Thank you",
      successMessage2: ", your request has been created successfully.",
      successReference: "Reference Number:",
      successContact: "We will contact you within a few hours via the provided email or phone number.",
      okButton: "OK"
    },
    // Common
    common: {
      darkMode: "Toggle Dark Mode",
      openMenu: "Open Menu",
      closeMenu: "Close Menu",
      employeeLogin: "Employee Login",
      backToTop: "Back to Top"
    },
    // Footer
    footer: {
      description: "We are the Consultations Division of REVIVA, providing innovative environmental and engineering solutions to achieve sustainability and responsible growth goals.",
      sustainability: "Sustainability",
      innovation: "Innovation",
      quality: "Quality",
      professionalism: "Professionalism",
      quickLinks: "Quick Links",
      contactUs: "Contact Us",
      whatsapp: "WhatsApp",
      email: "Email",
      copyright: "All rights reserved — Environment and Sustainability Sector, Consultations Division."
    }
  }
};

// Language Manager
class LanguageManager {
  constructor() {
    this.currentLang = localStorage.getItem('language') || 'ar';
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setLanguage(this.currentLang);
        this.updateDirection();
        this.updateMetadata();
        this.addHreflangTags();
      });
    } else {
      this.setLanguage(this.currentLang);
      this.updateDirection();
      this.updateMetadata();
      this.addHreflangTags();
    }
  }

  setLanguage(lang) {
    if (!translations[lang]) return;

    this.currentLang = lang;
    localStorage.setItem('language', lang);

    // Update HTML attributes (check if documentElement exists)
    if (document.documentElement) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }

    // Update all translatable elements
    this.translatePage();
    this.updateDirection();
    this.updateMetadata();
    this.updateLanguageButton();

    // Trigger custom event
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }
  }

  translatePage() {
    if (typeof document === 'undefined') return;

    // Translate elements with data-i18n attribute
    const i18nElements = document.querySelectorAll('[data-i18n]');
    if (i18nElements) {
      i18nElements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = this.getTranslation(key);
        if (translation) {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translation;
          } else {
            element.textContent = translation;
          }
        }
      });
    }

    // Translate elements with data-i18n-html (for HTML content)
    const htmlElements = document.querySelectorAll('[data-i18n-html]');
    if (htmlElements) {
      htmlElements.forEach(element => {
        const key = element.getAttribute('data-i18n-html');
        const translation = this.getTranslation(key);
        if (translation) {
          element.innerHTML = translation;
        }
      });
    }

    // Special handling for hero title
    const heroTitle1 = document.getElementById('hero-title-1');
    if (heroTitle1) {
      const translation = this.getTranslation('hero.title1html');
      if (translation) {
        heroTitle1.innerHTML = translation;
      }
    }

    // Translate placeholder attributes
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    if (placeholderElements) {
      placeholderElements.forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const translation = this.getTranslation(key);
        if (translation) {
          element.placeholder = translation;
        }
      });
    }

    // Translate aria-labels
    const ariaElements = document.querySelectorAll('[data-i18n-aria]');
    if (ariaElements) {
      ariaElements.forEach(element => {
        const key = element.getAttribute('data-i18n-aria');
        const translation = this.getTranslation(key);
        if (translation) {
          element.setAttribute('aria-label', translation);
        }
      });
    }

    // Translate title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    if (titleElements) {
      titleElements.forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        const translation = this.getTranslation(key);
        if (translation) {
          element.setAttribute('title', translation);
        }
      });
    }
  }

  getTranslation(key) {
    const keys = key.split('.');
    let value = translations[this.currentLang];

    for (const k of keys) {
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        // Support array indices
        const numKey = parseInt(k, 10);
        if (!isNaN(numKey) && Array.isArray(value)) {
          value = value[numKey];
        } else if (value[k]) {
          value = value[k];
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    return value;
  }

  updateDirection() {
    const html = document.documentElement;
    const body = document.body;
    const isRTL = this.currentLang === 'ar';

    if (!html) return;

    html.dir = isRTL ? 'rtl' : 'ltr';
    html.lang = this.currentLang;

    // Update body classes for RTL/LTR (check if body exists)
    if (body) {
      body.classList.remove('rtl', 'ltr');
      body.classList.add(isRTL ? 'rtl' : 'ltr');
    }

    // Update Tailwind direction classes
    const nav = document.getElementById('main-nav');
    if (nav) {
      if (isRTL) {
        nav.classList.remove('ltr');
        nav.classList.add('rtl');
      } else {
        nav.classList.remove('rtl');
        nav.classList.add('ltr');
      }
    }
  }

  updateMetadata() {
    if (typeof document === 'undefined') return;

    const metaDescription = document.querySelector('meta[name="description"]');
    const title = document.querySelector('title');

    if (this.currentLang === 'ar') {
      if (metaDescription) {
        metaDescription.content = "ريفيڤا - شركة استشارية رائدة في المجال البيئي والهندسي والرقمي. نقدم حلول مستدامة ومبتكرة للشركات والمؤسسات.";
      }
      if (title) {
        title.textContent = "REVIVA | قسم الاستشارات";
      }
    } else {
      if (metaDescription) {
        metaDescription.content = "REVIVA - A leading consulting company in environmental, engineering, and digital fields. We provide sustainable and innovative solutions for companies and institutions.";
      }
      if (title) {
        title.textContent = "REVIVA | Consultations Division";
      }
    }
  }

  addHreflangTags() {
    if (typeof document === 'undefined' || !document.head) return;

    // Remove existing hreflang tags
    const existingLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingLinks.forEach(link => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });

    // Add hreflang tags
    const head = document.head;
    const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';

    ['ar', 'en'].forEach(lang => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      link.href = currentUrl;
      if (head) {
        head.appendChild(link);
      }
    });

    // Add x-default
    const defaultLink = document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = currentUrl;
    if (head) {
      head.appendChild(defaultLink);
    }
  }

  updateLanguageButton() {
    if (typeof document === 'undefined') return;

    const langBtn = document.getElementById('language-toggle');
    if (langBtn) {
      const icon = langBtn.querySelector('i');
      const text = langBtn.querySelector('#lang-text') || langBtn.querySelector('span');

      if (this.currentLang === 'ar') {
        if (icon) icon.className = 'fas fa-language text-sm md:text-base';
        if (text) text.textContent = 'EN';
        langBtn.setAttribute('aria-label', 'Switch to English');
        langBtn.setAttribute('title', 'Switch to English');
      } else {
        if (icon) icon.className = 'fas fa-language text-sm md:text-base';
        if (text) text.textContent = 'AR';
        langBtn.setAttribute('aria-label', 'التبديل إلى العربية');
        langBtn.setAttribute('title', 'التبديل إلى العربية');
      }
    }
  }

  toggleLanguage() {
    const newLang = this.currentLang === 'ar' ? 'en' : 'ar';
    this.setLanguage(newLang);
  }

  formatNumber(number) {
    if (this.currentLang === 'ar') {
      // Arabic-Indic numerals
      return new Intl.NumberFormat('ar-SA').format(number);
    } else {
      return new Intl.NumberFormat('en-US').format(number);
    }
  }

  formatDate(date) {
    if (this.currentLang === 'ar') {
      return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    }
  }
}

// Initialize Language Manager (wait for DOM)
let languageManager;

function initLanguageManager() {
  try {
    if (typeof LanguageManager !== 'undefined') {
      languageManager = new LanguageManager();
    } else {
      console.warn('LanguageManager class not defined');
    }
  } catch (error) {
    console.error('Error initializing language manager:', error);
  }
}

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageManager);
  } else {
    // DOM already loaded
    initLanguageManager();
  }
} else {
  // Fallback: try to initialize after a delay
  setTimeout(initLanguageManager, 100);
}

// Global function for language toggle
function toggleLanguage() {
  if (typeof languageManager !== 'undefined' && languageManager) {
    languageManager.toggleLanguage();
  } else {
    console.warn('Language manager not initialized yet');
    // Retry after a short delay
    setTimeout(() => {
      if (typeof languageManager !== 'undefined' && languageManager) {
        languageManager.toggleLanguage();
      }
    }, 100);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { languageManager, translations };
}
