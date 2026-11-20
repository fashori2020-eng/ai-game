import * as T from 'three';

/* ================= پس‌زمینه‌ی سه‌بعدی ================= */
const canvas = document.getElementById('bg');
const scene = new T.Scene();
scene.background = new T.Color(0x0a1a26);
scene.fog = new T.FogExp2(0x0a1a26, 0.011);
const camera = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.ACESFilmicToneMapping;

scene.add(new T.HemisphereLight(0xd8f5ff, 0x1c3342, 1.6));
const sun = new T.DirectionalLight(0xffe4bc, 1.8);
sun.position.set(-25, 30, -10);
scene.add(sun);

const seaGeo = new T.PlaneGeometry(320, 320, 56, 56);
seaGeo.rotateX(-Math.PI / 2);
const sea = new T.Mesh(seaGeo, new T.MeshPhongMaterial({ color: 0x1d5a70, shininess: 60, transparent: true, opacity: 0.9 }));
sea.position.y = -1.2;
scene.add(sea);

const ship = new T.Group();
scene.add(ship);
function box(w, h, d, x, y, z, color) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y, z);
  ship.add(m);
  return m;
}
box(34, 2, 10, 0, 0, 0, 0x2a4254);
box(30, 0.5, 8, 0, 1.2, 0, 0x55707f);
box(7, 1.6, 3, 4, 2.6, -1, 0x8aa3b0);
box(5, 1.1, 2.4, 5, 4, -1, 0x8aa3b0);
box(0.25, 3.2, 0.25, 5.7, 6.4, -1, 0x8aa3b0);
box(2.6, 0.18, 0.5, 5.7, 7.6, -1, 0x55707f);
for (let i = 0; i < 3; i++) box(3, 0.2, 0.5, -12 + i * 4, 1.7, 2, 0x7692a1);

const rings = [];
for (let i = 0; i < 5; i++) {
  const g = new T.Group();
  const ring = new T.Mesh(new T.TorusGeometry(0.8, 0.05, 8, 40), new T.MeshBasicMaterial({ color: i % 2 ? 0xffc76b : 0x64f5cf }));
  const core = new T.Mesh(new T.OctahedronGeometry(0.4), new T.MeshBasicMaterial({ color: 0xafffea, wireframe: true }));
  g.add(ring, core);
  g.position.set(-30 + i * 15, 6 + (i % 3) * 2, -25 - (i % 2) * 10);
  scene.add(g);
  rings.push({ g, ring, core, base: g.position.y, ph: i * 1.3 });
}

camera.position.set(0, 10, 46);
camera.lookAt(0, 2, 0);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const seaPos = seaGeo.attributes.position;
renderer.setAnimationLoop(ms => {
  const t = ms * 0.001;
  for (let i = 0; i < seaPos.count; i++) {
    const x = seaPos.getX(i), z = seaPos.getZ(i);
    seaPos.setY(i, Math.sin(x * 0.4 + t * 1.2) * 0.35 + Math.sin(z * 0.5 - t * 0.9) * 0.25);
  }
  seaPos.needsUpdate = true;
  seaGeo.computeVertexNormals();
  ship.rotation.z = Math.sin(t * 0.6) * 0.012;
  ship.position.y = Math.sin(t * 0.8) * 0.15;
  for (const r of rings) {
    r.g.position.y = r.base + Math.sin(t * 1.1 + r.ph) * 0.6;
    r.ring.quaternion.copy(camera.quaternion);
    r.core.rotation.y = t + r.ph;
  }
  camera.position.x = Math.sin(t * 0.07) * 6;
  camera.lookAt(0, 2, 0);
  renderer.render(scene, camera);
});

