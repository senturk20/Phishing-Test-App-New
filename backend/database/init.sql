-- Phishing Simulation Database Schema
-- PostgreSQL

-- ============================================
-- EMAIL TEMPLATES TABLE
-- (Created before campaigns due to foreign key reference)
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LANDING PAGES TABLE
-- (Created before campaigns due to foreign key reference)
-- ============================================
CREATE TABLE IF NOT EXISTS landing_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    html TEXT NOT NULL,
    original_url TEXT DEFAULT '',
    is_cloned BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
    target_count INTEGER DEFAULT 0,

    -- Scheduling fields
    frequency VARCHAR(50) DEFAULT 'once' CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly')),
    start_date DATE,
    start_time TIME,
    timezone VARCHAR(100) DEFAULT 'Europe/Istanbul',

    -- Sending configuration
    sending_mode VARCHAR(50) DEFAULT 'all' CHECK (sending_mode IN ('all', 'spread')),
    spread_days INTEGER DEFAULT 3,
    spread_unit VARCHAR(20) DEFAULT 'days' CHECK (spread_unit IN ('hours', 'days')),
    business_hours_start TIME DEFAULT '09:00',
    business_hours_end TIME DEFAULT '17:00',
    business_days TEXT DEFAULT '["mon","tue","wed","thu","fri"]',
    track_activity_days INTEGER DEFAULT 7,

    -- Email template configuration
    category VARCHAR(50) DEFAULT 'it',
    template_mode VARCHAR(50) DEFAULT 'random' CHECK (template_mode IN ('random', 'specific')),
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,

    -- Phishing configuration
    phish_domain VARCHAR(255) DEFAULT 'random',
    landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
    add_clickers_to_group VARCHAR(100),
    send_report_email BOOLEAN DEFAULT true,

    -- Next scheduled run (for recurring campaigns)
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('clicked', 'submitted')),
    recipient_token VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RECIPIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) DEFAULT '',
    last_name VARCHAR(255) DEFAULT '',
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'clicked', 'submitted', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Unique constraint for LDAP sync (same email can be in different campaigns)
    CONSTRAINT unique_campaign_email UNIQUE (campaign_id, email)
);

-- ============================================
-- SAMPLE DATA - EMAIL TEMPLATES
-- ============================================
INSERT INTO email_templates (name, subject, body, category, is_default) VALUES
(
    'IT - Şifre Sıfırlama',
    'Acil: Şifrenizi Sıfırlayın',
    '<p>Sayın {{firstName}} {{lastName}},</p>
    <p>Güvenlik politikalarımız gereği tüm çalışanların şifrelerini güncellemeleri gerekmektedir.</p>
    <p>Lütfen <a href="{{trackingLink}}">buraya tıklayarak</a> şifrenizi 24 saat içinde güncelleyin.</p>
    <p>Bu işlemi yapmazsanız hesabınız geçici olarak askıya alınacaktır.</p>
    <p>Saygılarımızla,<br>IT Departmanı</p>',
    'it',
    true
),
(
    'HR - Belge Onayı',
    'Belge Onayınız Bekleniyor',
    '<p>Merhaba {{firstName}},</p>
    <p>İnsan Kaynakları departmanından yeni bir belge onayınızı bekliyor.</p>
    <p><a href="{{trackingLink}}">Belgeyi görüntülemek için tıklayın</a></p>
    <p>Son onay tarihi: 3 gün</p>
    <p>İK Departmanı</p>',
    'hr',
    false
),
(
    'Finans - Ödeme Bildirimi',
    'Bekleyen Ödeme İşlemi',
    '<p>Sayın {{firstName}} {{lastName}},</p>
    <p>Hesabınızda bekleyen bir ödeme işlemi bulunmaktadır.</p>
    <p><a href="{{trackingLink}}">Ödeme detaylarını görüntüle</a></p>
    <p>Tutarı kontrol edip onaylamanız gerekmektedir.</p>
    <p>Finans Departmanı</p>',
    'finance',
    false
),
(
    'Genel - Güvenlik Uyarısı',
    'Hesabınızda Şüpheli Aktivite',
    '<p>Sayın Kullanıcı,</p>
    <p>Hesabınızda olağandışı bir giriş denemesi tespit edildi.</p>
    <p>Siz değilseniz, <a href="{{trackingLink}}">hemen güvenlik kontrolü yapın</a>.</p>
    <p>Lokasyon: Bilinmeyen<br>Cihaz: Bilinmeyen</p>
    <p>Güvenlik Ekibi</p>',
    'general',
    false
),
(
    'IT - VPN Güncellemesi',
    'VPN Yazılımı Güncelleme Gerekli',
    '<p>Merhaba {{firstName}},</p>
    <p>Şirket VPN yazılımının yeni sürümü yayınlandı.</p>
    <p><a href="{{trackingLink}}">Güncellemeyi indirmek için tıklayın</a></p>
    <p>Eski sürüm 1 hafta sonra devre dışı kalacaktır.</p>
    <p>IT Destek Ekibi</p>',
    'it',
    false
);

