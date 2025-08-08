// This module handles internationalization (i18n) for the application.
// It stores translations and provides a function to switch the language of the UI.

const translations = {
    en: {
        loginTitle: "Login - ActionPad",
        welcomeBack: "Welcome Back!",
        loginPrompt: "Please sign in to continue.",
        email: "Email",
        password: "Password",
        login: "Login",
        noAccount: "Don't have an account?",
        registerHere: "Register here",
        registerTitle: "Register - ActionPad",
        createAccount: "Create Your Account",
        joinTeam: "Join your team or start a new one.",
        fullName: "Full Name",
        nickname: "Nickname",
        companyName: "Company Name",
        companyRole: "Your Role",
        referralId: "Referral ID (Optional)",
        registerAndJoin: "Register & Join",
        hasAccount: "Already have an account?",
        loginHere: "Login here",
        appTitle: "ActionPad",
        inviteTeam: "Invite Team",
        logout: "Logout",
        views: "Views",
        listView: "List",
        kanbanView: "Kanban",
        calendarView: "Calendar",
        addTask: "Add Task",
        todo: "To Do",
        inProgress: "In Progress",
        done: "Done",
        daySun: "Sun", dayMon: "Mon", dayTue: "Tue", dayWed: "Wed", dayThu: "Thu", dayFri: "Fri", daySat: "Sat",
        inviteModalTitle: "Invite Your Teammates",
        inviteModalDesc: "Share this link with your team. When they sign up, they'll automatically join your company.",
        copyLink: "Copy Link",
        linkCopied: "Link copied to clipboard!"
    },
    sv: {
        loginTitle: "Logga in - ActionPad",
        welcomeBack: "Välkommen tillbaka!",
        loginPrompt: "Vänligen logga in för att fortsätta.",
        email: "E-post",
        password: "Lösenord",
        login: "Logga in",
        noAccount: "Har du inget konto?",
        registerHere: "Registrera dig här",
        registerTitle: "Registrera - ActionPad",
        createAccount: "Skapa ditt konto",
        joinTeam: "Gå med i ditt team eller starta ett nytt.",
        fullName: "Fullständigt namn",
        nickname: "Smeknamn",
        companyName: "Företagsnamn",
        companyRole: "Din roll",
        referralId: "Referenskod (Valfritt)",
        registerAndJoin: "Registrera & Gå med",
        hasAccount: "Har du redan ett konto?",
        loginHere: "Logga in här",
        appTitle: "ActionPad",
        inviteTeam: "Bjud in teamet",
        logout: "Logga ut",
        views: "Vyer",
        listView: "Lista",
        kanbanView: "Kanban",
        calendarView: "Kalender",
        addTask: "Lägg till uppgift",
        todo: "Att göra",
        inProgress: "Pågående",
        done: "Klar",
        daySun: "Sön", dayMon: "Mån", dayTue: "Tis", dayWed: "Ons", dayThu: "Tor", dayFri: "Fre", daySat: "Lör",
        inviteModalTitle: "Bjud in dina kollegor",
        inviteModalDesc: "Dela den här länken med ditt team. När de registrerar sig går de automatiskt med i ditt företag.",
        copyLink: "Kopiera länk",
        linkCopied: "Länk kopierad till urklipp!"
    },
    zh: {
        loginTitle: "登录 - ActionPad",
        welcomeBack: "欢迎回来！",
        loginPrompt: "请登录以继续。",
        email: "电子邮件",
        password: "密码",
        login: "登录",
        noAccount: "没有帐户？",
        registerHere: "在此注册",
        registerTitle: "注册 - ActionPad",
        createAccount: "创建您的帐户",
        joinTeam: "加入您的团队或创建一个新团队。",
        fullName: "全名",
        nickname: "昵称",
        companyName: "公司名称",
        companyRole: "你的角色",
        referralId: "推荐ID（可选）",
        registerAndJoin: "注册并加入",
        hasAccount: "已有帐户？",
        loginHere: "在此登录",
        appTitle: "ActionPad",
        inviteTeam: "邀请团队",
        logout: "登出",
        views: "视图",
        listView: "列表",
        kanbanView: "看板",
        calendarView: "日历",
        addTask: "添加任务",
        todo: "待办",
        inProgress: "进行中",
        done: "已完成",
        daySun: "日", dayMon: "一", dayTue: "二", dayWed: "三", dayThu: "四", dayFri: "五", daySat: "六",
        inviteModalTitle: "邀请您的队友",
        inviteModalDesc: "与您的团队分享此链接。他们注册后，将自动加入您的公司。",
        copyLink: "复制链接",
        linkCopied: "链接已复制到剪贴板！"
    }
};

// Finds all elements with a `data-i18n` attribute and sets their text content.
const setLanguage = (language) => {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[language] && translations[language][key]) {
            element.textContent = translations[language][key];
        }
    });
    document.documentElement.lang = language;
    localStorage.setItem('actionPadLanguage', language);

    // Update the active state of the language buttons.
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === language);
    });
};

// Initializes the language switcher and sets the initial language.
export const initializeI18n = () => {
    const languageSwitcher = document.querySelector('.language-switcher');
    if (languageSwitcher) {
        languageSwitcher.addEventListener('click', (e) => {
            if (e.target.matches('.lang-btn')) {
                setLanguage(e.target.dataset.lang);
            }
        });
    }

    const savedLanguage = localStorage.getItem('actionPadLanguage') || 'en';
    setLanguage(savedLanguage);
};