/* ================= داده‌ی سناریوها ================= */
const SCENARIOS = [
  {
    id: 's1', num: '01', title: 'مدیریت بازیکن', en: 'PLAYER MANAGEMENT', file: 'PlayerManager.cs',
    tags: ['state سراسری', 'magic number', 'Find در هر فریم'],
    weak: `// ضعف‌های عمده: نام مبهم، state سراسری، magic number، Find در هر فریم
using UnityEngine;
using System.Collections.Generic;

public class PlayerManager : MonoBehaviour
{
    public static List<GameObject> a = new List<GameObject>();
    public static int b = 10; // حداکثر بازیکن

    void Start()
    {
        a.Add(GameObject.Find("Player")); // نام هاردکد
    }

    void Update()
    {
        var tmp = FindObjectsByType<Player>(FindObjectsSortMode.None); // هر فریم!
        foreach (var p in tmp)
        {
            if (p.health <= 0)
            {
                a.Remove(p.gameObject);
                Destroy(p.gameObject);
                b--;
            }
        }
        if (a.Count > 5) Debug.Log("بازیکن زیاد شد"); // magic number
    }

    public void AddPlayer(GameObject x)
    {
        a.Add(x); // بدون هیچ اعتبارسنجی
    }
}`,
    issues: [
      'نام‌های مبهم (a، b، tmp، x)؛ خواننده باید حدس بزند هر متغیر چیست.',
      'state سراسری static و public؛ هر کلاسی می‌تواند لیست بازیکنان را خراب کند.',
      'magic numberها (۱۰ و ۵) بدون نام، دلیل و مرجع واحد.',
      'FindObjectsByType در هر فریم؛ هزینه‌ی CPU سنگین و غیرضروری.',
      'نبود اعتبارسنجی؛ AddPlayer بازیکن تکراری، null یا بیش از سقف را هم اضافه می‌کند.',
      'نبود رویداد (event)؛ سیستم‌های دیگر نمی‌فهمند بازیکنی اضافه یا حذف شده است.'
    ],
    fixed: `using System;
using System.Collections.Generic;
using UnityEngine;
public class PlayerManager : MonoBehaviour
{
    [SerializeField] int maxPlayers = 10;
    readonly List<Player> _players = new();
    public event Action<Player> OnPlayerRemoved;
    public bool TryAdd(Player p)
    {
        if (p == null || _players.Contains(p) || _players.Count >= maxPlayers) return false;
        _players.Add(p); return true;
    }
    public void Remove(Player p)
    {
        if (p == null || !_players.Remove(p)) return;
        OnPlayerRemoved?.Invoke(p);
        Destroy(p.gameObject);
    }
}`
  },
  {
    id: 's2', num: '02', title: 'شبکه چندنفره', en: 'MULTIPLAYER NETWORKING', file: 'NetShooter.cs',
    tags: ['RPC در هر فریم', 'اعتماد به کلاینت', 'بدون اعتبارسنجی'],
    weak: `// ضعف‌های عمده: RPC در هر فریم، اعتماد به کلاینت، آسیب جادویی، Find هاردکد
using UnityEngine;
using Unity.Netcode;

public class NetShooter : NetworkBehaviour
{
    public float speed = 5f;

    void Update()
    {
        if (!IsOwner) return;
        var move = new Vector2(Input.GetAxis("Horizontal"), Input.GetAxis("Vertical"));
        transform.Translate(move * speed * Time.deltaTime);
        SendPosServerRpc(transform.position); // هر فریم!
    }

    [ServerRpc]
    void SendPosServerRpc(Vector3 pos)
    {
        transform.position = pos; // اعتماد کامل به کلاینت
        UpdateClientsRpc(pos);
    }

    [ClientRpc]
    void UpdateClientsRpc(Vector3 pos)
    {
        transform.position = pos;
    }

    public void Shoot()
    {
        DamageServerRpc(100); // آسیب جادویی، بدون Cooldown
    }

    [ServerRpc]
    void DamageServerRpc(int dmg)
    {
        var target = GameObject.Find("Enemy"); // نام هاردکد
        target.GetComponent<Health>().TakeDamage(dmg);
    }
}`,
    issues: [
      'ارسال RPC در هر فریم؛ پهنای باند را می‌سوزاند و در پینگ بالا ناپایدار است.',
      'سرور موقعیت را بدون اعتبارسنجی از کلاینت قبول می‌کند؛ راه باز برای تقلب.',
      'آسیب ثابت ۱۰۰ بدون Cooldown، فاصله یا بررسی مهمات.',
      'GameObject.Find با نام هاردکد؛ شکننده و در هر شلیک کند.',
      'نبود مدیریت خطا برای قطع اتصال، RPC ناموفق یا کلاینت غیرمعتبر.',
      'حرکت مستقیم روی transform بدون NetworkVariable؛ همگام‌سازی ضعیف.'
    ],
    fixed: `using UnityEngine;
using Unity.Netcode;
public class NetShooter : NetworkBehaviour
{
    [SerializeField] float damage = 25f, cooldown = 0.25f, maxRange = 50f;
    float _nextFire;
    public void TryShoot(Vector3 targetPos)
    {
        if (!IsOwner || Time.time < _nextFire) return;
        _nextFire = Time.time + cooldown;
        ShootServerRpc(targetPos);
    }
    [ServerRpc]
    void ShootServerRpc(Vector3 targetPos)
    {
        if (Vector3.Distance(transform.position, targetPos) > maxRange) return;
        if (Physics.Raycast(transform.position, (targetPos - transform.position).normalized, out var hit, maxRange) && hit.collider.TryGetComponent<Health>(out var health))
            health.TakeDamage(damage);
    }
}`
  },
  {
    id: 's3', num: '03', title: 'بارگذاری مپ', en: 'MAP LOADING', file: 'MapLoader.cs',
    tags: ['بارگذاری همگام', 'رشته‌ی جادویی', 'نشت حافظه'],
    weak: `// ضعف‌های عمده: بارگذاری همگام، رشته‌ی جادویی، بدون Progress و Unload
using UnityEngine;
using UnityEngine.SceneManagement;

public class MapLoader : MonoBehaviour
{
    public void LoadMap(int id)
    {
        if (id == 1) SceneManager.LoadScene("DesertMap"); // همگام = فریز
        else if (id == 2) SceneManager.LoadScene("CityMap");
        else if (id == 3) SceneManager.LoadScene("SnowMap");
        else SceneManager.LoadScene("DesertMap"); // پیش‌فرض تکراری
    }

    public void LoadNext()
    {
        var scene = SceneManager.GetActiveScene();
        if (scene.name == "DesertMap") LoadMap(2);
        else if (scene.name == "CityMap") LoadMap(3);
        else LoadMap(1);
    }

    void Start()
    {
        Resources.Load("Maps/Desert"); // نشت: هرگز Unload نمی‌شود
    }
}`,
    issues: [
      'LoadScene همگام؛ بازی در لحظه‌ی بارگذاری فریز می‌شود.',
      'نام صحنه‌ها رشته‌ی جادویی و پراکنده؛ تغییر نام یعنی باگ پنهان.',
      'نبود نمایش پیشرفت (Progress) و صفحه‌ی بارگذاری.',
      'نبود مدیریت خطا؛ اگر صحنه پیدا نشود، هیچ پیامی به کاربر نمی‌رسد.',
      'Resources.Load بدون Unload؛ نشت حافظه در طول جلسه‌ی بازی.',
      'منطق «مپ بعدی» با if-elseهای تکراری و شکننده.'
    ],
    fixed: `using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
public class MapLoader : MonoBehaviour
{
    [SerializeField] string[] mapNames;
    [SerializeField] LoadingScreen loadingScreen;
    public void LoadMap(int index)
    {
        if (index < 0 || index >= mapNames.Length) return;
        StartCoroutine(LoadAsync(mapNames[index]));
    }
    IEnumerator LoadAsync(string sceneName)
    {
        var op = SceneManager.LoadSceneAsync(sceneName);
        if (op == null) { Debug.LogError($"Scene not found: {sceneName}"); yield break; }
        while (!op.isDone) { loadingScreen.SetProgress(op.progress); yield return null; }
    }
}`
  },
  {
    id: 's4', num: '04', title: 'سیستم امتیاز', en: 'SCORE SYSTEM', file: 'ScoreSystem.cs',
    tags: ['static عمومی', 'magic number', 'بدون رویداد'],
    weak: `// ضعف‌های عمده: state سراسری عمومی، magic number، کلید تست، بدون رویداد
using UnityEngine;

public class ScoreSystem : MonoBehaviour
{
    public static int score = 0;
    public static int kills = 0;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.K)) // کلید تست در نسخه‌ی نهایی!
        {
            score += 999; // magic
            kills++;
        }
    }

    public void OnEnemyKilled(GameObject enemy)
    {
        score += 100; // هر دشمن ۱۰۰؟ چرا؟
        kills++;
        if (kills == 10) score += 500; // بونوس جادویی
        if (kills == 25) score += 2000;
        PlayerPrefs.SetInt("score", score); // ذخیره در هر کیل
    }

    public void AddScore(int amount)
    {
        score += amount; // امتیاز منفی هم قبول می‌شود
    }
}`,
    issues: [
      'متغیرهای public static؛ هر اسکریپتی می‌تواند امتیاز را دستکاری کند.',
      'magic numberها (۱۰۰، ۵۰۰، ۲۰۰۰، ۹۹۹) بدون تعریف و دلیل.',
      'کلید تست K و امتیاز ۹۹۹ در کد نهایی باقی مانده است.',
      'نبود رویداد؛ UI مجبور است در هر فریم امتیاز را بخواند.',
      'نبود اعتبارسنجی؛ امتیاز منفی یا غول‌پیکر آزادانه ثبت می‌شود.',
      'ذخیره‌سازی در هر کیل؛ I/O غیرضروری و کند.'
    ],
    fixed: `using System;
using UnityEngine;
public class ScoreSystem : MonoBehaviour
{
    [SerializeField] int killPoints = 100;
    [SerializeField] int milestoneEvery = 10;
    [SerializeField] int milestoneBonus = 500;
    public int Score { get; private set; }
    public event Action<int> OnScoreChanged;
    int _kills;
    public void AddKill()
    {
        _kills++;
        Score += killPoints;
        if (_kills % milestoneEvery == 0) Score += milestoneBonus;
        OnScoreChanged?.Invoke(Score);
    }
}`
  },
  {
    id: 's5', num: '05', title: 'مدیریت سلاح', en: 'WEAPON MANAGEMENT', file: 'WeaponManager.cs',
    tags: ['copy-paste', 'بدون داده‌محوری', 'کوپلینگ بالا'],
    weak: `// ضعف‌های عمده: copy-paste برای هر سلاح، magic number، بدون داده‌محوری
using UnityEngine;

public class WeaponManager : MonoBehaviour
{
    public int current = 1; // 1=پیستول 2=رایفل 3=شاتگان
    int ammo1 = 12, ammo2 = 30, ammo3 = 6;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) current = 1;
        if (Input.GetKeyDown(KeyCode.Alpha2)) current = 2;
        if (Input.GetKeyDown(KeyCode.Alpha3)) current = 3;

        if (current == 1 && Input.GetMouseButtonDown(0))
        {
            // پیستول: آسیب ۲۰، سرعت ۰٫۳
            if (ammo1 > 0) { ammo1--; FirePistol(); }
        }
        if (current == 2 && Input.GetMouseButtonDown(0))
        {
            // رایفل: آسیب ۱۵، خودکار
            if (ammo2 > 0) { ammo2--; FireRifle(); }
        }
        if (current == 3 && Input.GetMouseButtonDown(0))
        {
            // شاتگان: ۸ ساچمه
            if (ammo3 > 0) { ammo3--; FireShotgun(); }
        }
    }

    void FirePistol() { /* ... */ }
    void FireRifle() { /* ... */ }
    void FireShotgun() { /* ... */ }
}`,
    issues: [
      'کپی‌پیست منطق شلیک برای هر سلاح؛ تغییر یک رفتار یعنی سه ویرایش.',
      'magic numberها (آسیب، مهمات، سرعت) داخل کد و بدون مرجع واحد.',
      'شناسه‌ی عددی سلاح (۱/۲/۳)؛ افزودن سلاح جدید یعنی تغییر همه‌چیز.',
      'نبود داده‌محوری (ScriptableObject)؛ تنظیمات سلاح در کد قفل شده است.',
      'نبود اعتبارسنجی؛ مهمات منفی یا سلاح نامعتبر کنترل نمی‌شود.',
      'کوپلینگ بالا؛ ورودی، مهمات و شلیک همه در یک کلاس قاطی شده‌اند.'
    ],
    fixed: `using System.Collections.Generic;
using UnityEngine;
public class WeaponManager : MonoBehaviour
{
    [SerializeField] List<WeaponData> weapons;
    int _index, _ammo;
    void OnEnable() => Select(0);
    public void Select(int i)
    {
        if (i < 0 || i >= weapons.Count) return;
        _index = i;
        _ammo = weapons[i].magazineSize;
    }
    public void TryFire()
    {
        if (_ammo <= 0) return;
        _ammo--;
        weapons[_index].Fire(transform);
    }
}`,
    note: '<b>WeaponData</b> یک ScriptableObject است که آسیب، مهمات و سرعت هر سلاح را نگه می‌دارد؛ افزودن سلاح جدید یعنی ساخت یک دارایی تازه، نه ویرایش کد.'
  }
];