-- ============================================
-- SAMPLE DATA - LANDING PAGES
-- ============================================
INSERT INTO landing_pages (name, html, is_default) VALUES
(
    'Sahte Office 365 Giriş',
    '<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Oturum Açın - Microsoft hesabınız</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #1b1b1b;
        }
        .login-container {
            width: 100%;
            max-width: 440px;
            padding: 44px;
        }
        .logo-container {
            text-align: center;
            margin-bottom: 16px;
        }
        .ms-logo {
            width: 108px;
            height: 24px;
        }
        .card {
            background: #fff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            padding: 44px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #1b1b1b;
        }
        .subtitle {
            font-size: 15px;
            color: #605e5c;
            margin-bottom: 24px;
        }
        .input-group {
            margin-bottom: 16px;
        }
        label {
            display: block;
            font-size: 13px;
            margin-bottom: 4px;
            color: #323130;
        }
        input[type="email"],
        input[type="password"] {
            width: 100%;
            padding: 8px 12px;
            font-size: 15px;
            border: 1px solid #8a8886;
            border-radius: 2px;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="email"]:focus,
        input[type="password"]:focus {
            border-color: #0078d4;
        }
        input[type="email"]:hover,
        input[type="password"]:hover {
            border-color: #323130;
        }
        .error-message {
            display: none;
            color: #a4262c;
            font-size: 12px;
            margin-top: 4px;
        }
        .checkbox-container {
            display: flex;
            align-items: center;
            margin: 16px 0;
        }
        input[type="checkbox"] {
            margin-right: 8px;
            width: 16px;
            height: 16px;
        }
        .checkbox-label {
            font-size: 15px;
            color: #323130;
            cursor: pointer;
        }
        .action-buttons {
            margin-top: 24px;
        }
        .btn-primary {
            width: 100%;
            padding: 10px;
            background: #0067b8;
            color: #fff;
            border: none;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            border-radius: 2px;
            transition: background 0.2s;
        }
        .btn-primary:hover {
            background: #005a9e;
        }
        .btn-primary:active {
            background: #004578;
        }
        .links {
            margin-top: 16px;
            text-align: left;
        }
        .links a {
            color: #0067b8;
            text-decoration: none;
            font-size: 13px;
            display: block;
            margin-bottom: 8px;
        }
        .links a:hover {
            text-decoration: underline;
        }
        .footer {
            margin-top: 24px;
            text-align: center;
        }
        .footer-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }
        .footer-links a {
            color: #605e5c;
            font-size: 12px;
            text-decoration: none;
        }
        .footer-links a:hover {
            text-decoration: underline;
        }
        .success-message {
            display: none;
            background: #dff6dd;
            border: 1px solid #107c10;
            color: #107c10;
            padding: 16px;
            margin-bottom: 16px;
            border-radius: 2px;
        }
        .warning-message {
            background: #fff4ce;
            border: 1px solid #ffb900;
            color: #323130;
            padding: 12px;
            margin-bottom: 16px;
            border-radius: 2px;
            font-size: 13px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo-container">
            <svg class="ms-logo" viewBox="0 0 108 24">
                <path fill="#f25022" d="M0 0h10.8v10.8H0z"/>
                <path fill="#00a4ef" d="M12 0h10.8v10.8H12z"/>
                <path fill="#7fba00" d="M0 12h10.8v10.8H0z"/>
                <path fill="#ffb900" d="M12 12h10.8v10.8H12z"/>
            </svg>
        </div>

        <div class="card">
            <div class="warning-message" id="warningMsg">
                ⚠️ Güvenlik nedeniyle oturumunuzun süresi dolmuştur. Lütfen tekrar giriş yapın.
            </div>

            <div class="success-message" id="successMsg">
                ✓ Giriş başarılı! Yönlendiriliyorsunuz...
            </div>

            <h1>Oturum açın</h1>
            <p class="subtitle">Hesabınıza erişmek için e-posta adresinizi ve şifrenizi girin</p>

            <form id="phishForm">
                <div class="input-group">
                    <label for="email">E-posta, telefon veya Skype</label>
                    <input type="email" id="email" name="email" required autocomplete="username">
                    <div class="error-message" id="emailError">Lütfen geçerli bir e-posta adresi girin.</div>
                </div>

                <div class="input-group">
                    <label for="password">Parola</label>
                    <input type="password" id="password" name="password" required autocomplete="current-password">
                    <div class="error-message" id="passwordError">Parola gereklidir.</div>
                </div>

                <div class="checkbox-container">
                    <input type="checkbox" id="keepSignedIn" name="keepSignedIn">
                    <label for="keepSignedIn" class="checkbox-label">Oturumumu açık tut</label>
                </div>

                <div class="action-buttons">
                    <button type="submit" class="btn-primary">Oturum aç</button>
                </div>

                <div class="links">
                    <a href="#">Hesabınıza erişemiyor musunuz?</a>
                    <a href="#">Hesap oluşturun</a>
                </div>
            </form>
        </div>

        <div class="footer">
            <div class="footer-links">
                <a href="#">Şartlar</a>
                <a href="#">Gizlilik ve tanımlama bilgileri</a>
                <a href="#">...</a>
            </div>
        </div>
    </div>

    <script>
        // Show warning message on page load
        setTimeout(function() {
            document.getElementById("warningMsg").style.display = "block";
        }, 500);

        // Handle form submission
        document.getElementById("phishForm").addEventListener("submit", function(e) {
            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            // Hide form and show success message
            document.getElementById("phishForm").style.display = "none";
            document.getElementById("warningMsg").style.display = "none";
            document.getElementById("successMsg").style.display = "block";

            // Track the event (submitted)
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get("token");
            const campaignId = urlParams.get("campaign");

            if (token && campaignId) {
                fetch("/api/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "submitted",
                        campaignId: campaignId,
                        recipientToken: token
                    })
                }).catch(err => console.error("Tracking error:", err));
            }

            // Show educational message after a delay
            setTimeout(function() {
                alert("⚠️ PHISHING UYARISI!\n\nBu bir phishing simülasyonuydu!\n\nSiz de bir phishing saldırısının kurbanı oldunuz. Gerçek bir saldırı olsaydı, hesabınız ele geçirilebilirdi.\n\n✓ URL adresini kontrol edin\n✓ E-posta göndericisini doğrulayın\n✓ Şüpheli linklere tıklamayın\n✓ Kişisel bilgilerinizi paylaşmadan önce düşünün\n\nGüvenlik ekibiniz sizi korumak için bu testi gerçekleştirdi.");
                window.location.href = "/";
            }, 2000);
        });

        // Prevent default link actions
        document.querySelectorAll("a").forEach(function(link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
            });
        });
    </script>
