const data=[['مدیریت بازیکن','Player Management','♙','PlayerState','سلامت و بازنشانی وضعیت بازیکن',`public static int x = 100;
void Start() { x = 100; }
public void ResetPlayer() { x = 100; }
public void Hit(int n) { x -= n; }`,`const int MaxHealth = 100;
public int Health { get; private set; } = MaxHealth;
public void ResetPlayer() => Health = MaxHealth;
public void Hit(int damage) {
    Health -= Mathf.Clamp(damage, 0, Health);
}`,['نام x معنای سلامت بازیکن را منتقل نمی‌کند.','مقدار ۱۰۰ در چند نقطه تکرار شده است.','سلامت سراسری بین تمام بازیکن‌ها مشترک است.','آسیب منفی یا بیش از سلامت بررسی نمی‌شود.']],['سرویس چندنفره','Multiplayer Service','⌘','Lobby','اعلان محلی ورود بازیکن به لابی',`public static event System.Action e;
void OnEnable() { e += Log; }
void Log() { Debug.Log("joined"); }
public void Join() { e?.Invoke(); }`,`public event System.Action Joined;
void OnEnable() => Joined += LogJoin;
void OnDisable() => Joined -= LogJoin;
void LogJoin() => Debug.Log("joined");
public void Join() => Joined?.Invoke();`,['اشتراک رویداد پس از غیرفعال‌شدن باقی می‌ماند.','نام e هدف رویداد را پنهان می‌کند.','رویداد سراسری لابی‌های مستقل را به هم متصل می‌کند.']],['بارگذاری نقشه','Map Loading','▱','MapLoader','انتخاب صحنه‌ی مسابقه',`public void Go(int x) {
    if (x == 1) UnityEngine.SceneManagement.SceneManager.LoadScene("Arena");
    if (x == 2) UnityEngine.SceneManagement.SceneManager.LoadScene("Valley");
}`,`[SerializeField] string[] maps;
public void LoadMap(int index) {
    if (maps == null || index < 0 || index >= maps.Length ||
        !Application.CanStreamedLevelBeLoaded(maps[index])) {
        Debug.LogWarning("Map unavailable");
        return;
    }
    UnityEngine.SceneManagement.SceneManager.LoadScene(maps[index]);
}`,['شناسه‌های عددی بدون توضیح هستند.','فراخوانی بارگذاری برای هر نقشه تکرار می‌شود.','انتخاب نامعتبر بدون پیام نادیده گرفته می‌شود.']],['سیستم امتیاز','Score System','♜','ScoreBoard','ثبت امتیاز در مسابقه',`public static int s;
public void Win() { s += 10; }
public void Bonus() { s += 10; }`,`const int Reward = 10;
public int Score { get; private set; }
public void Win() => AddReward();
public void Bonus() => AddReward();
void AddReward() => Score += Reward;`,['متغیر عمومی از هر نقطه تغییر می‌کند.','عدد امتیاز در دو متد تکرار شده است.','نام s مفهوم امتیاز را مشخص نمی‌کند.']],['مدیریت سلاح','Weapon Management','⊹','WeaponState','شمارش مهمات مجازی بازیکن',`public static int a = 30;
public void Fire() { a--; }
public void Reload() { a = 30; }`,`const int Capacity = 30;
public int Ammo { get; private set; } = Capacity;
public bool TryFire() {
    if (Ammo == 0) return false;
    Ammo--;
    return true;
}
public void Reload() => Ammo = Capacity;`,['تمام سلاح‌ها یک شمارنده‌ی مشترک دارند.','مهمات می‌تواند منفی شود.','ظرفیت خشاب به شکل عدد جادویی تکرار شده است.']]];
const summary=['نام‌های معنادار، هدف متغیرها را روشن می‌کنند.','مقادیر ثابت را به جای اعداد جادویی نام‌گذاری کنید.','رفتار تکراری را در یک متد نگه دارید.','وضعیت هر نمونه را از وضعیت سراسری جدا کنید.','ورودی‌ها و چرخه‌ی عمر رویدادها را بررسی کنید.'];let idx=0;const fa=n=>n.toLocaleString('fa-IR'),num=n=>String(n+1).padStart(2,'0'),code=(d,good)=>`${good?'':'// ضعف‌های عمده: '+d[7].slice(0,2).join(' ')+'\n'}using UnityEngine;\n\npublic class ${d[3]} : MonoBehaviour\n{\n${d[good?6:5].split('\n').map(l=>'    '+l).join('\n')}\n}`;const markdown=data.map((d,i)=>`## ${fa(i+1)}. ${d[0]}\n\n### کد ضعیف\n\n\`\`\`csharp\n${code(d,false)}\n\`\`\`\n\n${d[7].map((s,j)=>`${j+1}. ${s}`).join('\n')}\n\n### نسخه‌ی درست\n\n\`\`\`csharp\n${code(d,true)}\n\`\`\``).join('\n\n')+'\n\n## جمع‌بندی\n'+summary.join('  \n');const url=URL.createObjectURL(new Blob([markdown],{type:'text/markdown;charset=utf-8'}));function highlight(l){if(l.trim().startsWith('//'))return `<u>${l}</u>`;return l.replaceAll('&','&amp;').replaceAll('<','&lt;').replace(/("[^"]*"|\b(?:using|public|static|class|void|int|bool|const|return|if|private|string|true|false|event)\b|\b\d+\b|\b[A-Z]\w*)/g,x=>`<span class="${/^\d|^"/.test(x)?'gold':/^[A-Z]/.test(x)?'blue':'purple'}">${x}</span>`)}function render(){const d=data[idx];list.innerHTML=data.map((a,i)=>`<button class="item ${i===idx?'sel':''}" data-i="${i}"><i>${a[2]}</i><div>${a[0]}<small>${a[1]}</small></div><sup>${num(i)}</sup></button>`).join('');progress.innerHTML=`سناریوی ${fa(idx+1)} از ۵ <div class="bars">${data.map((_,i)=>`<b class="${i<=idx?'lit':''}"></b>`).join('')}</div>`;review.innerHTML=`<label>SCENARIO &nbsp; / &nbsp; ${num(idx)}</label><h2>${d[0]}</h2><p>${d[4]} در یک شوتر چندنفره‌ی سبک.</p>`+[false,true].map(g=>`<section class="panel ${g?'good':''}"><div class="pt"><b>${g?'✓ &nbsp; نسخه‌ی درست':'⚠ &nbsp; کد ضعیف'}</b><small>${g?'REFACTORED':'ANTI-PATTERN'}</small></div><div class="file"><span><strong>C#</strong> &nbsp; ${d[3]}.cs</span><button data-copy="${+g}" title="کپی کد">▢ &nbsp; کپی</button></div><pre>${code(d,g).split('\n').map((l,i)=>`<div><s>${i+1}</s>${highlight(l)}</div>`).join('')}</pre></section>${g?'':`<h3>بررسی ضعف‌ها</h3><ol>${d[7].map(s=>`<li>${s}</li>`).join('')}</ol>`}`).join('')+`<button class="next" id="next">${idx<4?'سناریوی بعدی ←':'مشاهده‌ی جمع‌بندی ←'}</button>`;document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{idx=+b.dataset.i;render()});document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(code(d,!!+b.dataset.copy));b.textContent='کپی شد ✓'}catch{b.textContent='کد را انتخاب کنید'}});next.onclick=()=>{if(idx<4){idx++;render()}else show();review.scrollIntoView()}}function show(){document.querySelectorAll('.sel').forEach(e=>e.classList.remove('sel'));review.innerHTML=`<label>LAB SUMMARY</label><h2>جمع‌بندی آزمایشگاه</h2><ol>${summary.map(s=>`<li>${s}</li>`).join('')}</ol><a class="next" download="unity-lab.md" href="${url}">دریافت هر ۵ سناریو · Markdown ↓</a>`}sum.onclick=show;document.querySelector('a[href="#lab"]').onclick=render;render();