/* ================= هایلایت C# ================= */
const KEYWORDS = 'using|public|private|protected|internal|static|void|class|if|else|return|new|null|true|false|var|foreach|in|while|for|out|ref|readonly|override|virtual|event|this|base|yield|break|continue|switch|case|default|try|catch|finally|throw|typeof|is|as|const|enum|struct|interface|async|await|get|set|add|remove|value|dynamic|sizeof|nameof|when|init|record|partial|sealed|abstract|extern|unsafe|checked|unchecked|fixed|goto|lock|operator|params|implicit|explicit|and|or|not|with|required|scoped|unmanaged|nint|nuint|file|alias|ascending|descending|orderby|group|join|let|on|equals|by|select|from|where';
const TOKEN_RE = new RegExp(
  '(\\/\\/.*$)' +
  '|(\\/\\*[\\s\\S]*?\\*\\/)' +
  '|(\\$?"(?:\\\\.|[^"\\\\])*")' +
  '|(\\[[A-Za-z][A-Za-z0-9]*\\])' +
  '|\\b(' + KEYWORDS + ')\\b' +
  '|(\\b\\d+(?:\\.\\d+)?f?\\b)' +
  '|([A-Z][A-Za-z0-9_]*)(?!\\s*\\()' +
  '|([A-Za-z_][A-Za-z0-9_]*)(?=\\s*\\()',
  'g'
);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlightLine(line) {
  let out = '', last = 0, m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    out += esc(line.slice(last, m.index));
    const cls = m[1] || m[2] ? 'c-com' : m[3] ? 'c-str' : m[4] ? 'c-attr' : m[5] ? 'c-kw' : m[6] ? 'c-num' : m[7] ? 'c-type' : 'c-fn';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(line.slice(last));
  return out || '&nbsp;';
}