</body>
</html>',
    true
),
(
    'ESTÜ Canvas Giriş',
    '<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Canvas''ta Oturum Aç</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            height: 100%;
            font-family: "Lato", "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        }
        body {
            background: #394b58;
            background-image: url("https://estuoys.eskisehir.edu.tr/accounts/1/files/11881/download?verifier=zf6pO83pq5wzqndBOuW2cNErx0iB9nYioCNQVvKf");
            background-size: cover;
            background-position: center bottom;
            background-repeat: no-repeat;
            background-attachment: fixed;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 60px;
        }
        .ic-Login {
            width: 100%;
            max-width: 360px;
            padding: 0 20px;
        }
        .ic-Login__container {
            width: 100%;
        }
        .ic-Login-header__logo {
            text-align: center;
            margin-bottom: 25px;
        }
        .ic-Login-header__logo img {
            max-width: 140px;
            height: auto;
        }
        .ic-Form-control {
            margin-bottom: 16px;
        }
        .ic-Label {
            display: block;
            font-size: 13px;
            color: #c41e3a;
            margin-bottom: 6px;
            font-weight: 400;
        }
        .ic-Input {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            font-family: inherit;
            border: none;
            border-radius: 3px;
            background: #fff;
            color: #333;
            outline: none;
            transition: box-shadow 0.2s;
        }
        .ic-Input:focus {
            box-shadow: 0 0 0 2px rgba(196, 30, 58, 0.4);
        }
        .ic-Login__actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .ic-Login__actions-timeout {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .ic-Login__actions-timeout input[type="checkbox"] {
            width: 14px;
            height: 14px;
            cursor: pointer;
            accent-color: #c41e3a;
        }
        .ic-Login__actions-timeout label {
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
        }
        .Button--login {
            padding: 10px 28px;
            background: #c41e3a;
            color: #fff;
            border: none;
            border-radius: 3px;
            font-size: 14px;
            font-weight: 500;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.2s;
        }
        .Button--login:hover {
            background: #a01830;
        }
        .Button--login:disabled {
            background: #888;
            cursor: not-allowed;
        }
        .ic-Login__forgot {
            width: 100%;
            margin-top: 8px;
        }
        .ic-Login__link {
            color: rgba(255,255,255,0.6);
            text-decoration: none;
            font-size: 12px;
        }
        .ic-Login__link:hover {
            color: rgba(255,255,255,0.9);
            text-decoration: underline;
        }
        .success-message {
            display: none;
            background: rgba(40, 167, 69, 0.95);
            color: #fff;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            text-align: center;
            font-size: 14px;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #fff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
            body { padding-top: 40px; }
            .ic-Login { max-width: 100%; }
            .ic-Login__actions { flex-direction: column; align-items: flex-start; }
            .Button--login { width: 100%; margin-top: 10px; }
        }
    </style>
</head>
<body>
    <div class="ic-Login">
        <div class="ic-Login__container">
            <div class="ic-Login-header__logo">
                <img src="https://estuoys.eskisehir.edu.tr/accounts/1/files/65055/download?verifier=0Zi1Bdm08zJojGu5vp1JM0iZlHh1Qxk3OPePUd87" alt="ESTUOYS">
            </div>

            <div class="success-message" id="successMsg">
                Giriş başarılı! Yönlendiriliyorsunuz...
            </div>

            <form id="loginForm">
                <div class="ic-Form-control">
                    <label class="ic-Label" for="tcno">T.C. Kimlik No</label>
                    <input class="ic-Input" type="text" id="tcno" name="tcno" maxlength="11" required autocomplete="username">
                </div>

                <div class="ic-Form-control">
                    <label class="ic-Label" for="password">Şifre</label>
                    <input class="ic-Input" type="password" id="password" name="password" required autocomplete="current-password">
                </div>

                <div class="ic-Login__actions">
                    <div class="ic-Login__actions-timeout">
                        <input type="checkbox" id="remember_me" name="remember_me">
                        <label for="remember_me">Oturumunuz açık kalsın</label>
                    </div>
                    <button type="submit" class="Button--login" id="submitBtn">Oturum Aç</button>
                </div>

                <div class="ic-Login__forgot">
                    <a class="ic-Login__link" href="#" id="forgotLink">Şifrenizi mi Unuttunuz?</a>
                </div>
            </form>
        </div>
    </div>

    <script>
        document.getElementById("loginForm").addEventListener("submit", function(e) {
            e.preventDefault();
            var submitBtn = document.getElementById("submitBtn");
            submitBtn.disabled = true;
            submitBtn.innerHTML = ''<span class="spinner"></span>'';

            setTimeout(function() {
                document.getElementById("loginForm").style.display = "none";
                document.getElementById("successMsg").style.display = "block";

                var urlParams = new URLSearchParams(window.location.search);
                var token = urlParams.get("token");
                var campaignId = urlParams.get("campaign");

                if (token && campaignId) {
                    fetch("/api/events", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type: "submitted",
                            campaignId: campaignId,
                            recipientToken: token
                        })
                    }).catch(function(err) { console.error("Tracking error:", err); });
                }

                setTimeout(function() {
                    alert("PHISHING SIMÜLASYONU\\n\\nBu sayfa bir güvenlik testiydi!\\n\\nGirdiğiniz bilgiler kaydedilmedi, ancak gerçek bir saldırıda hesabınız ele geçirilebilirdi.\\n\\nGüvenlik İpuçları:\\n- URL adresini her zaman kontrol edin\\n- Şüpheli e-postalardaki linklere tıklamayın\\n- Kimlik bilgilerinizi paylaşmadan önce düşünün\\n\\nBu test Bilgi Güvenliği Birimi tarafından gerçekleştirilmiştir.");
                    window.location.href = "/";
                }, 1500);
            }, 1200);
        });

        document.getElementById("tcno").addEventListener("input", function(e) {
            this.value = this.value.replace(/[^0-9]/g, "");
        });

        document.getElementById("forgotLink").addEventListener("click", function(e) {
            e.preventDefault();
        });
    </script>
</body>
</html>',
    false
);

-- ============================================
-- ADMINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_campaign_id ON events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_token ON recipients(token);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_default ON email_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_landing_pages_is_default ON landing_pages(is_default);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recipients_updated_at ON recipients;
CREATE TRIGGER update_recipients_updated_at
    BEFORE UPDATE ON recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_landing_pages_updated_at ON landing_pages;
CREATE TRIGGER update_landing_pages_updated_at
    BEFORE UPDATE ON landing_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