/* ================= رندر ================= */
const FA = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰'];
const codeStore = [];

function codeBlock(code, file, label, tone, badge) {
  const idx = codeStore.push(code) - 1;
  const lines = code.replace(/\n+$/, '').split('\n');
  const body = lines.map((l, i) =>
    `<div class="cl"><span class="ln">${i + 1}</span><code>${highlightLine(l)}</code></div>`
  ).join('');
  return `<div class="code-block ${tone}">
    <div class="code-head">
      <span class="code-label">${label}</span>
      <span class="code-file" dir="ltr">${file}</span>
      ${badge ? `<span class="code-badge">${badge}</span>` : ''}
      <button class="copy" data-idx="${idx}" aria-label="کپی کد">کپی</button>
    </div>
    <div class="code-body" dir="ltr">${body}</div>
  </div>`;
}

document.getElementById('index-grid').innerHTML = SCENARIOS.map(s => `
  <a class="idx-card reveal" href="#${s.id}">
    <span class="idx-num" dir="ltr">${s.num}</span>
    <h4>${s.title}</h4>
    <small dir="ltr">${s.file}</small>
    <div class="idx-tags">${s.tags.map(t => `<span>${t}</span>`).join('')}</div>
    <span class="idx-go">مشاهده ↓</span>
  </a>`).join('');

document.getElementById('scenario-list').innerHTML = SCENARIOS.map(s => `
  <section class="scenario reveal" id="${s.id}">
    <div class="sc-head">
      <div class="sc-num" dir="ltr">${s.num}</div>
      <div class="sc-title">
        <small dir="ltr">${s.en}</small>
        <h3>${s.title}</h3>
        <div class="sc-meta">
          <span class="file" dir="ltr">${s.file}</span>
          ${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    </div>
    ${codeBlock(s.weak, s.file, 'کد ضعیف — قابل اجرا ولی نادرست', 'weak', 'ضعف‌های عمده در خط اول')}
    <div class="issues">
      <h4>ضعف‌های این کد</h4>
      <ol>${s.issues.map((x, i) => `<li><span class="n">${FA[i]}</span><span>${x}</span></li>`).join('')}</ol>
    </div>
    ${codeBlock(s.fixed, s.file, 'نسخه‌ی درست — کوتاه و تمیز', 'fixed', 'حداکثر ۲۰ خط')}
    ${s.note ? `<p class="note">${s.note}</p>` : ''}
  </section>`).join('');

/* ================= تعامل‌ها ================= */
document.addEventListener('click', e => {
  const btn = e.target.closest('.copy');
  if (!btn) return;
  const code = codeStore[+btn.dataset.idx];
  const done = () => {
    btn.textContent = 'کپی شد ✓';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'کپی'; btn.classList.remove('done'); }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
  } else fallbackCopy(code, done);
});
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) { /* ignore */ }
  ta.remove();
  done();
}

const prog = document.getElementById('progress');
addEventListener('scroll', () => {
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
}, { passive: true });

const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
